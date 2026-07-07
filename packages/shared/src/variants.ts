/**
 * Product variant intelligence.
 *
 * One catalog product = one model family ("Samsung S95D OLED TV"); the concrete
 * configurations (65"/75", 256 GB/512 GB, Schwarz/Silber) are ProductVariant
 * rows underneath it. This module is the pure, shared core that decides:
 *
 *  1. which variant attributes a shop/catalog title carries
 *     ({@link extractVariantSignature}),
 *  2. whether two titles are the SAME family in different configurations
 *     ({@link matchVariantSibling}) — the check that stops the extension and
 *     the create flows from filling the catalog with "65 Zoll", "75 Zoll",
 *     "85 Zoll" copies of one TV.
 *
 * Design rules, in order:
 *  - False positives are worse than false negatives: wrongly merging two real
 *    products destroys trust; missing a merge only leaves today's behavior.
 *  - Everything is deterministic and pure — no I/O, no AI. Used by the API
 *    (matching, sightings pipeline), scripts and tests.
 */

import { normalizeProductName } from './normalize';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type VariantAttributeKey = 'groesse' | 'speicher' | 'ram' | 'farbe';

export interface VariantAttribute {
  key: VariantAttributeKey;
  /** Display label, e.g. "Größe". */
  label: string;
  /** Canonical display value, e.g. "65 Zoll", "256 GB", "Schwarz". */
  value: string;
}

export interface VariantSignature {
  /** Detected variant attributes, stable order (Größe, Speicher, RAM, Farbe). */
  attributes: VariantAttribute[];
  /**
   * Normalized name with all variant phrases removed and screen-size digits
   * stripped out of model codes ("gq65s95datxzg" → "gqs95datxzg"). Two titles
   * of the same family in different configurations converge on similar bases.
   */
  baseName: string;
  /**
   * De-sized model-code tokens (letters+digits mixed, length ≥ 4) — the
   * strongest cross-shop identity signal ("gqs95datxzg", "wh1000xm5").
   */
  modelTokens: string[];
  /** Pure digit tokens of the base name ("15" in "iphone 15 pro"). */
  digitTokens: string[];
  /** Human variant label, e.g. "65 Zoll · Schwarz" (empty when no attributes). */
  variantLabel: string;
}

/* ------------------------------------------------------------------ *
 * Attribute extraction
 * ------------------------------------------------------------------ */

/** Screen size: 65", 65 Zoll, 65 inch. Bounded 10–120 to dodge prices/years. */
const SIZE_PATTERN = /(\d{2,3})\s*(?:["”″]|zoll\b|inch(?:es)?\b|in\.)/gi;

/** TV listings often carry the cm size too ("(163 cm)") — strip it from the base. */
const CM_PATTERN = /\(?\b(\d{2,3})\s*cm\b\)?/gi;

/** Storage / RAM: "256 GB", "1 TB", "12 GB RAM", "256GB". */
const MEMORY_PATTERN = /(\d+(?:[.,]\d+)?)\s*(tb|gb)\b(\s*ram\b)?/gi;

/**
 * Color vocabulary (normalized tokens). Includes the common German/English
 * shop colors plus marketing modifiers that only ever appear as part of a
 * color phrase ("titan natur", "space grau", "mitternacht").
 */
const COLOR_TOKENS = new Set([
  'schwarz', 'black', 'weiss', 'white', 'silber', 'silver', 'grau', 'gray', 'grey',
  'gold', 'blau', 'blue', 'rot', 'red', 'gruen', 'green', 'gelb', 'yellow',
  'rosa', 'pink', 'lila', 'violett', 'purple', 'braun', 'brown', 'beige',
  'titan', 'titanium', 'graphit', 'graphite', 'anthrazit', 'creme', 'cream',
  'navy', 'tuerkis', 'cyan', 'mint', 'orange', 'bronze', 'kupfer', 'copper',
  'platin', 'platinum', 'sand', 'champagner', 'champagne', 'roségold', 'rosegold',
  'mitternacht', 'midnight', 'polarstern', 'starlight', 'lavendel', 'lavender',
  'koralle', 'coral', 'smaragd', 'emerald', 'onyx', 'obsidian', 'jade', 'denim',
]);

/** Words that extend a color phrase but are meaningless alone ("titan NATUR"). */
const COLOR_MODIFIERS = new Set([
  'natur', 'natural', 'hell', 'dunkel', 'light', 'dark', 'deep', 'space',
  'nebula', 'phantom', 'cosmic', 'mystic', 'awesome', 'matt', 'matte',
  'glossy', 'metallic', 'stone', 'ocean', 'forest', 'sky', 'ice', 'shadow',
]);

/**
 * Tokens that are pure listing noise and must not keep two base names apart
 * ("5G" on one shop, missing on the other). Deliberately short — anything
 * longer risks erasing a real distinction.
 */
const BASE_NOISE_TOKENS = new Set([
  '5g', '4g', 'lte', 'wifi', 'wlan', 'dualsim', 'sim', 'esim', 'neu', 'new',
  'flat', 'fernseher', 'tv', 'smarttv',
]);

/** Capitalize each word of a normalized color phrase for display. */
function displayColor(phrase: string): string {
  return phrase
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Extract the variant attributes + family base from a raw shop/catalog title.
 * Works on the RAW title (units like `"` and `Zoll` disappear in normalized
 * names), then normalizes the remainder into the base name.
 */
export function extractVariantSignature(rawTitle: string): VariantSignature {
  const title = rawTitle ?? '';
  const attributes: VariantAttribute[] = [];
  let stripped = title;

  /* -- Größe (Zoll) ------------------------------------------------- */
  const sizes = new Set<string>();
  stripped = stripped.replace(SIZE_PATTERN, (match, digits: string) => {
    const n = Number.parseInt(digits, 10);
    if (n < 10 || n > 120) return match; // not a screen size
    sizes.add(String(n));
    return ' ';
  });
  // cm sizes are secondary facts of the same variant — strip, don't label.
  const cmSizes = new Set<string>();
  stripped = stripped.replace(CM_PATTERN, (match, digits: string) => {
    const n = Number.parseInt(digits, 10);
    if (n < 30 || n > 310) return match;
    cmSizes.add(String(n));
    return ' ';
  });
  const size = [...sizes][0];
  if (size) {
    attributes.push({ key: 'groesse', label: 'Größe', value: `${size} Zoll` });
  }

  /* -- Speicher / RAM ------------------------------------------------ */
  let storage: { amount: number; unit: string } | null = null;
  let ram: { amount: number; unit: string } | null = null;
  stripped = stripped.replace(
    MEMORY_PATTERN,
    (_match, digits: string, unit: string, ramSuffix: string | undefined) => {
      const amount = Number.parseFloat(digits.replace(',', '.'));
      if (!Number.isFinite(amount) || amount <= 0) return ' ';
      const u = unit.toUpperCase();
      if (ramSuffix) {
        ram = ram ?? { amount, unit: u };
      } else {
        // Phones list "8GB+256GB" — the bigger number is the storage.
        const gb = u === 'TB' ? amount * 1024 : amount;
        const currentGb = storage ? (storage.unit === 'TB' ? storage.amount * 1024 : storage.amount) : -1;
        if (gb > currentGb) storage = { amount, unit: u };
      }
      return ' ';
    },
  );
  if (storage) {
    const s = storage as { amount: number; unit: string };
    const amount = Number.isInteger(s.amount) ? String(s.amount) : String(s.amount).replace('.', ',');
    attributes.push({ key: 'speicher', label: 'Speicher', value: `${amount} ${s.unit}` });
  }
  if (ram) {
    const r = ram as { amount: number; unit: string };
    attributes.push({ key: 'ram', label: 'RAM', value: `${r.amount} ${r.unit} RAM` });
  }

  /* -- Farbe (on the normalized token stream) ------------------------ */
  const tokens = normalizeProductName(stripped).split(' ').filter(Boolean);
  const colorParts: string[] = [];
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (COLOR_TOKENS.has(token)) {
      const phrase = [token];
      // consume adjacent modifier/color words: "titan natur", "space grau"
      while (i + 1 < tokens.length) {
        const next = tokens[i + 1]!;
        if (COLOR_TOKENS.has(next) || COLOR_MODIFIERS.has(next)) {
          phrase.push(next);
          i += 1;
        } else break;
      }
      if (colorParts.length === 0) colorParts.push(...phrase);
      continue; // color words never reach the base name
    }
    // A modifier directly BEFORE a color ("space grau") joins the phrase.
    if (COLOR_MODIFIERS.has(token) && i + 1 < tokens.length && COLOR_TOKENS.has(tokens[i + 1]!)) {
      const phrase = [token, tokens[i + 1]!];
      i += 1;
      while (i + 1 < tokens.length) {
        const next = tokens[i + 1]!;
        if (COLOR_TOKENS.has(next) || COLOR_MODIFIERS.has(next)) {
          phrase.push(next);
          i += 1;
        } else break;
      }
      if (colorParts.length === 0) colorParts.push(...phrase);
      continue;
    }
    kept.push(token);
  }
  if (colorParts.length > 0) {
    attributes.push({ key: 'farbe', label: 'Farbe', value: displayColor(colorParts.join(' ')) });
  }

  /* -- Base name: de-size model codes, drop pure noise ---------------- */
  const allSizes = new Set([...sizes, ...cmSizes]);
  const baseTokens = kept
    .map((token) => desizeModelToken(token, allSizes))
    .filter((token) => token.length > 0 && !BASE_NOISE_TOKENS.has(token));

  const baseName = baseTokens.join(' ');
  // Model codes come from the RAW words: normalization splits "WH-1000XM5"
  // into "wh 1000xm5", losing the cross-shop identity. Compacting each raw
  // word ("wh1000xm5") keeps hyphen/space spelling differences aligned.
  const modelTokens = [
    ...new Set(
      stripped
        .split(/\s+/)
        .map((word) => normalizeProductName(word).replace(/\s+/g, ''))
        .filter((word) => isModelToken(word) && !COLOR_TOKENS.has(word))
        .map((word) => desizeModelToken(word, allSizes)),
    ),
  ];
  const digitTokens = [...new Set(baseTokens.filter((t) => /^\d+$/.test(t)))];

  // Sort attributes into a stable display order.
  const order: VariantAttributeKey[] = ['groesse', 'speicher', 'ram', 'farbe'];
  attributes.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return {
    attributes,
    baseName,
    modelTokens,
    digitTokens,
    variantLabel: variantLabel(attributes),
  };
}

/** "65 Zoll · 256 GB · Schwarz" — the ProductVariant display name. */
export function variantLabel(attributes: VariantAttribute[]): string {
  return attributes.map((a) => a.value).join(' · ');
}

/**
 * The family base key persisted on Product.variantBaseName — the de-variantized
 * normalized name used to prefilter family candidates. Null-ish (empty) when
 * the name normalizes away entirely.
 */
export function variantBaseName(rawTitle: string): string {
  return extractVariantSignature(rawTitle).baseName;
}

/** Letters+digits mixed and long enough to be a model code, not "4k"/"s24". */
function isModelToken(token: string): boolean {
  return token.length >= 4 && /[a-z]/.test(token) && /\d/.test(token);
}

/**
 * TV model codes embed the screen size ("GQ65S95DAT", "OLED65C47LA",
 * "XR-65A95L" → token "xr65a95l"). When the title carries that size as an
 * explicit attribute (or cm twin), removing the digits from inside the code
 * makes the 65" and 77" listings converge on one family token.
 * Only digits that exactly match a detected size are removed — a "1000" in
 * "wh1000xm5" is untouchable because it is never a plausible screen size.
 */
export function desizeModelToken(token: string, sizes: ReadonlySet<string>): string {
  if (sizes.size === 0 || !isModelToken(token)) return token;
  for (const size of sizes) {
    if (token === size) continue;
    const idx = token.indexOf(size);
    if (idx <= 0) continue; // must sit INSIDE the code, after a letter prefix
    const before = token[idx - 1]!;
    const after = token[idx + size.length];
    // Guard: the size must be delimited by letters (or the end), so we never
    // mangle longer numbers that merely contain the size ("1650").
    if (/[a-z]/.test(before) && (after === undefined || /[a-z]/.test(after))) {
      return token.slice(0, idx) + token.slice(idx + size.length);
    }
  }
  return token;
}

/* ------------------------------------------------------------------ *
 * Sibling matching
 * ------------------------------------------------------------------ */

export type VariantMatchVerdict =
  | { kind: 'none' }
  /** Same family, different configuration → attach as variant. */
  | { kind: 'sibling'; confidence: number }
  /** Same family AND same configuration → it's the same product/variant. */
  | { kind: 'same-variant'; confidence: number };

/** Word-path similarity floor for names without any model code. */
const WORD_MATCH_MIN_SIMILARITY = 0.8;

/**
 * Decide whether two titles describe the same model family. `a` is the
 * incoming title (sighting/create), `b` the existing product. Brands are
 * checked when both sides know one — a brand mismatch always vetoes.
 *
 * Two independent paths, strongest evidence first:
 *  - MODEL PATH: both sides carry model codes and they align (equal or one is
 *    a prefix of the other ≥ 6 chars, covering regional suffixes like
 *    "GQ65S95DAT" vs "GQ65S95DATXZG").
 *  - WORD PATH: no model codes — base names must agree strongly AND their
 *    digit tokens exactly ("iphone 15" never joins "iphone 15 pro" because
 *    "pro" survives in the base name; "s24" vs "s24 ultra" likewise).
 */
export function matchVariantSibling(params: {
  incomingTitle: string;
  incomingBrand?: string | null;
  existingTitle: string;
  existingBrand?: string | null;
}): VariantMatchVerdict {
  const a = extractVariantSignature(params.incomingTitle);
  const b = extractVariantSignature(params.existingTitle);

  // Without a single variant attribute on the incoming side there is nothing
  // variant-shaped to attach — the regular duplicate matcher owns that case.
  if (a.attributes.length === 0) return { kind: 'none' };
  if (!a.baseName || !b.baseName) return { kind: 'none' };

  const brandA = normalizeProductName(params.incomingBrand ?? '');
  const brandB = normalizeProductName(params.existingBrand ?? '');
  if (brandA && brandB && brandA !== brandB) return { kind: 'none' };

  let confidence = 0;
  if (a.modelTokens.length > 0 && b.modelTokens.length > 0) {
    if (modelTokensAlign(a.modelTokens, b.modelTokens)) {
      confidence = 0.95;
    } else {
      // Conflicting model codes are a hard NO — "gqs95dat" never merges with
      // "gqs90dat" no matter how similar the marketing words are.
      return { kind: 'none' };
    }
  } else {
    // Deliberately NOT normalize.tokenSimilarity: that helper drops marketing
    // stop-words like "pro" — exactly the word that separates "iPhone 15"
    // from "iPhone 15 Pro". Here every base token counts.
    const similarity = baseNameSimilarity(a.baseName, b.baseName);
    const digitsEqual =
      a.digitTokens.length === b.digitTokens.length &&
      a.digitTokens.every((d) => b.digitTokens.includes(d));
    if (similarity < WORD_MATCH_MIN_SIMILARITY || !digitsEqual) return { kind: 'none' };
    // Word-only matches need a brand on at least one side to anchor identity.
    if (!brandA && !brandB) return { kind: 'none' };
    confidence = similarity;
  }

  return sameConfiguration(a, b)
    ? { kind: 'same-variant', confidence }
    : { kind: 'sibling', confidence };
}

/**
 * Every model token of the shorter list must align with one of the other side
 * (equal, or prefix-of with ≥ 6 shared chars). At least one aligned pair must
 * be ≥ 5 chars so "ab12" alone can't carry a merge.
 */
function modelTokensAlign(a: string[], b: string[]): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let strongest = 0;
  for (const token of short) {
    const partner = long.find((other) => tokensAlign(token, other));
    if (!partner) return false;
    strongest = Math.max(strongest, Math.min(token.length, partner.length));
  }
  return strongest >= 5;
}

function tokensAlign(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // Prefix covers regional suffixes ("gqs95dat" ⊂ "gqs95datxzg"); suffix covers
  // spelling splits of the same code ("1000xm5" ⊂ "wh1000xm5").
  return short.length >= 6 && (long.startsWith(short) || long.endsWith(short));
}

/** Plain Jaccard over base-name tokens — no stop-word dropping. */
function baseNameSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Same configuration = the attribute values both sides DECLARE agree. */
function sameConfiguration(a: VariantSignature, b: VariantSignature): boolean {
  if (b.attributes.length === 0) return false;
  const bByKey = new Map(b.attributes.map((attr) => [attr.key, attr.value]));
  let compared = 0;
  for (const attr of a.attributes) {
    const other = bByKey.get(attr.key);
    if (other === undefined) continue;
    compared += 1;
    if (other !== attr.value) return false;
  }
  return compared > 0;
}

/* ------------------------------------------------------------------ *
 * Display helpers
 * ------------------------------------------------------------------ */

/**
 * Strip the variant phrases out of a RAW display title when a product
 * "graduates" to a family: "Samsung GQ65S95DATXZG OLED 4K, 65 Zoll, Titan
 * Schwarz" → "Samsung GQS95DATXZG OLED 4K". Sizes embedded in model codes are
 * removed too (only when they match the explicit size attribute), so the title
 * doesn't keep pointing at one configuration. Falls back to the original when
 * stripping would leave too little behind.
 */
export function familyDisplayName(rawTitle: string): string {
  const sig = extractVariantSignature(rawTitle);
  if (sig.attributes.length === 0) return rawTitle.trim();

  let out = rawTitle;
  const sizes = new Set<string>();
  out = out.replace(SIZE_PATTERN, (match, digits: string) => {
    const n = Number.parseInt(digits, 10);
    if (n < 10 || n > 120) return match;
    sizes.add(String(n));
    return ' ';
  });
  out = out.replace(CM_PATTERN, (match, digits: string) => {
    const n = Number.parseInt(digits, 10);
    if (n < 30 || n > 310) return match;
    sizes.add(String(n));
    return ' ';
  });
  out = out.replace(MEMORY_PATTERN, ' ');

  // Remove color words token-wise, preserving the original casing of the rest.
  out = out
    .split(/\s+/)
    .filter((word) => {
      const norm = normalizeProductName(word);
      if (!norm) return word.trim().length > 0 && !/^[,;|–—-]+$/.test(word.trim());
      if (COLOR_TOKENS.has(norm)) return false;
      // Standalone modifiers survive unless glued to a removed color; cheap
      // approximation: drop them only when the signature detected a color.
      if (sig.attributes.some((a) => a.key === 'farbe') && COLOR_MODIFIERS.has(norm)) return false;
      return true;
    })
    .map((word) => desizeDisplayWord(word, sizes))
    .join(' ');

  const cleaned = out
    .replace(/\(\s*[,;/|-]*\s*\)/g, ' ') // empty leftovers like "( )"
    .replace(/\s*[,;|]\s*(?=[,;|)]|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;)])/g, '$1')
    .replace(/[,;\s|–—-]+$/g, '')
    .trim();

  return cleaned.length >= 8 ? cleaned : rawTitle.trim();
}

/** De-size a display word when its normalized form is a sized model code. */
function desizeDisplayWord(word: string, sizes: ReadonlySet<string>): string {
  const norm = normalizeProductName(word).replace(/\s+/g, '');
  const desized = desizeModelToken(norm, sizes);
  if (desized === norm) return word;
  // Rebuild in the original case by deleting the size digits at their position.
  for (const size of sizes) {
    const idx = word.toLowerCase().indexOf(size);
    if (idx > 0) {
      const candidate = word.slice(0, idx) + word.slice(idx + size.length);
      if (normalizeProductName(candidate).replace(/\s+/g, '') === desized) return candidate;
    }
  }
  return word;
}
