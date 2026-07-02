import { describe, expect, it, vi } from 'vitest';
import { SightingsService, researchQuery, shopSource } from './sightings.service';
import type { ProductSightingInput } from '@wudly/shared';

/** Minimal collaborator fakes — the service only touches what a test arms. */
function makeService(overrides: {
  identifierHit?: unknown;
  matchCandidates?: Array<{ product: unknown; similarity: number }>;
  ingestEnabled?: boolean;
} = {}) {
  const prisma = {
    productSighting: {
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => ({
        id: 's1',
        status: args.create.status,
        ...args.create,
      })),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 's1',
        ...args.data,
      })),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
      findMany: vi.fn(async () => []),
    },
    productIdentifier: {
      findFirst: vi.fn(async () => overrides.identifierHit ?? null),
      upsert: vi.fn(async (_args: { create: Record<string, unknown> }) => ({})),
    },
  };
  const matching = {
    findDuplicateCandidates: vi.fn(async () => overrides.matchCandidates ?? []),
  };
  const externalRatings = { upsert: vi.fn(async () => ({})) };
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'EXTENSION_SIGHTINGS_ENABLED') return overrides.ingestEnabled ?? true;
      if (key === 'WEB_APP_URL') return 'https://wudly.app';
      return undefined;
    }),
  };
  const service = new SightingsService(
    prisma as never,
    {} as never,
    matching as never,
    externalRatings as never,
    config as never,
  );
  return { service, prisma, matching, externalRatings };
}

const baseInput: ProductSightingInput = {
  title: 'Sony WH-1000XM5 kabellose Noise Cancelling Kopfhörer',
  domain: 'www.mediamarkt.de',
  event: 'view',
};

const catalogProduct = {
  id: 'p1',
  canonicalName: 'Sony WH-1000XM5',
  normalizedName: 'sony wh 1000xm5',
  brand: 'Sony',
  imageUrl: null,
  status: 'ACTIVE',
  specs: [],
  category: null,
  insightSnapshot: null,
};

describe('SightingsService.resolveAndRecord', () => {
  it('rejects junk titles without touching the database', async () => {
    const { service, prisma } = makeService();
    const result = await service.resolveAndRecord({ ...baseInput, title: '3er Pack Batterien' });
    expect(result.status).toBe('rejected');
    expect(prisma.productSighting.upsert).not.toHaveBeenCalled();
  });

  it('resolves a known EAN via the identifier path and marks the row MATCHED', async () => {
    const { service, prisma, matching } = makeService({
      identifierHit: { product: catalogProduct },
    });
    const result = await service.resolveAndRecord({
      ...baseInput,
      identifierType: 'EAN',
      identifierValue: '4548736141549',
    });
    expect(result.status).toBe('known');
    expect(result.product?.id).toBe('p1');
    expect(result.webUrl).toContain('/produkte/');
    expect(result.webUrl).toContain('p1');
    // Identifier path wins — no name matching needed.
    expect(matching.findDuplicateCandidates).not.toHaveBeenCalled();
    const upsert = prisma.productSighting.upsert.mock.calls[0]![0] as {
      create: Record<string, unknown>;
    };
    expect(upsert.create.status).toBe('MATCHED');
    expect(upsert.create.dedupeKey).toBe('ean:4548736141549');
  });

  it('queues unknown products as PENDING sightings', async () => {
    const { service, prisma } = makeService();
    const result = await service.resolveAndRecord(baseInput);
    expect(result.status).toBe('queued');
    expect(result.product).toBeNull();
    const upsert = prisma.productSighting.upsert.mock.calls[0]![0] as {
      create: Record<string, unknown>;
    };
    expect(upsert.create.status).toBe('PENDING');
    expect(String(upsert.create.dedupeKey)).toMatch(/^name:.*@www\.mediamarkt\.de$/);
  });

  it('hides HIDDEN products from the extension', async () => {
    const { service } = makeService({
      identifierHit: { product: { ...catalogProduct, status: 'HIDDEN' } },
    });
    const result = await service.resolveAndRecord({
      ...baseInput,
      identifierType: 'EAN',
      identifierValue: '4548736141549',
    });
    expect(result.status).toBe('rejected');
    expect(result.product).toBeNull();
  });

  it('degrades to a pure lookup when ingestion is disabled (kill switch)', async () => {
    const { service, prisma } = makeService({ ingestEnabled: false });
    const result = await service.resolveAndRecord(baseInput);
    expect(result.status).toBe('queued');
    expect(prisma.productSighting.upsert).not.toHaveBeenCalled();
  });

  it('attaches the shop identifier to a product matched by name', async () => {
    const { service, prisma } = makeService({
      matchCandidates: [{ product: catalogProduct, similarity: 0.95 }],
    });
    const result = await service.resolveAndRecord({
      ...baseInput,
      identifierType: 'ASIN',
      identifierValue: 'b0abc12345',
    });
    expect(result.status).toBe('known');
    const attach = prisma.productIdentifier.upsert.mock.calls[0]![0] as {
      create: Record<string, unknown>;
    };
    // ASINs are normalized to upper case for the global keyspace.
    expect(attach.create).toMatchObject({ productId: 'p1', type: 'ASIN', value: 'B0ABC12345' });
  });
});

describe('SightingsService shop ratings', () => {
  const ratedInput: ProductSightingInput = {
    ...baseInput,
    identifierType: 'EAN',
    identifierValue: '4548736141549',
    productUrl: 'https://www.mediamarkt.de/de/product/_sony-123.html',
    rating: { value: 4.7, maxValue: 5, count: 207 },
  };

  it('applies the shop rating as an attributed fact when a product exists', async () => {
    const { service, externalRatings } = makeService({
      identifierHit: { product: catalogProduct },
    });
    await service.resolveAndRecord(ratedInput);
    expect(externalRatings.upsert).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        source: 'mediamarkt',
        sourceLabel: 'MediaMarkt',
        kind: 'STARS',
        value: 4.7,
        maxValue: 5,
        count: 207,
        url: ratedInput.productUrl,
      }),
    );
  });

  it('skips thin ratings (below the minimum review count)', async () => {
    const { service, externalRatings } = makeService({
      identifierHit: { product: catalogProduct },
    });
    await service.resolveAndRecord({ ...ratedInput, rating: { value: 5, maxValue: 5, count: 2 } });
    expect(externalRatings.upsert).not.toHaveBeenCalled();
  });

  it('skips ratings without an attribution URL', async () => {
    const { service, externalRatings } = makeService({
      identifierHit: { product: catalogProduct },
    });
    await service.resolveAndRecord({ ...ratedInput, productUrl: undefined });
    expect(externalRatings.upsert).not.toHaveBeenCalled();
  });

  it('does not store ratings for unknown products (no catalog product yet)', async () => {
    const { service, externalRatings, prisma } = makeService();
    await service.resolveAndRecord(ratedInput);
    expect(externalRatings.upsert).not.toHaveBeenCalled();
    // …but the facts are kept on the sighting for the pipeline to apply later.
    const upsert = prisma.productSighting.upsert.mock.calls[0]![0] as {
      create: Record<string, unknown>;
    };
    expect(upsert.create).toMatchObject({ ratingValue: 4.7, ratingMax: 5, ratingCount: 207 });
  });
});

describe('shopSource', () => {
  it('maps known shops to branded labels', () => {
    expect(shopSource('www.mediamarkt.de')).toEqual({ source: 'mediamarkt', label: 'MediaMarkt' });
    expect(shopSource('amazon.de')).toEqual({ source: 'amazon', label: 'Amazon' });
  });

  it('falls back to the second-level domain for unknown shops', () => {
    expect(shopSource('shop.beispiel.de')).toEqual({ source: 'beispiel', label: 'Beispiel' });
  });
});

describe('SightingsService.dedupeKey', () => {
  const { service } = makeService();

  it('shares one keyspace for EAN and GTIN', () => {
    const ean = service.dedupeKey({
      identifierType: 'EAN',
      identifierValue: '4548736141549',
      title: 'x',
      domain: 'a.de',
    });
    const gtin = service.dedupeKey({
      identifierType: 'GTIN',
      identifierValue: '4548736141549',
      title: 'y',
      domain: 'b.de',
    });
    expect(ean).toBe(gtin);
  });

  it('scopes name-only sightings per shop', () => {
    const a = service.dedupeKey({ title: 'Sony WH-1000XM5', domain: 'www.otto.de' });
    const b = service.dedupeKey({ title: 'Sony WH-1000XM5', domain: 'www.saturn.de' });
    expect(a).not.toBe(b);
  });
});

describe('researchQuery', () => {
  it('cuts marketing spam at the first hard separator', () => {
    expect(
      researchQuery(
        'Sony WH-1000XM5 kabellose Kopfhörer, 30h Akku, Noise Cancelling | Schwarz',
        null,
      ),
    ).toBe('Sony WH-1000XM5 kabellose Kopfhörer');
  });

  it('keeps hyphenated model names intact but cuts spaced dashes', () => {
    expect(researchQuery('Sony WH-1000XM5 Kopfhörer - Testsieger 2026', null)).toBe(
      'Sony WH-1000XM5 Kopfhörer',
    );
  });

  it('prepends a missing brand', () => {
    expect(researchQuery('Magic5 Pro 512GB', 'Honor')).toBe('Honor Magic5 Pro 512GB');
  });

  it('does not duplicate a brand already in the title', () => {
    expect(researchQuery('Honor Magic5 Pro', 'Honor')).toBe('Honor Magic5 Pro');
  });
});
