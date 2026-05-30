import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ProductInsightsService } from '../src/products/product-insights.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { DummyAiService } from '../src/ai/dummy-ai.service';
import { testPrisma } from './prisma-test.util';

/**
 * Integration test for snapshot generation against the seeded local database.
 * Uses the deterministic DummyAiService so the suite stays hermetic (no network).
 * Requires `pnpm db:seed`.
 */
describe('ProductInsightsService (integration)', () => {
  let service: ProductInsightsService;

  beforeAll(async () => {
    await testPrisma.$connect();
    service = new ProductInsightsService(
      testPrisma as unknown as PrismaService,
      new DummyAiService(),
    );
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it('computes a perfect rebuy score for an all-positive product', async () => {
    const product = await testPrisma.product.findFirstOrThrow({
      where: { canonicalName: 'Apple MacBook Air' },
    });
    const insights = await service.regenerate(product.id);
    expect(insights.rebuyScore).toBe(100);
    expect(insights.regretScore).toBe(0);
    expect(insights.experienceCount).toBeGreaterThanOrEqual(3);
    expect(insights.ownerCount).toBeGreaterThanOrEqual(3);
  });

  it('computes a high regret score for a defective/regret product', async () => {
    const product = await testPrisma.product.findFirstOrThrow({
      where: { canonicalName: 'Fox ESS EK10' },
    });
    const insights = await service.regenerate(product.id);
    expect(insights.regretScore).toBeGreaterThan(40);
    expect(insights.rebuyScore).toBeLessThan(50);
  });

  it('surfaces top aspects and wish-known highlights', async () => {
    const product = await testPrisma.product.findFirstOrThrow({
      where: { canonicalName: 'Dyson V15 Detect Absolute' },
    });
    const insights = await service.regenerate(product.id);
    const positiveKeys = insights.topPositiveAspects.map((a) => a.key);
    expect(positiveKeys).toContain('saugkraft');
    expect(insights.wishKnownHighlights.length).toBeGreaterThan(0);
    // Aspect labels should be resolved from the category vocabulary, not raw keys.
    const saugkraft = insights.topPositiveAspects.find((a) => a.key === 'saugkraft');
    expect(saugkraft?.label).toBe('Saugkraft');
  });

  it('returns a null-score snapshot for a product with no experiences', async () => {
    const created = await testPrisma.product.create({
      data: {
        canonicalName: `Empty Test Product ${Date.now()}`,
        normalizedName: `empty test product ${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    try {
      const insights = await service.regenerate(created.id);
      expect(insights.rebuyScore).toBeNull();
      expect(insights.experienceCount).toBe(0);
    } finally {
      await testPrisma.productInsightSnapshot.deleteMany({ where: { productId: created.id } });
      await testPrisma.product.delete({ where: { id: created.id } });
    }
  });
});
