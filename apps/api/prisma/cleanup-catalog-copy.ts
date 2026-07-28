/**
 * Repair stored catalog copy that shipped with typos.
 *
 * Two defects reached production through the MediaMarkt import and the
 * consensus summary builder, and both are visible on public product pages
 * (and indexed by search engines):
 *
 *   1. "Woodly-Katalog" — the brand is Wudly. Written into every imported
 *      product description.
 *   2. ASCII-transliterated German ("geprueften", "haeufig", "Bildqualitaet")
 *      in descriptions and consensus summaries, next to correctly accented
 *      text in the same sentence.
 *
 * The generators are fixed, so this only heals rows written before that.
 * Matching is literal and anchored to these known strings — nothing is
 * rewritten that a human might have typed deliberately.
 *
 * Safe by default: DRY RUN unless you pass `--apply`.
 *
 *   Dry run : pnpm --filter @wudly/api cleanup:catalog-copy
 *   Apply   : pnpm --filter @wudly/api cleanup:catalog-copy -- --apply
 *
 * Target the public DB URL (e.g. from your laptop against Railway) with:
 *   SEED_USE_PUBLIC_DATABASE_URL=true DATABASE_PUBLIC_URL=... pnpm --filter @wudly/api cleanup:catalog-copy -- --apply
 */

import { PrismaClient } from '@prisma/client';

if (process.env.SEED_USE_PUBLIC_DATABASE_URL === 'true' && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient();

/**
 * Literal replacements, longest-first where one is a prefix of another.
 * Deliberately narrow: only strings the generators are known to have emitted.
 */
const REPLACEMENTS: Array<[from: string, to: string]> = [
  ['Woodly-Katalog', 'Wudly-Katalog'],
  ['Bildqualitaet/Aufloesung', 'Bildqualität/Auflösung'],
  ['geprueften', 'geprüften'],
  ['haeufig', 'häufig'],
];

function repair(value: string): string {
  return REPLACEMENTS.reduce((acc, [from, to]) => acc.split(from).join(to), value);
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'MODE: apply' : 'MODE: dry run (pass --apply to write)');

  const products = await prisma.product.findMany({
    select: { id: true, canonicalName: true, description: true },
  });
  const consensuses = await prisma.externalConsensus.findMany({
    select: { id: true, productId: true, summary: true },
  });

  let productHits = 0;
  for (const product of products) {
    if (!product.description) continue;
    const fixed = repair(product.description);
    if (fixed === product.description) continue;
    productHits++;
    console.log(`  product ${product.id}  ${product.canonicalName}`);
    if (apply) {
      await prisma.product.update({ where: { id: product.id }, data: { description: fixed } });
    }
  }

  let consensusHits = 0;
  for (const consensus of consensuses) {
    if (!consensus.summary) continue;
    const fixed = repair(consensus.summary);
    if (fixed === consensus.summary) continue;
    consensusHits++;
    console.log(`  consensus ${consensus.id}  (product ${consensus.productId})`);
    if (apply) {
      await prisma.externalConsensus.update({
        where: { id: consensus.id },
        data: { summary: fixed },
      });
    }
  }

  console.log(
    `\n${apply ? 'Repaired' : 'Would repair'}: ${productHits} Beschreibung(en), ${consensusHits} Konsens-Zusammenfassung(en).`,
  );
  if (!apply && productHits + consensusHits > 0) {
    console.log('Nothing was written. Re-run with -- --apply to persist.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
