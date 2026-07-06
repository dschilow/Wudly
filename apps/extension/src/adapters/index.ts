import type { DetectedProduct } from '../types';
import { detectFromJsonLd } from './jsonld';
import { detectFromAmazon } from './amazon';
import { detectFromMediaSaturn } from './media-saturn';

/**
 * Detect the product on the current page. MediaMarkt/Saturn get a DOM-first
 * adapter because their SPA navigation can keep stale JSON-LD around. Other
 * shops use JSON-LD first; Amazon has a URL/DOM adapter for ASIN pages.
 */
export function detectProduct(doc: Document, href: string): DetectedProduct | null {
  const url = new URL(href);

  const fromMediaSaturn = detectFromMediaSaturn(doc, href);
  if (fromMediaSaturn) return fromMediaSaturn;

  if (/(^|\.)amazon\./.test(url.hostname)) {
    return detectFromAmazon(doc, href);
  }

  const fromJsonLd = detectFromJsonLd(doc, href);
  if (fromJsonLd) return fromJsonLd;

  return null;
}
