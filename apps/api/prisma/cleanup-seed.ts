/**
 * Remove synthetic "runtime seed" products from a database.
 *
 * These have ids like `runtime_seed_product_162` and carry fabricated insight
 * snapshots (a rebuy score + experience count) WITHOUT matching experience
 * rows — so the catalog/search shows numbers that the product page can't back
 * up. They must not exist in production.
 *
 * Safe by default: this is a DRY RUN unless you pass `--apply`. All Product
 * child rows cascade-delete (snapshots, experiences, votes, questions, images…),
 * so deleting the products is sufficient.
 *
 *   Dry run : pnpm --filter @wudly/api cleanup:seed
 *   Apply   : pnpm --filter @wudly/api cleanup:seed -- --apply
 *
 * Target the public DB URL (e.g. from your laptop against Railway) with:
 *   SEED_USE_PUBLIC_DATABASE_URL=true DATABASE_PUBLIC_URL=... pnpm --filter @wudly/api cleanup:seed -- --apply
 */

import { PrismaClient } from '@prisma/client';

if (process.env.SEED_USE_PUBLIC_DATABASE_URL === 'true' && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient();

/** Synthetic products are the only ones whose id is not a cuid — they share this prefix. */
const SEED_ID_PREFIX = 'runtime_seed';

async function main() {
  const apply = process.argv.includes('--apply');

  const where = { id: { startsWith: SEED_ID_PREFIX } } as const;

  const total = await prisma.product.count({ where });
  if (total === 0) {
    console.warn('✓ No synthetic runtime-seed products found. Nothing to do.');
    return;
  }

  const sample = await prisma.product.findMany({
    where,
    select: { id: true, canonicalName: true, brand: true },
    take: 15,
    orderBy: { createdAt: 'asc' },
  });

  console.warn(`Found ${total} synthetic product(s) matching id prefix "${SEED_ID_PREFIX}".`);
  console.warn('Sample:');
  for (const p of sample) {
    console.warn(`  · ${p.id}  —  ${[p.brand, p.canonicalName].filter(Boolean).join(' ')}`);
  }
  if (total > sample.length) console.warn(`  … and ${total - sample.length} more.`);

  if (!apply) {
    console.warn('');
    console.warn('DRY RUN — nothing deleted. Re-run with "-- --apply" to delete these products');
    console.warn('(all related snapshots, experiences, votes, questions and images cascade).');
    return;
  }

  const { count } = await prisma.product.deleteMany({ where });
  console.warn('');
  console.warn(`✓ Deleted ${count} synthetic product(s) and all their cascaded rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
