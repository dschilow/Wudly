import { detectProduct } from './adapters';
import { mountOverlay, removeOverlay } from './overlay';
import type { DetectedProduct, LookupResult } from './types';

/**
 * Orchestration only: detect the product on the page, ask the background
 * worker to resolve it, render the overlay.
 *
 * Shops are SPAs (MediaMarkt/Otto render client-side, JSON-LD arrives with
 * hydration, sometimes seconds after document_idle), so detection RETRIES
 * with a backoff instead of running once, and re-arms on every URL change —
 * there is no pushState navigation event available to content scripts.
 */

const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 6000];

let lastHref = '';
let runToken = 0;

async function detectWithRetries(): Promise<void> {
  const token = ++runToken;
  for (let attempt = 0; ; attempt++) {
    if (token !== runToken) return; // a newer navigation superseded this run
    const product = detectProduct(document, location.href);
    if (product) {
      debug('detected', product);
      await resolveAndRender(product, token);
      return;
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      debug('no product found after retries');
      removeOverlay();
      return;
    }
    await sleep(delay);
  }
}

async function resolveAndRender(product: DetectedProduct, token: number): Promise<void> {
  const result = await lookup(product);
  if (token !== runToken) return;
  debug('resolution', result);
  if (!result || result.status === 'rejected') {
    removeOverlay();
    return;
  }
  mountOverlay(product, result, (p) => void engage(p));
}

function lookup(product: DetectedProduct): Promise<LookupResult> {
  return chrome.runtime
    .sendMessage({ kind: 'wudly:lookup', payload: product })
    .catch((err) => {
      debug('lookup failed', err);
      return null;
    });
}

function engage(product: DetectedProduct): void {
  void chrome.runtime.sendMessage({ kind: 'wudly:engage', payload: product }).catch(() => null);
}

function onUrlMaybeChanged(): void {
  if (location.href === lastHref) return;
  lastHref = location.href;
  removeOverlay();
  void detectWithRetries();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Diagnosis for "why is nothing showing?" — visible via DevTools console. */
function debug(...args: unknown[]): void {
  console.debug('[Wudly Signal]', ...args);
}

lastHref = location.href;
void detectWithRetries();
setInterval(onUrlMaybeChanged, 1_500);
