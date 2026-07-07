/**
 * Remove extension sightings whose title and product URL describe DIFFERENT
 * products — plus the identifier bindings they poisoned.
 *
 * Cause: on SPA shops (MediaMarkt/Saturn) the URL flips to the new product
 * BEFORE the DOM re-renders, so the extension could briefly detect a mix of
 * "new article number from the URL + old title from the page". The sightings
 * service then name-matched the OLD title and permanently attached the NEW
 * article number to that wrong product (`attachIdentifier`), making every
 * future lookup of the new product resolve to the old one. The extension
 * adapter now refuses mixed detections; this script cleans up rows created
 * before that fix.
 *
 * Detection: a sighting is "mixed" when its shop-URL slug carries product
 * words (brand/model tokens) and NONE of them appear in the title. URLs whose
 * path has no product words (e.g. amazon.de/dp/ASIN) cannot be judged and are
 * left alone.
 *
 * Safe by default: DRY RUN unless you pass `--apply`.
 *
 *   Dry run : pnpm --filter @wudly/api cleanup:extension-mixups
 *   Apply   : pnpm --filter @wudly/api cleanup:extension-mixups -- --apply
 *
 * Target the public DB URL (e.g. from your laptop against Railway) with:
 *   SEED_USE_PUBLIC_DATABASE_URL=true DATABASE_PUBLIC_URL=... pnpm --filter @wudly/api cleanup:extension-mixups -- --apply
 */

import { PrismaClient } from '@prisma/client';

if (process.env.SEED_USE_PUBLIC_DATABASE_URL === 'true' && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient();

/** Words that appear in almost every electronics title/slug — no identity value. */
const GENERIC_TOKENS = new Set([
  'and', 'der', 'die', 'das', 'ein', 'eine', 'for', 'fur', 'fuer', 'mit', 'oder', 'und', 'von',
  'cm', 'flat', 'curved', 'hd', 'fhd', 'uhd', 'led', 'oled', 'qled', 'lcd', 'neu', 'produkt', 'product',
  'smart', 'tv', 'ultra', 'wlan', 'wifi', 'zoll', 'inch', 'fernseher', 'ambilight', 'hdr',
  'html', 'www', 'schwarz', 'weiss', 'silber', 'grau', 'black', 'white', 'silver',
]);

function tokens(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token) && !/^\d+$/.test(token));
}

function slugTokens(productUrl: string): string[] {
  try {
    return tokens(new URL(productUrl).pathname);
  } catch {
    return [];
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const rows = await prisma.productSighting.findMany({
    where: { identifierValue: { not: null }, productUrl: { not: null } },
  });

  const mixed = rows.filter((row) => {
    const slug = slugTokens(row.productUrl!);
    if (slug.length < 2) return false; // URL carries no product words — cannot judge
    const titleTokens = new Set(tokens(row.title));
    return !slug.some((token) => titleTokens.has(token));
  });

  if (mixed.length === 0) {
    console.warn(`✓ Checked ${rows.length} sightings — no mixed rows found. Nothing to do.`);
    return;
  }

  console.warn(`Found ${mixed.length} mixed sighting(s) of ${rows.length} checked:`);
  for (const row of mixed) {
    console.warn(`  - [${row.identifierType}:${row.identifierValue}] title "${row.title.slice(0, 70)}"`);
    console.warn(`    url   ${row.productUrl}`);
  }

  if (!apply) {
    console.warn('\nDRY RUN — nothing deleted. Re-run with --apply to delete these rows');
    console.warn('and their extension-sourced identifier bindings.');
    return;
  }

  for (const row of mixed) {
    if (row.identifierType && row.identifierValue) {
      // The learned shop-identifier binding points at the wrong product; the
      // fixed extension re-learns the correct one on the next page view.
      const removed = await prisma.productIdentifier.deleteMany({
        where: { type: row.identifierType, value: row.identifierValue, source: 'extension' },
      });
      if (removed.count > 0) {
        console.warn(`  ✗ identifier ${row.identifierType}:${row.identifierValue} (${removed.count} binding)`);
      }
    }
    await prisma.productSighting.delete({ where: { id: row.id } });
    console.warn(`  ✗ sighting "${row.title.slice(0, 70)}"`);
  }
  console.warn(`✓ Deleted ${mixed.length} mixed sighting(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
