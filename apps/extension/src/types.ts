import type { SightingResolutionDto } from '@wudly/shared';

/** What an adapter extracts from a shop product page. */
export interface DetectedProduct {
  identifierType?: 'EAN' | 'GTIN' | 'ASIN';
  identifierValue?: string;
  /** Raw page title — the server cleans it up, never trust it client-side either. */
  title: string;
  brand?: string;
  imageUrl?: string;
  /** Canonical product URL with query/hash (tracking) stripped. */
  productUrl?: string;
  /** Shop host, e.g. "www.mediamarkt.de". */
  domain: string;
}

/** Content script → background messages. */
export type ExtensionMessage =
  | { kind: 'wudly:lookup'; payload: DetectedProduct }
  | { kind: 'wudly:engage'; payload: DetectedProduct };

/** Background → content script: re-show a dismissed overlay (toolbar click). */
export interface ShowMessage {
  kind: 'wudly:show';
}

export type LookupResult = SightingResolutionDto | null;

/** User settings (chrome.storage.local). */
export interface Settings {
  /** Master switch — off renders nothing and sends nothing. */
  enabled: boolean;
  /**
   * Report unknown products so Wudly can add them to the catalog. Off = pure
   * anonymous lookups (GET), nothing is recorded server-side.
   */
  reporting: boolean;
  /** API base URL override for development. */
  apiUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  reporting: true,
  apiUrl: 'https://wudly-api-production.up.railway.app/api',
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}
