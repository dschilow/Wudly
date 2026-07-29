import { describe, expect, it, vi } from 'vitest';
import {
  SightingsService,
  researchQuery,
  shopSource,
  storedIdentifierValue,
  titleMatchesProductUrl,
} from './sightings.service';
import type { ProductSightingInput } from '@wudly/shared';

/** Minimal collaborator fakes — the service only touches what a test arms. */
function makeService(overrides: {
  identifierHit?: unknown;
  matchCandidates?: Array<{ product: unknown; similarity: number }>;
  /** Family (variant sibling) hit returned by ProductVariantsService. */
  familyProduct?: unknown;
  /** What ensureVariantFromTitle reports (null = no variant attributes). */
  ensuredVariant?: { id: string } | null;
  ingestEnabled?: boolean;
  /** Product the EXISTING sighting row already points at (pipeline output). */
  linkedProduct?: unknown;
  /** Product an EARLIER sighting of the same shop URL resolved to. */
  pageHistoryProduct?: { id: string } | null;
} = {}) {
  const prisma = {
    product: {
      findUnique: vi.fn(async () => overrides.linkedProduct ?? overrides.pageHistoryProduct ?? null),
    },
    productSighting: {
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => ({
        id: 's1',
        status: args.create.status,
        ...args.create,
        // A row the pipeline already processed carries its product link.
        ...(overrides.linkedProduct ? { productId: 'p1', status: 'RESEARCHED' } : {}),
      })),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 's1',
        ...args.data,
      })),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
      findMany: vi.fn(async () => []),
      // An earlier sighting of the same shop page, already linked to a product.
      findFirst: vi.fn(async () =>
        overrides.pageHistoryProduct
          ? { productId: overrides.pageHistoryProduct.id }
          : null,
      ),
    },
    productIdentifier: {
      findFirst: vi.fn(async () => overrides.identifierHit ?? null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({})),
      update: vi.fn(async (_args: { data: Record<string, unknown> }) => ({})),
    },
  };
  const matching = {
    findDuplicateCandidates: vi.fn(async () => overrides.matchCandidates ?? []),
  };
  const variants = {
    findFamilyProduct: vi.fn(async () =>
      overrides.familyProduct
        ? { product: overrides.familyProduct, verdict: { kind: 'sibling', confidence: 0.95 } }
        : null,
    ),
    ensureVariantFromTitle: vi.fn(async () => overrides.ensuredVariant ?? null),
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
    variants as never,
    externalRatings as never,
    config as never,
  );
  return { service, prisma, matching, variants, externalRatings };
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

  it('offers the prefilled Wudly check for a product the catalog does not know', async () => {
    const { service } = makeService();
    const result = await service.resolveAndRecord(baseInput);
    expect(result.status).toBe('queued');
    expect(result.searchUrl).toBe(
      `https://wudly.app/check?q=${encodeURIComponent(baseInput.title)}`,
    );
  });

  /**
   * The regression that made the overlay lie: after the pipeline created the
   * product, the AI-cleaned canonical name no longer name-matches the spammy
   * shop title, so fresh resolution finds nothing — and the user kept reading
   * "wird gerade aufgenommen" on every reload. The sighting row remembers the
   * link, and one visit is enough to repair the identifier binding.
   */
  it('resolves through the sighting row once the pipeline created the product', async () => {
    const { service, prisma } = makeService({ linkedProduct: catalogProduct });
    const result = await service.resolveAndRecord({
      ...baseInput,
      title: 'TCL 75C7K Fernseher 190,5 cm (75 Zoll) 4K Ultra HD Smart-TV WLAN',
      identifierType: 'SKU',
      identifierValue: '2982243',
    });
    expect(result.status).toBe('known');
    expect(result.product?.id).toBe('p1');
    expect(result.webUrl).toContain('p1');
    // Self-healing: the shop article number is now bound, so the NEXT view
    // resolves in O(1) instead of walking this fallback again.
    const attach = prisma.productIdentifier.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(attach.data).toMatchObject({
      productId: 'p1',
      type: 'SKU',
      value: 'mediamarkt:2982243',
    });
  });

  /**
   * The same shelf item can arrive under a NEW dedupeKey — a rewritten title,
   * or an adapter that learned to read the page's GTIN where it used to send
   * the shop article number. The row is then new and unlinked; only the shop
   * URL still ties it to the product the pipeline already built.
   */
  it('adopts the product of an earlier sighting of the same shop page', async () => {
    const { service, prisma } = makeService({ pageHistoryProduct: catalogProduct });
    const result = await service.resolveAndRecord({
      ...baseInput,
      identifierType: 'GTIN',
      identifierValue: '8718863038000',
      productUrl: 'https://www.mediamarkt.de/de/product/_sony-wh-1000xm5-2982243.html',
    });
    expect(result.status).toBe('known');
    expect(result.product?.id).toBe('p1');
    // The link moves onto the new row, so this repair happens exactly once.
    expect(prisma.productSighting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { productId: 'p1', status: 'MATCHED' } }),
    );
  });

  it('does not guess a product for a page nobody has resolved before', async () => {
    const { service } = makeService();
    const result = await service.resolveAndRecord({
      ...baseInput,
      productUrl: 'https://www.mediamarkt.de/de/product/_sony-wh-1000xm5-2982243.html',
    });
    expect(result.status).toBe('queued');
  });

  it('keeps a hidden product hidden even when the sighting row links to it', async () => {
    const { service } = makeService({
      linkedProduct: { ...catalogProduct, status: 'HIDDEN' },
    });
    const result = await service.resolveAndRecord(baseInput);
    expect(result.status).toBe('rejected');
    expect(result.product).toBeNull();
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

  it('rejects SPA-race hybrids (title from the old page, URL from the new one)', async () => {
    const { service, prisma } = makeService({
      matchCandidates: [{ product: catalogProduct, similarity: 0.95 }],
    });
    const result = await service.resolveAndRecord({
      ...baseInput,
      title: 'TCL 75C7K Fernseher 190,5 cm (75") 4K Ultra HD Smart-TV',
      identifierType: 'SKU',
      identifierValue: '2982243',
      productUrl: 'https://www.mediamarkt.de/de/product/_philips-65oled810-oled-ambilight-tv-2982243.html',
    });
    expect(result.status).toBe('rejected');
    // Nothing recorded, and above all: no identifier binding to the wrong product.
    expect(prisma.productSighting.upsert).not.toHaveBeenCalled();
    expect(prisma.productIdentifier.create).not.toHaveBeenCalled();
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
    const attach = prisma.productIdentifier.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    // ASINs are normalized to upper case for the global keyspace.
    expect(attach.data).toMatchObject({ productId: 'p1', type: 'ASIN', value: 'B0ABC12345' });
  });

  it('resolves another configuration of a known family to the SAME product', async () => {
    // Catalog has the 65" model; the page shows the 75" — no identifier hit, no
    // strong name match, but the family matcher recognizes the sibling.
    const { service, prisma, variants } = makeService({
      familyProduct: catalogProduct,
      ensuredVariant: { id: 'v75' },
    });
    const result = await service.resolveAndRecord({
      ...baseInput,
      title: 'SAMSUNG GQ75S95DAT OLED TV (Flat, 75 Zoll / 189 cm)',
      identifierType: 'EAN',
      identifierValue: '8806095999999',
    });
    expect(result.status).toBe('known');
    expect(result.product?.id).toBe('p1');
    // The sighting row is MATCHED — the pipeline will never create a duplicate.
    const upsert = prisma.productSighting.upsert.mock.calls[0]![0] as {
      create: Record<string, unknown>;
    };
    expect(upsert.create.status).toBe('MATCHED');
    // The configuration is recorded and the EAN attaches variant-scoped.
    expect(variants.ensureVariantFromTitle).toHaveBeenCalledWith(
      'p1',
      'SAMSUNG GQ75S95DAT OLED TV (Flat, 75 Zoll / 189 cm)',
    );
    const attach = prisma.productIdentifier.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(attach.data).toMatchObject({
      productId: 'p1',
      type: 'EAN',
      value: '8806095999999',
      variantId: 'v75',
    });
  });
});

describe('titleMatchesProductUrl', () => {
  it('accepts when slug and title share product words', () => {
    expect(
      titleMatchesProductUrl(
        'PHILIPS 65OLED810/12 OLED Ambilight TV (Flat, 65 Zoll / 164 cm, UHD 4K, SMART TV)',
        'https://www.mediamarkt.de/de/product/_philips-65oled810-oled-ambilight-tv-flat-65-zoll-164-cm-uhd-4k-smart-tv-ambilight-2982243.html',
      ),
    ).toBe(true);
  });

  it('rejects a slug full of product words that never appear in the title', () => {
    expect(
      titleMatchesProductUrl(
        'TCL 75C7K Fernseher 190,5 cm (75") 4K Ultra HD Smart-TV WLAN',
        'https://www.mediamarkt.de/de/product/_philips-65oled810-oled-ambilight-tv-flat-65-zoll-2982243.html',
      ),
    ).toBe(false);
  });

  it('passes URLs whose path carries no product words', () => {
    expect(titleMatchesProductUrl('Sony WH-1000XM5', 'https://www.amazon.de/dp/B09XS7JWHH')).toBe(true);
    expect(titleMatchesProductUrl('Sony WH-1000XM5', undefined)).toBe(true);
    expect(titleMatchesProductUrl('Sony WH-1000XM5', 'not a url')).toBe(true);
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

  it('keys shop article numbers by shop, independent of the title', () => {
    const before = service.dedupeKey({
      identifierType: 'SKU',
      identifierValue: '2982243',
      title: 'PHILIPS 65OLED810/12 OLED Ambilight TV',
      domain: 'www.mediamarkt.de',
    });
    // Marketing rewrites the title — the same shelf item must stay one row,
    // otherwise the pipeline re-queues (and re-pays for) a known product.
    const after = service.dedupeKey({
      identifierType: 'SKU',
      identifierValue: '2982243',
      title: 'PHILIPS 65OLED810/12 OLED TV | JETZT 300 € SPAREN',
      domain: 'www.mediamarkt.de',
    });
    expect(after).toBe(before);
    // Different shop, same article number = a different product.
    const otherShop = service.dedupeKey({
      identifierType: 'SKU',
      identifierValue: '2982243',
      title: 'Irgendein anderes Gerät',
      domain: 'www.cyberport.de',
    });
    expect(otherShop).not.toBe(before);
  });
});

describe('storedIdentifierValue', () => {
  it('keeps worldwide identities as they are', () => {
    expect(storedIdentifierValue('EAN', '4548736141549', 'www.otto.de')).toBe('4548736141549');
    expect(storedIdentifierValue('ASIN', 'b0abc12345', 'www.amazon.de')).toBe('B0ABC12345');
  });

  it('scopes shop article numbers so one shop cannot hijack another', () => {
    expect(storedIdentifierValue('SKU', '2982243', 'www.mediamarkt.de')).toBe('mediamarkt:2982243');
    expect(storedIdentifierValue('SKU', '2982243', 'www.cyberport.de')).toBe('cyberport:2982243');
  });

  it('refuses a shop article number without a shop', () => {
    expect(storedIdentifierValue('SKU', '2982243', null)).toBeNull();
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
