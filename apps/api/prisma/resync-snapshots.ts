/**
 * Rebuild every product's insight snapshot from its real underlying rows.
 *
 * Why: a snapshot is the single source of truth the catalog, search AND the
 * product page read from. If a snapshot drifts from reality (stale aggregates,
 * or seeded numbers without matching experience rows), a card can claim
 * "1 von 1 würden wieder kaufen / Netz 70%" while the detail page shows 0.
 * This recomputes each snapshot with the exact production logic
 * ({@link ProductInsightsService.regenerate}) so list and detail always agree.
 *
 * Run AFTER cleanup:seed. Idempotent — safe to run repeatedly.
 *
 *   pnpm --filter @wudly/api resync:snapshots
 *   pnpm --filter @wudly/api resync:snapshots -- --limit=50   # test on a subset
 *
 * Note: regenerate may kick off a background AI summary when a provider key is
 * configured. Run without OPENROUTER_API_KEY to keep it zero-cost (dummy AI).
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductInsightsService } from '../src/products/product-insights.service';

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  const logger = new Logger('resync-snapshots');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const prisma = app.get(PrismaService);
    const insights = app.get(ProductInsightsService);

    // Skip products that were merged away — their snapshot is intentionally gone.
    const products = await prisma.product.findMany({
      where: { status: { not: 'MERGED' } },
      select: { id: true, canonicalName: true },
      orderBy: { createdAt: 'asc' },
      ...(limit ? { take: limit } : {}),
    });

    logger.warn(`Resyncing ${products.length} product snapshot(s)…`);
    let ok = 0;
    let failed = 0;
    for (const p of products) {
      try {
        await insights.regenerate(p.id);
        ok += 1;
        if (ok % 25 === 0) logger.warn(`  …${ok}/${products.length}`);
      } catch (err) {
        failed += 1;
        logger.error(`  ✗ ${p.id} (${p.canonicalName}): ${err instanceof Error ? err.message : err}`);
      }
    }
    logger.warn(`✓ Done. ${ok} resynced, ${failed} failed.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
