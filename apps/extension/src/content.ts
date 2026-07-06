import { detectProduct } from './adapters';
import { clearDismissals, mountLoadingPill, mountOverlay, removeOverlay } from './overlay';
import type { DetectedProduct, LookupResponse, ShowMessage } from './types';

/**
 * Orchestration only: detect the product on the page, ask the background
 * worker to resolve it, render the overlay.
 *
 * Shop product pages often navigate as SPAs. The important invariant is: as
 * soon as URL or visible product heading changes, the old Wudly card must go
 * away. JSON-LD can lag behind the visible page on MediaMarkt/Saturn, so the
 * detector also validates structured data against the current heading.
 */

const DEBOUNCE_MS = 150;
const URL_POLL_MS = 150;
/** Keep checking after SPA navigation even when the DOM goes quiet. */
const NAV_RECHECK_MS = 12_000;
/** Distrust window for detections equal to the pre-navigation product. */
const STALE_GRACE_MS = 12_000;

let lastHref = location.href;
let lastPageFingerprint = pageFingerprint(document, location.href);
/** Identity currently rendered in the overlay (null = nothing shown). */
let renderedKey: string | null = null;
/** Identity currently being resolved against the API. */
let resolvingKey: string | null = null;
/** Last product identity detected, even if no overlay was rendered yet. */
let lastDetectedKey: string | null = null;
/** Set on every page change: when it happened and what was shown before. */
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
  const fingerprint = pageFingerprint(document, location.href);
  if (location.href !== lastHref || fingerprint !== lastPageFingerprint) {
    lastHref = location.href;
    lastPageFingerprint = fingerprint;
    navAt = now;
    navRecheckUntil = now + NAV_RECHECK_MS;
    keyBeforeNav = renderedKey ?? resolvingKey ?? lastDetectedKey;
    renderedKey = null;
    resolvingKey = null;
    runToken++; // cancel any in-flight resolution for the old page
    removeOverlay();
    debug('page change →', lastHref, fingerprint);
  }

  const product = detectProduct(document, location.href);
  if (!product) return; // Product data may still be loading; observer/poll will re-fire.

  const key = identityOf(product);
  lastDetectedKey = key;
  // Stale-DOM guard: same product as before the navigation, detected right
  // after it -> almost certainly old page data. URL-derived identities like
  // ASIN/SKU are considered fresh because they come from the current URL.
  const urlBacked = product.identifierType === 'ASIN' || product.identifierType === 'SKU';
  if (!urlBacked && key === keyBeforeNav && now - navAt < STALE_GRACE_MS) {
    debug('ignoring stale detection after page change:', key);
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

function pageFingerprint(doc: Document, href: string): string {
  return `${cleanPageUrl(href)}|${normalizeForFingerprint(visibleHeading(doc)).slice(0, 140)}`;
}

function cleanPageUrl(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return href;
  }
}

function visibleHeading(doc: Document): string {
  return Array.from(doc.querySelectorAll('h1'))
    .map((el) => el.textContent?.trim() ?? '')
    .filter((text) => text.length >= 4)
    .sort((a, b) => b.length - a.length)[0] ?? '';
}

function normalizeForFingerprint(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
// fires the observer, so no arrival of product data can fall through the gap.
new MutationObserver(scheduleCheck).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener('pageshow', scheduleCheck, true);
window.addEventListener('popstate', scheduleCheck, true);
window.addEventListener('hashchange', scheduleCheck, true);
window.addEventListener('focus', scheduleCheck, true);

check();
// Safety net: URL/heading changes without a useful DOM mutation are rare, but cheap to poll.
setInterval(() => {
  if (
    location.href !== lastHref ||
    pageFingerprint(document, location.href) !== lastPageFingerprint ||
    Date.now() < navRecheckUntil
  ) {
    check();
  }
}, URL_POLL_MS);
