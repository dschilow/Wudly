import { detectProduct } from './adapters';
import { clearDismissals, mountLoadingPill, mountOverlay, removeOverlay } from './overlay';
import type { DetectedProduct, LookupResponse, ShowMessage } from './types';

/**
 * Orchestration only: detect the product on the page, ask the background
 * worker to resolve it, render the overlay.
 *
 * Shops are SPAs (MediaMarkt/Otto render client-side, JSON-LD arrives with
 * hydration, sometimes seconds after document_idle) and navigate via
 * pushState, which content scripts get no event for. Instead of fixed-backoff
 * polling, a debounced MutationObserver re-runs detection whenever the DOM
 * changes — so a product is recognized within ~250 ms of its JSON-LD
 * appearing, and a product SWITCH is recognized as soon as the new page
 * renders. A short URL poll keeps checking briefly after navigation as a safety net.
 *
 * Two latency traps this deliberately handles:
 *  - STALE JSON-LD: right after an SPA navigation the DOM often still carries
 *    the PREVIOUS product's data. Detections that equal the pre-navigation
 *    product are distrusted for a short grace window (URL-derived identities
 *    like Amazon ASINs are always fresh and exempt).
 *  - API cold start: a "Wudly prüft…" pill appears the moment a product is
 *    DETECTED, so the user sees a reaction even while the resolution is on a
 *    slow first round trip.
 */

const DEBOUNCE_MS = 250;
const URL_POLL_MS = 250;
/** Keep checking after SPA navigation even when the DOM goes quiet. */
const NAV_RECHECK_MS = 8_000;
/** Distrust window for detections equal to the pre-navigation product. */
const STALE_GRACE_MS = 8_000;

let lastHref = location.href;
/** Identity currently rendered in the overlay (null = nothing shown). */
let renderedKey: string | null = null;
/** Identity currently being resolved against the API. */
let resolvingKey: string | null = null;
/** Last product identity detected, even if no overlay was rendered yet. */
let lastDetectedKey: string | null = null;
/** Set on every URL change: when it happened and what was shown before. */
let navAt = 0;
let keyBeforeNav: string | null = null;
let navRecheckUntil = 0;
let runToken = 0;
let debounceTimer: number | undefined;

/** Stable client-side identity — mirrors the background worker's cache key. */
function identityOf(p: DetectedProduct): string {
  return p.identifierValue
    ? `${p.identifierType}:${p.identifierValue}`
    : `${p.domain}:${p.title.toLowerCase().slice(0, 80)}`;
}

function scheduleCheck(): void {
  if (debounceTimer !== undefined) return; // trailing-edge debounce
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined;
    check();
  }, DEBOUNCE_MS);
}

function check(): void {
  const now = Date.now();
  if (location.href !== lastHref) {
    lastHref = location.href;
    navAt = now;
    navRecheckUntil = now + NAV_RECHECK_MS;
    keyBeforeNav = renderedKey ?? resolvingKey ?? lastDetectedKey;
    renderedKey = null;
    resolvingKey = null;
    runToken++; // cancel any in-flight resolution for the old page
    removeOverlay();
    debug('navigation →', lastHref);
  }

  const product = detectProduct(document, location.href);
  if (!product) return; // JSON-LD may still be loading — the observer will re-fire

  const key = identityOf(product);
  lastDetectedKey = key;
  // Stale-DOM guard: same product as before the navigation, detected right
  // after it → almost certainly the old page's leftover JSON-LD. Skip; the
  // observer re-checks when the real data arrives (or the grace window ends).
  const urlBacked = product.identifierType === 'ASIN';
  if (!urlBacked && key === keyBeforeNav && now - navAt < STALE_GRACE_MS) {
    debug('ignoring stale detection after navigation:', key);
    return;
  }
  if (key === renderedKey || key === resolvingKey) return;

  navRecheckUntil = 0;
  debug('detected', product);
  void resolveAndRender(product, key, ++runToken);
}

async function resolveAndRender(
  product: DetectedProduct,
  key: string,
  token: number,
): Promise<void> {
  resolvingKey = key;
  mountLoadingPill(product); // instant feedback while the API (cold-)starts
  const { result, error } = await lookup(product);
  if (token !== runToken) return; // superseded by a newer navigation/detection
  if (error) debug('lookup FEHLGESCHLAGEN:', error);
  else debug('resolution', result);
  resolvingKey = null;
  if (!result || result.status === 'rejected') {
    removeOverlay();
    return;
  }
  mountOverlay(product, result, (p) => void engage(p));
  renderedKey = key;
}

function lookup(product: DetectedProduct): Promise<LookupResponse> {
  return chrome.runtime
    .sendMessage({ kind: 'wudly:lookup', payload: product })
    .then((response: LookupResponse | undefined) => response ?? { result: null })
    .catch((err) => ({ result: null, error: err instanceof Error ? err.message : String(err) }));
}

function engage(product: DetectedProduct): void {
  void chrome.runtime.sendMessage({ kind: 'wudly:engage', payload: product }).catch(() => null);
}

/** Diagnosis for "why is nothing showing?". console.info, deliberately not
 *  console.debug — DevTools hides the Verbose level by default and these lines
 *  exist precisely for users staring at a silent overlay. */
function debug(...args: unknown[]): void {
  console.info('[Wudly Signal]', ...args);
}

// Toolbar-icon click re-shows an overlay the user dismissed with ×.
chrome.runtime.onMessage.addListener((message: ShowMessage) => {
  if (message?.kind !== 'wudly:show') return;
  clearDismissals();
  renderedKey = null;
  lastDetectedKey = null;
  keyBeforeNav = null; // an explicit user request overrides the stale guard
  navRecheckUntil = Date.now() + NAV_RECHECK_MS;
  check();
});

// Observer FIRST, then the initial check — anything inserted in between still
// fires the observer, so no arrival of JSON-LD can fall through the gap.
new MutationObserver(scheduleCheck).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true, // frameworks often swap the TEXT of an existing ld+json node
});
check();
// Safety net: URL changes without any DOM mutation (rare, but cheap to poll).
setInterval(() => {
  if (location.href !== lastHref || Date.now() < navRecheckUntil) check();
}, URL_POLL_MS);
