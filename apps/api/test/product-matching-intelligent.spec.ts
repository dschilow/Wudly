import { describe, expect, it, vi } from 'vitest';
import { normalizeProductName } from '@wudly/shared';
import { ProductMatchingService } from '../src/products/product-matching.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ProductWithRelations } from '../src/products/product.mapper';

describe('ProductMatchingService intelligent search', () => {
  it('finds products when users type category words, aliases, and typos', async () => {
    const service = createService([
      makeProduct({
        id: 'roborock',
        canonicalName: 'Roborock S8 Pro Ultra',
        brand: 'Roborock',
        categorySlug: 'saugroboter',
        categoryName: 'Saugroboter',
        description: 'Premium-Saugroboter mit Wischfunktion und Selbstreinigungsstation.',
        experienceCount: 8,
      }),
      makeProduct({
        id: 'dyson',
        canonicalName: 'Dyson V15 Detect Absolute',
        brand: 'Dyson',
        categorySlug: 'akku-staubsauger',
        categoryName: 'Akku-Staubsauger',
        description: 'Kabelloser Akku-Staubsauger mit starker Saugkraft.',
        experienceCount: 7,
      }),
      makeProduct({
        id: 'samsung',
        canonicalName: 'Samsung Galaxy S25',
        brand: 'Samsung',
        categorySlug: 'smartphone',
        categoryName: 'Smartphone',
        description: 'Android Smartphone mit starker Kamera und hellem Display.',
        experienceCount: 6,
      }),
      makeProduct({
        id: 'delonghi',
        canonicalName: 'DeLonghi Magnifica Evo',
        brand: 'DeLonghi',
        categorySlug: 'kaffeevollautomat',
        categoryName: 'Kaffeevollautomat',
        description: 'Kompakter Kaffeevollautomat mit Milchsystem.',
        experienceCount: 5,
      }),
    ]);

    await expectTopResult(service, 'roborok saug roboter', 'Roborock S8 Pro Ultra');
    await expectTopResult(service, 'handy gute kamera', 'Samsung Galaxy S25');
    await expectTopResult(service, 'kaffeemaschine de longi', 'DeLonghi Magnifica Evo');
    await expectTopResult(service, 'akkusauger dyson', 'Dyson V15 Detect Absolute');
  });

  it('keeps duplicate detection stricter than broad category search', async () => {
    const service = createService([
      makeProduct({
        id: 'dyson',
        canonicalName: 'Dyson V15 Detect Absolute',
        brand: 'Dyson',
        categorySlug: 'akku-staubsauger',
        categoryName: 'Akku-Staubsauger',
        description: 'Kabelloser Akku-Staubsauger mit starker Saugkraft.',
        experienceCount: 7,
      }),
    ]);

    await expect(service.search('staubsauger', 5)).resolves.toHaveLength(1);
    await expect(service.findDuplicateCandidates('Staubsauger', 5)).resolves.toHaveLength(0);
  });
});

async function expectTopResult(
  service: ProductMatchingService,
  query: string,
  expectedName: string,
): Promise<void> {
  const results = await service.search(query, 5);
  expect(results[0]?.product.canonicalName).toBe(expectedName);
}

function createService(products: ProductWithRelations[]): ProductMatchingService {
  const prisma = {
    product: {
      findMany: vi.fn().mockResolvedValue(products),
    },
  };

  return new ProductMatchingService(prisma as unknown as PrismaService);
}

function makeProduct(input: {
  id: string;
  canonicalName: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  description: string;
  experienceCount: number;
}): ProductWithRelations {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const categoryId = `cat-${input.categorySlug}`;

  return {
    id: input.id,
    canonicalName: input.canonicalName,
    normalizedName: normalizeProductName(input.canonicalName),
    brand: input.brand,
    categoryId,
    description: input.description,
    imageUrl: null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    category: {
      id: categoryId,
      slug: input.categorySlug,
      name: input.categoryName,
      createdAt: now,
    },
    insightSnapshot: {
      id: `snap-${input.id}`,
      productId: input.id,
      ownerCount: input.experienceCount,
      experienceCount: input.experienceCount,
      rebuyScore: null,
      regretScore: null,
      unsureScore: null,
      topPositiveAspects: [],
      topNegativeAspects: [],
      wishKnownHighlights: [],
      usageDurationStats: {},
      aiHeadline: null,
      aiSuitedFor: [],
      aiNotSuitedFor: [],
      aiGeneratedAt: null,
      generatedAt: now,
    },
  } as ProductWithRelations;
}
