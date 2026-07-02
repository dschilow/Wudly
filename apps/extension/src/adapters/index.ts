import type { DetectedProduct } from '../types';
import { detectFromJsonLd } from './jsonld';
import { detectFromAmazon } from './amazon';

/**
 * Detect the product on the current page. JSON-LD first (robust, structured,
 * covers every non-Amazon shop in the manifest), then the per-shop DOM
 * adapters. Returns null on non-product pages — the content script renders
 * and sends nothing in that case.
 */
export function detectProduct(doc: Document, href: string): DetectedProduct | null {
  const fromJsonLd = detectFromJsonLd(doc);
  if (fromJsonLd) return fromJsonLd;

  if (/(^|\.)amazon\./.test(new URL(href).hostname)) {
    return detectFromAmazon(doc, href);
  }
  return null;
}
