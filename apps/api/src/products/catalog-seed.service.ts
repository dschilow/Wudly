import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { normalizeProductName } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';

const TARGET_PRODUCT_COUNT = 1000;
const BATCH_SIZE = 500;

type CategorySeed = {
  slug: string;
  name: string;
  focus: string;
};

type CategoryProfile = {
  brands: string[];
  families: string[];
};

const CATEGORIES: CategorySeed[] = [
  { slug: 'saugroboter', name: 'Saugroboter', focus: 'Navigation' },
  { slug: 'akku-staubsauger', name: 'Akku-Staubsauger', focus: 'Saugkraft' },
  { slug: 'kaffeevollautomat', name: 'Kaffeevollautomat', focus: 'Kaffeequalitaet' },
  { slug: 'kindersitz', name: 'Kindersitz', focus: 'Sicherheit' },
  { slug: 'e-bike', name: 'E-Bike', focus: 'Reichweite' },
  { slug: 'matratze', name: 'Matratze', focus: 'Liegekomfort' },
  { slug: 'pv-speicher', name: 'PV-Speicher', focus: 'Kapazitaet' },
  { slug: 'waermepumpe', name: 'Waermepumpe', focus: 'Effizienz' },
  { slug: 'smartphone', name: 'Smartphone', focus: 'Kamera' },
  { slug: 'laptop', name: 'Laptop', focus: 'Akkulaufzeit' },
  { slug: 'waschmaschine', name: 'Waschmaschine', focus: 'Waschergebnis' },
];

const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  saugroboter: {
    brands: ['Roborock', 'Dreame', 'MOVA', 'Ecovacs', 'Xiaomi', 'iRobot', 'Eufy', 'Bosch'],
    families: ['CleanBot', 'Dock', 'Sweep', 'Vision', 'Ultra', 'Home'],
  },
  'akku-staubsauger': {
    brands: ['Dyson', 'Bosch', 'Miele', 'Philips', 'Tineco', 'Rowenta', 'Shark', 'Samsung'],
    families: ['Flex', 'Detect', 'Slim', 'Pet', 'Light', 'Pro'],
  },
  kaffeevollautomat: {
    brands: ['Jura', 'DeLonghi', 'Siemens', 'Philips', 'Melitta', 'Krups', 'Nivona', 'Saeco'],
    families: ['Barista', 'Aroma', 'Latte', 'Bean', 'Milk', 'Core'],
  },
  kindersitz: {
    brands: ['Cybex', 'Maxi-Cosi', 'Britax', 'Joie', 'Recaro', 'Nuna', 'Avionaut', 'BeSafe'],
    families: ['Grow', 'Safe', 'Shield', 'Fix', 'Move', 'Start'],
  },
  'e-bike': {
    brands: ['Cube', 'Riese', 'Specialized', 'Trek', 'Giant', 'Haibike', 'Bulls', 'Kalkhoff'],
    families: ['Urban', 'Trail', 'Tour', 'Cargo', 'Boost', 'Ride'],
  },
  matratze: {
    brands: ['Emma', 'Bett1', 'Tempur', 'Mline', 'Schlaraffia', 'Hilding', 'f.a.n', 'Allnatura'],
    families: ['Cloud', 'Rest', 'Sense', 'Balance', 'Sleep', 'Core'],
  },
  'pv-speicher': {
    brands: ['Sungrow', 'Fox ESS', 'BYD', 'Huawei', 'Kostal', 'SMA', 'SENEC', 'SolarEdge'],
    families: ['Store', 'Power', 'Grid', 'Home', 'Cell', 'Charge'],
  },
  waermepumpe: {
    brands: ['Viessmann', 'Bosch', 'Vaillant', 'Stiebel', 'Nibe', 'Panasonic', 'Mitsubishi', 'Wolf'],
    families: ['Eco', 'Thermo', 'Flow', 'Air', 'Climate', 'Heat'],
  },
  smartphone: {
    brands: ['Samsung', 'Apple', 'Google', 'Xiaomi', 'OnePlus', 'Nothing', 'Sony', 'Motorola'],
    families: ['Phone', 'Edge', 'Ultra', 'Nova', 'Pixel', 'One'],
  },
  laptop: {
    brands: ['Apple', 'Lenovo', 'Dell', 'HP', 'Asus', 'Acer', 'MSI', 'Framework'],
    families: ['Book', 'Pro', 'Air', 'Studio', 'Flex', 'Go'],
  },
  waschmaschine: {
    brands: ['Bosch', 'Siemens', 'Miele', 'AEG', 'Samsung', 'LG', 'Bauknecht', 'Beko'],
    families: ['Wash', 'Care', 'Spin', 'Eco', 'Smart', 'Drum'],
  },
};

@Injectable()
export class CatalogSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SEED_PRODUCTS_ON_BOOT !== 'true') return;

    const activeCount = await this.prisma.product.count({ where: { status: 'ACTIVE' } });
    if (activeCount >= TARGET_PRODUCT_COUNT) {
      this.logger.log(`Catalog seed skipped; ${activeCount} active products already exist.`);
      return;
    }

    const missingCount = TARGET_PRODUCT_COUNT - activeCount;
    this.logger.warn(`Catalog seed appending ${missingCount} generated products.`);

    const categoryIdBySlug = await this.ensureCategories();
    const existing = new Set(
      (
        await this.prisma.product.findMany({
          select: { normalizedName: true },
        })
      ).map((product) => product.normalizedName),
    );

    const products = [];
    const sources = [];
    const snapshots = [];

    for (let index = 0; products.length < missingCount; index += 1) {
      const generated = buildGeneratedProduct(index);
      if (existing.has(generated.normalizedName)) continue;
      existing.add(generated.normalizedName);

      const productId = `runtime_seed_product_${index}`;
      products.push({
        id: productId,
        canonicalName: generated.canonicalName,
        normalizedName: generated.normalizedName,
        brand: generated.brand,
        categoryId: categoryIdBySlug.get(generated.category.slug) ?? null,
        description: generated.description,
        imageUrl: `/api/products/image/${encodeURIComponent(generated.normalizedName)}`,
        status: 'ACTIVE' as const,
      });
      sources.push({
        id: `runtime_seed_source_${index}`,
        productId,
        sourceType: 'IMPORT' as const,
        rawTitle: generated.canonicalName,
        matchConfidence: 1,
      });
      snapshots.push(buildSnapshot(productId, index));
    }

    await createManyInChunks(products, (data) => this.prisma.product.createMany({ data }));
    await createManyInChunks(sources, (data) => this.prisma.productSource.createMany({ data }));
    await createManyInChunks(snapshots, (data) =>
      this.prisma.productInsightSnapshot.createMany({ data }),
    );

    this.logger.warn(`Catalog seed complete. Added ${products.length} products.`);
  }

  private async ensureCategories(): Promise<Map<string, string>> {
    const categoryIdBySlug = new Map<string, string>();

    for (const [index, category] of CATEGORIES.entries()) {
      const row = await this.prisma.category.upsert({
        where: { slug: category.slug },
        create: {
          id: `runtime_seed_category_${index}`,
          slug: category.slug,
          name: category.name,
        },
        update: {},
      });
      categoryIdBySlug.set(category.slug, row.id);
    }

    return categoryIdBySlug;
  }
}

function buildGeneratedProduct(index: number) {
  const category = CATEGORIES[index % CATEGORIES.length]!;
  const profile = CATEGORY_PROFILES[category.slug] ?? CATEGORY_PROFILES.smartphone!;
  const brand = pick(profile.brands, index * 7 + 3);
  const family = pick(profile.families, index);
  const suffix = pick(['Pro', 'Plus', 'Max', 'Air', 'Core', 'Edge', 'One'], index * 5 + 1);
  const code = `${String((index % 90) + 10)}${String.fromCharCode(65 + (index % 26))}`;
  const canonicalName = `${brand} ${family} ${suffix} ${code}`;
  const normalizedName = normalizeProductName(canonicalName);

  return {
    canonicalName,
    normalizedName,
    brand,
    category,
    description: `Alltagsfreundliches ${category.name} mit Fokus auf ${category.focus}.`,
  };
}

function buildSnapshot(productId: string, index: number) {
  const seed = hashString(productId);
  const experienceCount = 1 + (seed % 8);
  const rebuyScore = 58 + (seed % 37);
  const regretScore = 6 + ((seed >> 3) % 30);
  const unsureScore = Math.max(0, 100 - rebuyScore - regretScore);

  return {
    id: `runtime_seed_snapshot_${index}`,
    productId,
    ownerCount: experienceCount,
    experienceCount,
    rebuyScore,
    regretScore,
    unsureScore,
    topPositiveAspects: [],
    topNegativeAspects: [],
    wishKnownHighlights: [],
    usageDurationStats: {},
  };
}

async function createManyInChunks<T>(
  rows: T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await write(rows.slice(index, index + BATCH_SIZE));
  }
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length] ?? items[0]!;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
