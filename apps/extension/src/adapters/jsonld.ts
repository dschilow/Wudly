import type { DetectedProduct } from '../types';

/**
 * Generic schema.org adapter: most German shops (MediaMarkt, Saturn, Otto,
 * Kaufland, Cyberport, …) embed a JSON-LD `Product` with gtin/brand/name.
 * Parsing structured data instead of the DOM survives shop redesigns — DOM
 * selectors are only ever a per-shop fallback, never the primary path.
 */
export function detectFromJsonLd(doc: Document): DetectedProduct | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue; // shops ship broken JSON-LD all the time — skip, don't die
    }
    const product = findProductNode(parsed, 0);
    if (!product) continue;
    const detected = toDetected(product);
    if (detected) return detected;
  }
  return null;
}

/** Depth-first search through arrays / @graph nesting for a Product node. */
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
  if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'product')) return obj;
  if (obj['@graph']) return findProductNode(obj['@graph'], depth + 1);
  return null;
}

function toDetected(product: Record<string, unknown>): DetectedProduct | null {
  const title = asString(product.name);
  if (!title || title.trim().length < 4) return null;

  const gtin =
    asString(product.gtin13) ??
    asString(product.gtin) ??
    asString(product.gtin14) ??
    asString(product.gtin8) ??
    asString(product.ean);
  const digits = gtin?.replace(/[^0-9]/g, '');

  return {
    ...(digits && digits.length >= 8 && digits.length <= 14
      ? { identifierType: 'GTIN' as const, identifierValue: digits }
      : {}),
    title: title.trim().slice(0, 300),
    brand: brandName(product.brand),
    imageUrl: imageUrl(product.image),
    productUrl: cleanUrl(location.href),
    domain: location.hostname,
  };
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
