import { describe, expect, it } from 'vitest';
import { calculateCatalogQuality, countDistinctSourceDomains } from './catalog-quality';

const base = {
  productId: 'p1',
  canonicalName: 'Sony WH-1000XM6',
  status: 'PENDING_REVIEW' as const,
  brand: 'Sony',
  categoryId: 'headphones',
  description:
    'Ein sachlich beschriebener Over-Ear-Kopfhörer mit aktiver Geräuschunterdrückung und langer Laufzeit.',
  specs: [
    { label: 'Bauart', value: 'Over-Ear' },
    { label: 'Bluetooth', value: '5.3' },
    { label: 'Laufzeit', value: '30 Stunden' },
    { label: 'Gewicht', value: '254 g' },
  ],
  hasImage: true,
  sourceCount: 3,
  experienceCount: 0,
  createdAt: new Date('2026-07-14T00:00:00.000Z'),
};

describe('calculateCatalogQuality', () => {
  it('allows a well-grounded researched product to be published', () => {
    const quality = calculateCatalogQuality(base);
    expect(quality.publishReady).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(80);
    expect(quality.issues).toEqual([]);
  });

  it('holds an ungrounded placeholder for review', () => {
    const quality = calculateCatalogQuality({
      ...base,
      canonicalName: 'Test Produkt',
      description: null,
      specs: [],
      hasImage: false,
      sourceCount: 0,
    });
    expect(quality.publishReady).toBe(false);
    expect(quality.issues.some((item) => item.severity === 'CRITICAL')).toBe(true);
  });

  it('accepts real owner evidence even before external sources exist', () => {
    const quality = calculateCatalogQuality({
      ...base,
      sourceCount: 0,
      experienceCount: 1,
    });
    expect(quality.publishReady).toBe(true);
  });
  it('counts source domains instead of individual URLs', () => {
    expect(
      countDistinctSourceDomains([
        'https://www.test.example/review',
        'https://test.example/another-page',
        'https://forum.example/thread',
        'not-a-url',
      ]),
    ).toBe(2);
  });
});
