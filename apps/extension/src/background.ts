import type { DetectedProduct, ExtensionMessage, LookupResponse, LookupResult } from './types';
import { loadSettings } from './types';

/**
 * All network I/O lives here in the service worker: content scripts never
 * talk to the API directly (host_permissions apply to the worker, keeping the
 * shop page's CSP and CORS out of the picture).
 *
 * Privacy stance: with reporting ON the sighting POST carries product data
 * only (identifier, title, brand, image, cleaned URL, shop host) — no user or
 * install identifiers, no cookies. With reporting OFF it degrades to an
 * anonymous GET lookup that records nothing server-side.
 */

/** One 'view' per product per service-worker session — repeat SPA navigations
 *  to the same product must not inflate demand counters. */
const sessionCache = new Map<string, LookupResult>();

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse: (r: LookupResponse) => void) => {
    if (message?.kind === 'wudly:lookup') {
      void handleLookup(message.payload, sender.tab?.id)
        .then(sendResponse)
        .catch((err) => sendResponse({ result: null, error: describe(err) }));
      return true; // async response
    }
    if (message?.kind === 'wudly:engage') {
      void handleEngage(message.payload);
    }
    return undefined;
  },
);

// Toolbar-icon click = "show me the signal again" after an ×-dismissal.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  void chrome.tabs.sendMessage(tab.id, { kind: 'wudly:show' }).catch(() => {
    // no content script on this page (not a supported shop) — nothing to do
  });
});

async function handleLookup(product: DetectedProduct, tabId?: number): Promise<LookupResponse> {
  const settings = await loadSettings();
  if (!settings.enabled) return { result: null };

  const key = cacheKey(product);
  const cached = sessionCache.get(key);
  if (cached !== undefined) {
    void badge(tabId, cached);
    return { result: cached };
  }

  let result: LookupResult = null;
  let error: string | undefined;
  try {
    result = settings.reporting
      ? await postSighting(settings.apiUrl, product, 'view')
      : await resolveOnly(settings.apiUrl, product);
  } catch (err) {
    // Overlay stays silent (never break the shop page), but the REASON must
    // be visible: relayed to the page console and logged here in the worker.
    error = `${describe(err)} [API: ${settings.apiUrl}]`;
    console.warn('[Wudly Signal] lookup failed:', error);
  }
  // Cache only real answers. A failure (cold-starting API, network blip) must
  // NOT poison the session — the next page view should simply try again.
  if (result !== null) {
    if (sessionCache.size > 500) sessionCache.clear();
    sessionCache.set(key, result);
  }
  void badge(tabId, result);
  return { result, error };
}

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** Overlay interaction = strong demand signal; also warms the daily budgets. */
async function handleEngage(product: DetectedProduct): Promise<void> {
  const settings = await loadSettings();
  if (!settings.enabled || !settings.reporting) return;
  try {
    await postSighting(settings.apiUrl, product, 'engage');
  } catch {
    // fire and forget
  }
}

async function postSighting(
  apiUrl: string,
  product: DetectedProduct,
  event: 'view' | 'engage',
): Promise<LookupResult> {
  // Generous timeout: the free-tier API sleeps and needs seconds to cold-start.
  const res = await fetch(`${trim(apiUrl)}/sightings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...product, event }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
  return (await res.json()) as LookupResult;
}

async function resolveOnly(apiUrl: string, product: DetectedProduct): Promise<LookupResult> {
  const params = new URLSearchParams();
  if (product.identifierType && product.identifierValue) {
    params.set('type', product.identifierType);
    params.set('value', product.identifierValue);
  } else {
    params.set('q', product.title);
  }
  const res = await fetch(`${trim(apiUrl)}/sightings/resolve?${params}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LookupResult;
}

function cacheKey(p: DetectedProduct): string {
  return p.identifierValue
    ? `${p.identifierType}:${p.identifierValue}`
    : `${p.domain}:${p.title.toLowerCase().slice(0, 80)}`;
}

/** Toolbar badge: ✓ known, + queued for ingestion. */
async function badge(tabId: number | undefined, result: LookupResult): Promise<void> {
  if (tabId === undefined) return;
  const known = result?.status === 'known';
  const queued = result?.status === 'queued';
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: known ? '#0aa06a' : '#5b5f6d' });
    await chrome.action.setBadgeText({ tabId, text: known ? '✓' : queued ? '+' : '' });
  } catch {
    // tab already gone
  }
}

function trim(url: string): string {
  return url.replace(/\/+$/, '');
}
