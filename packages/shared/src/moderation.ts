/**
 * Lightweight content moderation for public surfaces (rankings, radar, regret cards).
 *
 * Wudly is about durable consumer goods — "would you buy it again after months of
 * use?". Food, drink, tobacco and the like don't fit that promise and erode trust
 * when they top the regret charts (e.g. a vodka brand sitting next to child car
 * seats). We don't delete such products; we just keep them out of public rankings.
 *
 * Pure & dependency-free so both API (query filtering) and web (defensive UI) can
 * share one source of truth.
 */

import { normalizeProductName } from './normalize';

/**
 * Category slugs that must never appear in public rankings. These are the
 * consumables / regulated goods that don't match the "rebuy after long use" model.
 */
export const EXCLUDED_RANKING_CATEGORY_SLUGS: ReadonlySet<string> = new Set([
  'lebensmittel',
  'getraenke',
  'getränke',
  'alkohol',
  'spirituosen',
  'wein',
  'bier',
  'tabak',
  'zigaretten',
  'nahrungsergaenzung',
  'nahrungsergänzung',
  'supplements',
  'medikamente',
  'drogerie-verbrauch',
]);

/**
 * Keyword fragments scanned against the normalized product name. Catches
 * user-created products that have no category (or a free-text one) — e.g.
 * "Wodka Gorbatschow". Kept conservative to avoid false positives on durables.
 */
// Substring keywords are distinctive enough to match anywhere; word-ish ones are
// space-padded (handled below) so they don't false-positive inside other words
// (e.g. "wein" must not match "Weinberger Werkzeugkoffer").
const EXCLUDED_NAME_KEYWORDS: readonly string[] = [
  'wodka',
  'vodka',
  'whisky',
  'whiskey',
  'gorbatschow',
  ' gin ',
  ' rum ',
  'tequila',
  'likoer',
  'likör',
  'schnaps',
  ' bier ',
  ' wein ',
  ' sekt ',
  'prosecco',
  'champagner',
  'zigarette',
  'zigaretten',
  ' tabak ',
  'energy drink',
  'energydrink',
  ' cola ',
  'limonade',
  'nahrungsergaenzung',
  'proteinpulver',
  'protein pulver',
];

/** Minimal shape needed to decide visibility. */
export interface ModeratableProduct {
  canonicalName: string;
  categorySlug?: string | null;
}

/**
 * True when a product should be hidden from public rankings / radar / regret
 * cards. Matches either an excluded category slug or a name keyword.
 */
export function isExcludedFromRankings(product: ModeratableProduct): boolean {
  const slug = product.categorySlug?.toLowerCase().trim();
  if (slug && EXCLUDED_RANKING_CATEGORY_SLUGS.has(slug)) return true;

  const name = normalizeProductName(product.canonicalName);
  if (!name) return false;
  const padded = ` ${name} `;
  return EXCLUDED_NAME_KEYWORDS.some((kw) =>
    kw.startsWith(' ') || kw.endsWith(' ') ? padded.includes(kw) : name.includes(kw),
  );
}
