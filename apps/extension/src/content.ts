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
/**
 * Once a page state is answered, run the adapters at most this often. Shop
 * pages mutate continuously (carousels, lazy images, price tickers) and each
 * mutation lands in check(); detection reads the rendered page text, which
 * costs a layout pass. Throttling instead of stopping keeps late-arriving
 * structured data (SPA shops inject JSON-LD after the heading) discoverable.
 */
const SETTLED_DETECT_MS = 750;
/** Backoff after a failed lookup — never hammer a cold-starting API. */
const RETRY_AFTER_MS = 15_000;

let lastHref = location.href;
let lastPageFingerprint = pageFingerprint(document, location.href);
/** Identity currently rendered in the overlay (null = nothing shown). */
let renderedKey: string | null = null;
/** Identity currently being resolved against the API. */
let resolvingKey: string | null = null;
/** Identity the API answered with "show nothing" — asking again is pointless. */
let silentKey: string | null = null;
/** Last product identity detected, even if no overlay was rendered yet. */
let lastDetectedKey: string | null = null;
let lastDetectedTitle: string | null = null;
/** Set on every page change: when it happened and what was shown before. */
let navAt = 0;
let keyBeforeNav: string | null = null;
let titleBeforeNav: string | null = null;
let navRecheckUntil = 0;
let runToken = 0;
let debounceTimer: number | undefined;
/** When the adapters last ran, and when a failed lookup may be retried. */
let lastDetectAt = 0;
let retryAfter = 0;
/**
 * True until the first lookup of this document. A reload (or a bfcache
 * restore, or the toolbar icon) is how a user asks "and NOW?" — such a lookup
 * must reach the API instead of being answered from the worker's short-lived
 * cache with a stale "Wudly kennt es noch nicht".
 */
let freshLoad = true;

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
    titleBeforeNav = lastDetectedTitle;
    renderedKey = null;
    resolvingKey = null;
    silentKey = null;
    retryAfter = 0;
    runToken++; // cancel any in-flight resolution for the old page
    removeOverlay();
    clearBadge(); // the old page's ✓ must not linger on the new one
    debug('page change →', lastHref, fingerprint);
  } else if (
    (renderedKey !== null || resolvingKey !== null || silentKey !== null) &&
    now - lastDetectAt < SETTLED_DETECT_MS
  ) {
    return; // answered page state, and the adapters just ran — see SETTLED_DETECT_MS
  }

  lastDetectAt = now;
  const product = detectProduct(document, location.href);
  if (!product) return; // Product data may still be loading; observer/poll will re-fire.

  const key = identityOf(product);
  lastDetectedKey = key;
  lastDetectedTitle = product.title;
  // Stale-DOM guard: same product as before the navigation, detected right
  // after it -> almost certainly old page data. URL-derived identities like
  // ASIN/SKU are considered fresh because they come from the current URL.
  const staleWindow = now - navAt < STALE_GRACE_MS;
  const urlBacked = product.identifierType === 'ASIN' || product.identifierType === 'SKU';
  if (!urlBacked && key === keyBeforeNav && staleWindow) {
    debug('ignoring stale detection after page change:', key);
    return;
  }
  // Mixed-detection guard (any shop): the identifier already comes from the
  // NEW URL while the DOM still shows the OLD product's title. Such a hybrid
  // must never reach the API — the server would resolve the old title and
  // bind the new identifier to the wrong product. Wait until the DOM catches up.
  if (staleWindow && titleBeforeNav !== null && product.title === titleBeforeNav && key !== keyBeforeNav) {
    debug('ignoring mixed detection (new URL, old DOM title):', key);
    return;
  }
  if (key === renderedKey || key === resolvingKey || key === silentKey) return;
  // A failed lookup (offline, cold-starting API) must not turn every following
  // DOM mutation into another request.
  if (now < retryAfter) return;

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
  const fresh = freshLoad;
  freshLoad = false;
  const { result, error } = await lookup(product, fresh);
  if (token !== runToken) return; // superseded by a newer navigation/detection
  if (error) debug('lookup FEHLGESCHLAGEN:', error);
  else debug('resolution', result);
  resolvingKey = null;
  if (!result) {
    // No answer at all (network/API problem) — back off, then try again.
    retryAfter = Date.now() + RETRY_AFTER_MS;
    removeOverlay();
    return;
  }
  retryAfter = 0;
  if (result.status === 'rejected') {
    // A deliberate "show nothing" (junk title, hidden product). Final for this
    // identity — re-asking on every mutation would only burn the rate limit.
    silentKey = key;
    removeOverlay();
    return;
  }
  mountOverlay(product, result, (p) => void engage(p));
  renderedKey = key;
}

function lookup(product: DetectedProduct, fresh: boolean): Promise<LookupResponse> {
  return chrome.runtime
    .sendMessage({ kind: 'wudly:lookup', payload: product, fresh })
    .then((response: LookupResponse | undefined) => response ?? { result: null })
    .catch((err) => ({ result: null, error: err instanceof Error ? err.message : String(err) }));
}

function engage(product: DetectedProduct): void {
  void chrome.runtime.sendMessage({ kind: 'wudly:engage', payload: product }).catch(() => null);
}

/** No (longer a) product here — drop the toolbar badge of the previous page. */
function clearBadge(): void {
  void chrome.runtime.sendMessage({ kind: 'wudly:clear-badge' }).catch(() => null);
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
  silentKey = null;
  retryAfter = 0; // an explicit request skips the failure backoff
  lastDetectedKey = null;
  keyBeforeNav = null; // …and overrides the stale guard
  titleBeforeNav = null;
  freshLoad = true; // …and asks the API again instead of the cache
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

// bfcache restore: the document is old, the question ("is it in Wudly now?")
// is new — treat it like a fresh load.
window.addEventListener(
  'pageshow',
  () => {
    freshLoad = true;
    scheduleCheck();
  },
  true,
);
window.addEventListener('popstate', scheduleCheck, true);
window.addEventListener('hashchange', scheduleCheck, true);
window.addEventListener('focus', scheduleCheck, true);

// A new document in this tab starts without a verdict — the previous page's
// badge would otherwise claim one until something else overwrites it.
clearBadge();
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
