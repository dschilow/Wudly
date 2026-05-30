import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ProductMatchingService } from '../src/products/product-matching.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { testPrisma } from './prisma-test.util';

/**
 * Integration test for product matching against the seeded local database.
 * Requires `pnpm db:seed` to have been run (the standard demo dataset).
 */
describe('ProductMatchingService (integration)', () => {
  let service: ProductMatchingService;

  beforeAll(async () => {
    await testPrisma.$connect();
    service = new ProductMatchingService(testPrisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it('finds an exact seeded product by name', async () => {
    const results = await service.search('Dyson V15 Detect Absolute', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.product.canonicalName).toBe('Dyson V15 Detect Absolute');
    expect(results[0]?.similarity).toBeGreaterThan(0.9);
  });

  it('ranks a partial query toward the right product', async () => {
    const results = await service.search('roborock s8', 5);
    expect(results[0]?.product.canonicalName).toContain('Roborock');
  });

  it('detects a near-duplicate as a candidate', async () => {
    const candidates = await service.findDuplicateCandidates('Dyson V15 Detect', 5);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.product.canonicalName).toContain('Dyson V15 Detect');
    expect(candidates[0]?.similarity).toBeGreaterThanOrEqual(0.5);
  });

  it('treats a clearly different name as a strong duplicate only when near-identical', async () => {
    const none = await service.hasStrongDuplicate('Completely Unrelated Gadget 9000');
    expect(none).toBeNull();

    const strong = await service.hasStrongDuplicate('Roborock S8 Pro Ultra');
    expect(strong).not.toBeNull();
    expect(strong?.similarity).toBeGreaterThanOrEqual(0.85);
  });

  it('returns nothing for an empty query', async () => {
    const results = await service.search('   ', 5);
    expect(results).toEqual([]);
  });
});
