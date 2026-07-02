import { detectProduct } from './adapters';
import { mountOverlay, removeOverlay } from './overlay';
import type { DetectedProduct, LookupResult } from './types';

/**
 * Orchestration only: detect the product on the page, ask the background
 * worker to resolve it, render the overlay. Re-runs on SPA navigations
 * (MediaMarkt/Otto render product pages client-side) via a cheap URL poll —
 * there is no navigation event for pushState available to content scripts.
 */

let lastHref = '';
let running = false;

async function run(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const product = detectProduct(document, location.href);
    if (!product) {
      removeOverlay();
      return;
    }
    const result = await lookup(product);
    if (!result || result.status === 'rejected') {
      removeOverlay();
      return;
    }
    mountOverlay(product, result, (p) => void engage(p));
  } finally {
    running = false;
  }
}

function lookup(product: DetectedProduct): Promise<LookupResult> {
  return chrome.runtime
    .sendMessage({ kind: 'wudly:lookup', payload: product })
    .catch(() => null);
}

function engage(product: DetectedProduct): void {
  void chrome.runtime.sendMessage({ kind: 'wudly:engage', payload: product }).catch(() => null);
}

function onUrlMaybeChanged(): void {
  if (location.href === lastHref) return;
  lastHref = location.href;
  removeOverlay();
  // Give the SPA a moment to render the new product before detecting.
  setTimeout(() => void run(), 800);
}

lastHref = location.href;
void run();
setInterval(onUrlMaybeChanged, 1_500);
