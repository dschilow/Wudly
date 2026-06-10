/**
 * Seed: external rating facts ("Bewertungen anderswo") for the curated demo
 * products. Demo values — in production these get maintained via the admin UI
 * (or later via affiliate feeds). Idempotent: upserts per (product, source).
 */

import type { PrismaClient, ExternalRatingKind } from '@prisma/client';
import { normalizeProductName } from '@wudly/shared';

interface SeedRating {
  source: string;
  sourceLabel: string;
  url: string;
  kind: ExternalRatingKind;
  value: number;
  maxValue: number;
  count: number | null;
  note: string | null;
}

/** Keyed by canonicalName of the curated seed products. */
const RATINGS_BY_PRODUCT: Record<string, SeedRating[]> = {
  'Dyson V15 Detect Absolute': [
    {
      source: 'amazon',
      sourceLabel: 'Amazon',
      url: 'https://www.amazon.de/s?k=Dyson+V15+Detect+Absolute',
      kind: 'STARS',
      value: 4.5,
      maxValue: 5,
      count: 8214,
      note: null,
    },
    {
      source: 'idealo',
      sourceLabel: 'idealo',
      url: 'https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=Dyson+V15+Detect',
      kind: 'STARS',
      value: 4.4,
      maxValue: 5,
      count: 612,
      note: null,
    },
    {
      source: 'warentest',
      sourceLabel: 'Stiftung Warentest',
      url: 'https://www.test.de/Akku-Staubsauger-im-Test-5017772-0/',
      kind: 'GRADE_DE',
      value: 2.3,
      maxValue: 6,
      count: null,
      note: 'Akku-Staubsauger-Test',
    },
  ],
  'Roborock S8 Pro Ultra': [
    {
      source: 'amazon',
      sourceLabel: 'Amazon',
      url: 'https://www.amazon.de/s?k=Roborock+S8+Pro+Ultra',
      kind: 'STARS',
      value: 4.3,
      maxValue: 5,
      count: 3187,
      note: null,
    },
    {
      source: 'mediamarkt',
      sourceLabel: 'MediaMarkt',
      url: 'https://www.mediamarkt.de/de/search.html?query=Roborock%20S8%20Pro%20Ultra',
      kind: 'STARS',
      value: 4.6,
      maxValue: 5,
      count: 254,
      note: null,
    },
  ],
  'DeLonghi Magnifica Evo': [
    {
      source: 'amazon',
      sourceLabel: 'Amazon',
      url: 'https://www.amazon.de/s?k=DeLonghi+Magnifica+Evo',
      kind: 'STARS',
      value: 4.4,
      maxValue: 5,
      count: 12450,
      note: null,
    },
    {
      source: 'otto',
      sourceLabel: 'OTTO',
      url: 'https://www.otto.de/suche/DeLonghi%20Magnifica%20Evo/',
      kind: 'STARS',
      value: 4.5,
      maxValue: 5,
      count: 893,
      note: null,
    },
  ],
  'Cybex Solution G i-Fix': [
    {
      source: 'amazon',
      sourceLabel: 'Amazon',
      url: 'https://www.amazon.de/s?k=Cybex+Solution+G+i-Fix',
      kind: 'STARS',
      value: 4.7,
      maxValue: 5,
      count: 4521,
      note: null,
    },
    {
      source: 'warentest',
      sourceLabel: 'Stiftung Warentest',
      url: 'https://www.test.de/Kindersitze-im-Test-5023574-0/',
      kind: 'GRADE_DE',
      value: 1.9,
      maxValue: 6,
      count: null,
      note: 'Kindersitz-Test',
    },
  ],
  'Samsung Galaxy S25': [
    {
      source: 'amazon',
      sourceLabel: 'Amazon',
      url: 'https://www.amazon.de/s?k=Samsung+Galaxy+S25',
      kind: 'STARS',
      value: 4.2,
      maxValue: 5,
      count: 1876,
      note: null,
    },
    {
      source: 'idealo',
      sourceLabel: 'idealo',
      url: 'https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=Samsung+Galaxy+S25',
      kind: 'STARS',
      value: 4.3,
      maxValue: 5,
      count: 421,
      note: null,
    },
  ],
  'Apple MacBook Air': [
    {
      source: 'amazon',
      sourceLabel: 'Amazon',
      url: 'https://www.amazon.de/s?k=Apple+MacBook+Air',
      kind: 'STARS',
      value: 4.8,
      maxValue: 5,
      count: 9634,
      note: null,
    },
  ],
  'Bosch Serie 8 Waschmaschine': [
    {
      source: 'amazon',
      sourceLabel: 'Amazon',
      url: 'https://www.amazon.de/s?k=Bosch+Serie+8+Waschmaschine',
      kind: 'STARS',
      value: 4.6,
      maxValue: 5,
      count: 2310,
      note: null,
    },
    {
      source: 'warentest',
      sourceLabel: 'Stiftung Warentest',
      url: 'https://www.test.de/Waschmaschinen-im-Test-1747339-0/',
      kind: 'GRADE_DE',
      value: 1.7,
      maxValue: 6,
      count: null,
      note: 'Waschmaschinen-Test',
    },
  ],
};

export async function seedExternalRatings(prisma: PrismaClient): Promise<void> {
  let upserted = 0;
  for (const [canonicalName, ratings] of Object.entries(RATINGS_BY_PRODUCT)) {
    const product = await prisma.product.findFirst({
      where: { normalizedName: normalizeProductName(canonicalName) },
      select: { id: true },
    });
    if (!product) continue;

    for (const rating of ratings) {
      await prisma.externalRating.upsert({
        where: { productId_source: { productId: product.id, source: rating.source } },
        create: { productId: product.id, ...rating },
        update: { ...rating },
      });
      upserted += 1;
    }
  }
  console.warn(`   - ${upserted} external ratings (Bewertungen anderswo)`);
}
