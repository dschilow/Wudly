import type { DetectedProduct } from '../types';
import { cleanUrl } from './jsonld';

/**
 * Amazon exposes no Product JSON-LD, so this is the one shop with a real DOM
 * adapter. The ASIN comes from the URL (stable), title/brand/image from the
 * few DOM anchors that have survived years of redesigns. Server-side, ASIN
 * sightings deliberately wait for demand before any (paid) AI research — the
 * titles are keyword spam and need the AI cleanup.
 */
export function detectFromAmazon(doc: Document, href: string): DetectedProduct | null {
  const asin = asinFromUrl(href);
  if (!asin) return null;

  const title = doc.querySelector('#productTitle')?.textContent?.trim();
  if (!title || title.length < 4) return null;

  return {
    identifierType: 'ASIN',
    identifierValue: asin,
    title: title.slice(0, 300),
    brand: brandFromByline(doc),
    imageUrl: imageFrom(doc),
    // Canonical /dp/<ASIN> path — never the raw href (slug + tracking params).
    productUrl: cleanUrl(`${new URL(href).origin}/dp/${asin}`),
    domain: new URL(href).hostname,
    rating: ratingFromDom(doc),
  };
}

/**
 * Star rating from the review widget: "#acrPopover" carries "4,4 von 5
 * Sternen" in its title, "#acrCustomerReviewText" reads "1.234
 * Sternebewertungen" (German thousands dots).
 */
function ratingFromDom(doc: Document): DetectedProduct['rating'] {
  const popover = doc.querySelector('#acrPopover')?.getAttribute('title') ?? '';
  const match = popover.match(/([\d.,]+)\s+von\s+([\d.,]+)/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]!.replace(',', '.'));
  const maxValue = Number.parseFloat(match[2]!.replace(',', '.'));
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || value > maxValue) return undefined;

  const countText = doc.querySelector('#acrCustomerReviewText')?.textContent ?? '';
  const countDigits = countText.match(/[\d.,]+/)?.[0]?.replace(/[.,]/g, '');
  const count = countDigits ? Number.parseInt(countDigits, 10) : NaN;
  return { value, maxValue, ...(Number.isFinite(count) && count > 0 ? { count } : {}) };
}

/** /dp/B0ABC12345, /gp/product/B0ABC12345, /-/dp/B0ABC12345/… */
export function asinFromUrl(href: string): string | undefined {
  const match = href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?#]|$)/i);
  return match?.[1]?.toUpperCase();
}

/** "#bylineInfo" reads "Marke: Sony" or "Besuche den Sony-Store". */
function brandFromByline(doc: Document): string | undefined {
  const byline = doc.querySelector('#bylineInfo')?.textContent?.trim();
  if (!byline) return undefined;
  const marke = byline.match(/^Marke:\s*(.+)$/i)?.[1];
  if (marke) return marke.trim().slice(0, 80);
  const store = byline.match(/^Besuche(?:n Sie)? den\s+(.+?)[- ]Store$/i)?.[1];
  return store?.trim().slice(0, 80);
}

function imageFrom(doc: Document): string | undefined {
  const src = doc.querySelector<HTMLImageElement>('#landingImage, #imgBlkFront')?.src;
  return src?.startsWith('http') ? src.slice(0, 600) : undefined;
}
