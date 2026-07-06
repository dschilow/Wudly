import type { DetectedProduct } from '../types';
import { cleanUrl, visibleProductHeading } from './jsonld';

/**
 * MediaMarkt/Saturn are SPA-heavy and can leave the previous product's JSON-LD
 * in the document after navigation. The visible h1 and URL article number are
 * the freshest signals, so use them before structured data on those shops.
 */
export function detectFromMediaSaturn(doc: Document, href: string): DetectedProduct | null {
  const url = new URL(href);
  if (!isMediaSaturn(url.hostname) || !url.pathname.includes('/product/')) return null;

  const title = visibleProductHeading(doc);
  if (!title || title.length < 4) return null;

  const sku = skuFromUrl(url.pathname) ?? skuFromText(doc.body?.innerText ?? '');

  return {
    ...(sku ? { identifierType: 'SKU' as const, identifierValue: sku } : {}),
    title: title.slice(0, 300),
    brand: brandFromTitle(title),
    imageUrl: imageFrom(doc, title),
    productUrl: cleanUrl(href),
    domain: url.hostname,
    rating: ratingFromText(doc.body?.innerText ?? ''),
  };
}

function isMediaSaturn(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'mediamarkt.de' || host.endsWith('.mediamarkt.de') || host === 'saturn.de' || host.endsWith('.saturn.de');
}

function skuFromUrl(pathname: string): string | undefined {
  return pathname.match(/-(\d{5,})\.html(?:$|[?#])?/i)?.[1];
}

function skuFromText(text: string): string | undefined {
  return text.match(/Art\.-?Nr\.\s*(\d{5,})/i)?.[1];
}

function brandFromTitle(title: string): string | undefined {
  const first = title.trim().split(/\s+/)[0];
  if (!first || first.length > 40) return undefined;
  return first.replace(/[^\p{L}\p{N}-]/gu, '') || undefined;
}

function imageFrom(doc: Document, title: string): string | undefined {
  const og = doc.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="og:image"]')?.content;
  if (og?.startsWith('http')) return og.slice(0, 600);

  const brand = brandFromTitle(title)?.toLowerCase();
  const img = Array.from(doc.querySelectorAll<HTMLImageElement>('img')).find((candidate) => {
    const haystack = `${candidate.alt} ${candidate.src}`.toLowerCase();
    return Boolean(candidate.src?.startsWith('http')) && (!brand || haystack.includes(brand));
  });
  return img?.src?.startsWith('http') ? img.src.slice(0, 600) : undefined;
}

function ratingFromText(text: string): DetectedProduct['rating'] {
  const rating = text.match(/\b([1-5][,.]\d)\s*★/);
  if (!rating) return undefined;
  const value = Number.parseFloat(rating[1]!.replace(',', '.'));
  if (!Number.isFinite(value)) return undefined;

  const countText = text.match(/\(([\d.]+)\s+Bewertungen\)/i)?.[1];
  const count = countText ? Number.parseInt(countText.replace(/\./g, ''), 10) : NaN;
  return { value, maxValue: 5, ...(Number.isFinite(count) && count > 0 ? { count } : {}) };
}
