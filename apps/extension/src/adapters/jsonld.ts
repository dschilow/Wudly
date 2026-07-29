import type { DetectedProduct } from '../types';

/**
 * Generic schema.org adapter. Structured product data is reliable only when it
 * matches the visible page. Some SPA shops leave the previous page's JSON-LD in
 * the DOM for a while, so candidates are checked against URL and h1 first.
 */
export function detectFromJsonLd(doc: Document, href = location.href): DetectedProduct | null {
  for (const product of productNodes(doc)) {
    if (!isCurrentPageProduct(product, doc, href)) continue;
    const detected = toDetected(product, href);
    if (detected) return detected;
  }
  return null;
}

/** Every parseable product node in the document, in document order. */
function* productNodes(doc: Document): Generator<Record<string, unknown>> {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue; // shops ship broken JSON-LD all the time; skip, don't die
    }
    const product = findProductNode(parsed, 0);
    if (product) yield product;
  }
}

/**
 * The page's GTIN — under a deliberately STRICTER rule than the generic
 * adapter uses. A GTIN is a worldwide identity: reading a stale one off an
 * SPA page would bind this shop page to a completely different product in the
 * catalog, permanently. So the node must PROVE it describes this page, either
 * by carrying this exact URL path or the shop article number from the URL.
 * "Same brand word in the heading" is not proof and is not accepted here.
 *
 * Worth the strictness: a GTIN lifts a sighting onto the free catalog path
 * (Icecat & co.) and lets it merge with the same product seen in other shops —
 * a shop article number can do neither.
 */
export function strictGtinForPage(
  doc: Document,
  href: string,
  shopSku?: string,
): string | undefined {
  for (const node of productNodes(doc)) {
    if (!urlPathMatches(node, href) && !skuMatches(node, shopSku)) continue;
    const gtin = gtinDigits(node);
    if (gtin) return gtin;
  }
  return undefined;
}

/** Proof #1: the node names this exact page. */
function urlPathMatches(product: Record<string, unknown>, href: string): boolean {
  const candidate = productUrl(product);
  if (!candidate) return false;
  try {
    const current = new URL(href);
    const candidateUrl = new URL(candidate, current.origin);
    return normalizePath(candidateUrl.pathname) === normalizePath(current.pathname);
  } catch {
    return false;
  }
}

/** Proof #2: the node carries the shop article number this page is served under. */
function skuMatches(product: Record<string, unknown>, shopSku?: string): boolean {
  if (!shopSku) return false;
  const wanted = shopSku.toLowerCase();
  return ['sku', 'productID', 'mpn'].some((key) => {
    const value = asString(product[key])?.trim().toLowerCase();
    return Boolean(value) && (value === wanted || value === `sku:${wanted}`);
  });
}

const PRODUCT_TYPES = new Set(['product', 'productgroup']);
/** Wrapper keys whose value can hold THE page's product node. Never variant
 *  or list keys (`hasVariant`, `itemListElement`) — those are other products. */
const CONTAINER_KEYS = ['@graph', 'object', 'mainEntity', 'itemOffered'] as const;

const GENERIC_PRODUCT_TOKENS = new Set([
  'and',
  'der',
  'die',
  'das',
  'ein',
  'eine',
  'for',
  'fur',
  'fuer',
  'mit',
  'oder',
  'und',
  'cm',
  'flat',
  'hd',
  'led',
  'neu',
  'oled',
  'produkt',
  'qled',
  'smart',
  'tv',
  'uhd',
  'ultra',
  'wlan',
  'zoll',
  'fernseher',
]);

/** Depth-first search through arrays and known wrapper keys for a product node. */
function findProductNode(node: unknown, depth: number): Record<string, unknown> | null {
  if (depth > 4 || node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === 'string' && PRODUCT_TYPES.has(t.toLowerCase()))) return obj;
  for (const key of CONTAINER_KEYS) {
    if (obj[key]) {
      const found = findProductNode(obj[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function isCurrentPageProduct(product: Record<string, unknown>, doc: Document, href: string): boolean {
  const title = asString(product.name)?.trim();
  if (!title) return false;
  if (!candidateUrlMatches(product, href)) return false;

  const heading = visibleProductHeading(doc);
  if (!heading) return true;
  return looksLikeSameProduct(title, heading);
}

function candidateUrlMatches(product: Record<string, unknown>, href: string): boolean {
  const candidate = productUrl(product);
  if (!candidate) return true;
  try {
    const current = new URL(href);
    const candidateUrl = new URL(candidate, current.origin);
    if (!/^https?:$/.test(candidateUrl.protocol)) return true;
    return normalizePath(candidateUrl.pathname) === normalizePath(current.pathname);
  } catch {
    return true;
  }
}

function productUrl(product: Record<string, unknown>): string | undefined {
  const direct = asUrlCandidate(product.url) ?? asUrlCandidate(product['@id']);
  if (direct) return direct;
  const offers = product.offers;
  if (offers && typeof offers === 'object' && !Array.isArray(offers)) {
    return asUrlCandidate((offers as Record<string, unknown>).url);
  }
  return undefined;
}

function asUrlCandidate(value: unknown): string | undefined {
  const text = asString(value)?.trim();
  if (!text) return undefined;
  return /^(https?:)?\/\//i.test(text) || text.startsWith('/') ? text : undefined;
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '').toLowerCase();
}

function looksLikeSameProduct(candidateTitle: string, pageHeading: string): boolean {
  const candidateTokens = significantTokens(candidateTitle);
  const pageTokens = new Set(significantTokens(pageHeading));
  if (candidateTokens.length === 0 || pageTokens.size === 0) return true;
  return candidateTokens.some((token) => pageTokens.has(token));
}

function significantTokens(value: string): string[] {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return normalized
    .split(/\s+/)
    .filter((token) => {
      if (token.length < 3) return false;
      if (GENERIC_PRODUCT_TOKENS.has(token)) return false;
      if (/^\d+$/.test(token)) return false;
      return true;
    });
}

export function visibleProductHeading(doc: Document): string {
  return Array.from(doc.querySelectorAll('h1'))
    .map((el) => el.textContent?.trim() ?? '')
    .filter((text) => text.length >= 4)
    .sort((a, b) => b.length - a.length)[0] ?? '';
}

function toDetected(product: Record<string, unknown>, href: string): DetectedProduct | null {
  const title = asString(product.name);
  if (!title || title.trim().length < 4) return null;

  const digits = gtinDigits(product);

  return {
    ...(digits ? { identifierType: 'GTIN' as const, identifierValue: digits } : {}),
    title: title.trim().slice(0, 300),
    brand: brandName(product.brand),
    imageUrl: imageUrl(product.image),
    productUrl: cleanUrl(href),
    domain: new URL(href).hostname,
    rating: ratingFrom(product.aggregateRating),
  };
}

/** GTIN/EAN of a product node, digits only, valid lengths only (GTIN-8…14). */
function gtinDigits(product: Record<string, unknown>): string | undefined {
  const raw =
    asString(product.gtin13) ??
    asString(product.gtin) ??
    asString(product.gtin14) ??
    asString(product.gtin12) ??
    asString(product.gtin8) ??
    asString(product.ean);
  const digits = raw?.replace(/[^0-9]/g, '');
  return digits && digits.length >= 8 && digits.length <= 14 ? digits : undefined;
}

/**
 * Shop rating facts from schema.org `aggregateRating` — average, scale and
 * review count. These become an attributed shop-rating entry server-side.
 */
export function ratingFrom(agg: unknown): DetectedProduct['rating'] {
  if (!agg || typeof agg !== 'object' || Array.isArray(agg)) return undefined;
  const obj = agg as Record<string, unknown>;
  const value = asNumber(obj.ratingValue);
  const maxValue = asNumber(obj.bestRating) ?? 5;
  const count = asCount(obj.ratingCount) ?? asCount(obj.reviewCount);
  if (value === undefined || value < 0 || value > maxValue || maxValue > 100) return undefined;
  return {
    value,
    maxValue,
    ...(count !== undefined && count > 0 ? { count } : {}),
  };
}

/**
 * Review counts, which German shops write with thousands dots ("1.204").
 * Deliberately NOT asNumber: that reads "1.204" as one-point-two-oh-four,
 * i.e. 1 review — and the server drops ratings below its minimum count, so a
 * well-reviewed product would silently lose its shop rating entirely.
 */
function asCount(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : undefined;
  if (typeof v !== 'string') return undefined;
  const digits = v.replace(/[^0-9]/g, '');
  return digits ? Number.parseInt(digits, 10) : undefined;
}

/** Numbers arrive as numbers or strings, German pages with a decimal comma. */
function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const parsed = Number.parseFloat(v.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function brandName(brand: unknown): string | undefined {
  if (typeof brand === 'string') return brand.trim() || undefined;
  if (brand && typeof brand === 'object' && !Array.isArray(brand)) {
    return asString((brand as Record<string, unknown>).name)?.trim() || undefined;
  }
  return undefined;
}

function imageUrl(image: unknown): string | undefined {
  const first = Array.isArray(image) ? image[0] : image;
  if (typeof first === 'string' && first.startsWith('http')) return first.slice(0, 600);
  if (first && typeof first === 'object') {
    const url = asString((first as Record<string, unknown>).url);
    if (url?.startsWith('http')) return url.slice(0, 600);
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Privacy: never send query strings or fragments — they carry tracking data. */
export function cleanUrl(href: string): string | undefined {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`.slice(0, 600);
  } catch {
    return undefined;
  }
}
