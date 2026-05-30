/**
 * Product name normalization & matching helpers.
 *
 * Used by the backend's ProductMatchingService to deduplicate products and by the
 * frontend to preview "did you mean…" suggestions. Pure functions, no I/O.
 */

/**
 * Generic words that carry no distinguishing value for a product name and only
 * create noise when matching. Kept conservative on purpose — we'd rather miss a
 * dedupe than merge two genuinely different products.
 */
const GENERIC_WORDS = new Set<string>([
  'the',
  'der',
  'die',
  'das',
  'a',
  'an',
  'with',
  'mit',
  'und',
  'and',
  'for',
  'fuer',
  'von',
  'pro', // ambiguous, but usually a marketing suffix; keep "ultra"/"max" as they differentiate
  'edition',
  'modell',
  'model',
  'series',
  'serie',
  'new',
  'neu',
]);

/**
 * Normalize a raw product name into a comparison key:
 * - unicode-normalize and fold German umlauts (ä→ae, ö→oe, ü→ue, ß→ss)
 * - lowercase
 * - strip everything except a-z0-9 and spaces
 * - collapse whitespace
 *
 * The result is stable and safe to store in a unique-ish index for fast lookups.
 */
export function normalizeProductName(input: string): string {
  if (!input) return '';

  const folded = input
    .toLowerCase()
    // Fold German umlauts FIRST — before NFKD would decompose them into a base
    // letter + combining mark that we then strip (which would turn ü into u).
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Now decompose remaining accents (é, ñ, …) and drop the combining marks.
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

  return folded
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Like {@link normalizeProductName} but additionally drops generic stop-words.
 * Useful as a looser key for fuzzy candidate search.
 */
export function normalizeProductNameLoose(input: string): string {
  return normalizeProductName(input)
    .split(' ')
    .filter((token) => token.length > 0 && !GENERIC_WORDS.has(token))
    .join(' ');
}

/** Tokenize a normalized name into a set of meaningful tokens. */
export function tokenize(input: string): Set<string> {
  return new Set(
    normalizeProductName(input)
      .split(' ')
      .filter((t) => t.length > 1 && !GENERIC_WORDS.has(t)),
  );
}

/**
 * Jaccard similarity over token sets — 0 (disjoint) to 1 (identical).
 * Cheap, language-agnostic, and good enough to surface "did you mean" candidates
 * in the MVP before we reach for pg_trgm / embeddings.
 */
export function tokenSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Try to extract a brand from a product name using a small known-brand list.
 * Conservative: returns undefined unless a known brand token is present.
 * (Real brand resolution will later move to the AI / data layer.)
 */
const KNOWN_BRANDS = [
  'mova',
  'dyson',
  'roborock',
  'delonghi',
  'cybex',
  'samsung',
  'apple',
  'macbook',
  'sungrow',
  'fox ess',
  'fox',
  'bosch',
  'siemens',
  'philips',
  'xiaomi',
  'sony',
  'lg',
  'miele',
  'jura',
  'tefal',
  'anker',
  'logitech',
];

export function guessBrand(rawName: string): string | undefined {
  const normalized = normalizeProductName(rawName);
  for (const brand of KNOWN_BRANDS) {
    const b = normalizeProductName(brand);
    if (normalized === b || normalized.startsWith(`${b} `) || normalized.includes(` ${b} `)) {
      // Return a nicely-cased version: capitalize each word.
      return brand
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  return undefined;
}

export interface SimilarityThresholds {
  /** At/above this similarity, treat as the same product (auto-suggest strongly). */
  duplicate: number;
  /** At/above this, surface as a possible match / merge candidate. */
  candidate: number;
}

export const DEFAULT_SIMILARITY_THRESHOLDS: SimilarityThresholds = {
  duplicate: 0.85,
  candidate: 0.5,
};
