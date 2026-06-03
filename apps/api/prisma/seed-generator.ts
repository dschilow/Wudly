import {
  normalizeProductName,
  AspectSentiment,
  WouldBuyAgain,
  UsageDuration,
  ExperienceMood,
} from '@wudly/shared';
import type { SeedCategory, SeedExperience, SeedProduct } from './seed-data';

type CategoryProfile = {
  brands: string[];
  families: string[];
};

const TARGET_PRODUCT_COUNT = 1000;
const DEMO_USERS = [
  'lena',
  'jonas',
  'miriam',
  'tobias',
  'sarah',
  'ben',
  'carla',
  'david',
  'nina',
  'paul',
  'yusuf',
  'hanna',
];

const LONG_LIVED_CATEGORIES = new Set([
  'matratze',
  'waschmaschine',
  'pv-speicher',
  'waermepumpe',
  'e-bike',
]);

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

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length] ?? items[0];
}

function buildAspectMap(category: SeedCategory): Map<string, { label: string; type: AspectSentiment }> {
  return new Map(category.aspects.map((aspect) => [aspect.key, { label: aspect.label, type: aspect.type }]));
}

function keysByType(category: SeedCategory, type: AspectSentiment): string[] {
  return category.aspects.filter((aspect) => aspect.type === type).map((aspect) => aspect.key);
}

function chooseKeys(keys: string[], count: number, seed: number): string[] {
  if (keys.length === 0 || count <= 0) return [];
  const picked = new Set<string>();
  for (let i = 0; picked.size < Math.min(count, keys.length); i += 1) {
    picked.add(keys[(seed + i * 3) % keys.length] ?? keys[0]);
  }
  return [...picked];
}

function chooseDuration(categorySlug: string, bucket: number): UsageDuration {
  const longLived = LONG_LIVED_CATEGORIES.has(categorySlug);
  if (longLived) {
    if (bucket < 10) return UsageDuration.LESS_THAN_WEEK;
    if (bucket < 24) return UsageDuration.ONE_TO_FOUR_WEEKS;
    if (bucket < 54) return UsageDuration.ONE_TO_SIX_MONTHS;
    if (bucket < 82) return UsageDuration.SIX_TO_TWELVE_MONTHS;
    return UsageDuration.MORE_THAN_YEAR;
  }
  if (bucket < 8) return UsageDuration.LESS_THAN_WEEK;
  if (bucket < 22) return UsageDuration.ONE_TO_FOUR_WEEKS;
  if (bucket < 64) return UsageDuration.ONE_TO_SIX_MONTHS;
  if (bucket < 84) return UsageDuration.SIX_TO_TWELVE_MONTHS;
  return UsageDuration.MORE_THAN_YEAR;
}

function chooseWouldBuyAgain(bucket: number): WouldBuyAgain {
  if (bucket < 66) return WouldBuyAgain.YES;
  if (bucket < 84) return WouldBuyAgain.UNSURE;
  return WouldBuyAgain.NO;
}

function chooseMood(bucket: number, wouldBuyAgain: WouldBuyAgain): ExperienceMood {
  if (wouldBuyAgain === WouldBuyAgain.YES) {
    if (bucket < 30) return ExperienceMood.TOP_BUY;
    if (bucket < 75) return ExperienceMood.GOOD_DAILY_USE;
    return ExperienceMood.SURPRISINGLY_GOOD;
  }
  if (wouldBuyAgain === WouldBuyAgain.UNSURE) {
    if (bucket < 45) return ExperienceMood.OKAY;
    if (bucket < 80) return ExperienceMood.ANNOYING;
    return ExperienceMood.SURPRISINGLY_GOOD;
  }
  if (bucket < 45) return ExperienceMood.REGRET;
  if (bucket < 80) return ExperienceMood.DEFECTIVE;
  return ExperienceMood.ANNOYING;
}

function pickHandle(seed: number): string {
  return DEMO_USERS[seed % DEMO_USERS.length] ?? DEMO_USERS[0]!;
}

function buildWishKnownText(
  aspectMap: Map<string, { label: string; type: AspectSentiment }>,
  positiveKeys: string[],
  negativeKeys: string[],
  seed: number,
): string | undefined {
  const focusKey = negativeKeys[0] ?? positiveKeys[0];
  if (!focusKey) return undefined;
  const focusLabel = aspectMap.get(focusKey)?.label ?? focusKey;
  const templates = [
    `Dass ${focusLabel.toLowerCase()} im Alltag mehr Gewicht hat, als man zuerst denkt.`,
    `Dass man bei ${focusLabel.toLowerCase()} keine Kompromisse machen sollte.`,
    `Dass ${focusLabel.toLowerCase()} die Nutzung deutlich praegt.`,
  ];
  return templates[seed % templates.length];
}

function buildFreeText(canonicalName: string, seed: number): string | undefined {
  const templates = [
    `${canonicalName} ist im Alltag solide, aber nicht komplett sorglos.`,
    `Preis-Leistung passt, wenn man die Erwartungen realistisch setzt.`,
    `Praktisch im Alltag, aber nicht fuer Perfektionisten.`,
    `Gute Basis mit kleinen Ecken und Kanten.`,
  ];
  return seed % 4 === 0 ? templates[seed % templates.length] : undefined;
}

function buildDescription(categoryName: string, focusLabel: string, seed: number): string {
  const templates = [
    `Kompaktes ${categoryName} mit Fokus auf ${focusLabel.toLowerCase()}.`,
    `Alltagsfreundliches ${categoryName} fuer Nutzer, denen ${focusLabel.toLowerCase()} wichtig ist.`,
    `Robustes ${categoryName} mit Schwerpunkt auf ${focusLabel.toLowerCase()}.`,
  ];
  return templates[seed % templates.length] ?? templates[0]!;
}

function buildExperiences(
  canonicalName: string,
  category: SeedCategory,
  productIndex: number,
): SeedExperience[] {
  const aspectMap = buildAspectMap(category);
  const positiveKeys = keysByType(category, AspectSentiment.POSITIVE);
  const negativeKeys = keysByType(category, AspectSentiment.NEGATIVE);
  const count = productIndex % 17 === 0 ? 3 : productIndex % 4 === 0 ? 2 : 1;
  const experiences: SeedExperience[] = [];

  for (let i = 0; i < count; i += 1) {
    const seed = hashString(`${canonicalName}:${productIndex}:${i}`);
    const bucket = seed % 100;
    const wouldBuyAgain = chooseWouldBuyAgain(bucket + i * 13);
    const usageDuration = chooseDuration(category.slug, bucket + i * 17);
    const experienceMood = chooseMood(bucket + i * 11, wouldBuyAgain);
    const positiveCount = wouldBuyAgain === WouldBuyAgain.YES ? 2 : 1;
    const negativeCount = wouldBuyAgain === WouldBuyAgain.NO ? 2 : 1;
    const positives = chooseKeys(positiveKeys, positiveCount, seed);
    const negatives =
      wouldBuyAgain === WouldBuyAgain.YES
        ? chooseKeys(negativeKeys, 1, seed + 5).slice(0, bucket % 3 === 0 ? 1 : 0)
        : chooseKeys(negativeKeys, negativeCount, seed + 5);

    experiences.push({
      author: pickHandle(seed + i),
      wouldBuyAgain,
      usageDuration,
      experienceMood,
      wishKnownText: buildWishKnownText(aspectMap, positives, negatives, seed + 7),
      freeText: buildFreeText(canonicalName, seed + 9),
      positive: positives,
      negative: negatives,
    });
  }

  return experiences;
}

function buildSyntheticProduct(category: SeedCategory, productIndex: number): SeedProduct {
  const profile = CATEGORY_PROFILES[category.slug] ?? CATEGORY_PROFILES.smartphone;
  const family = pick(profile.families, productIndex);
  const brand = pick(profile.brands, productIndex * 7 + 3);
  const suffixPool = ['Pro', 'Plus', 'Max', 'Air', 'Core', 'Edge', 'One'];
  const suffix = pick(suffixPool, productIndex * 5 + 1);
  const code = `${String((productIndex % 90) + 10)}${String.fromCharCode(65 + (productIndex % 26))}`;
  const canonicalName = `${brand} ${family} ${suffix} ${code}`;

  const focusKeys = keysByType(category, AspectSentiment.POSITIVE);
  const focusLabel = category.aspects.find((aspect) => aspect.key === (focusKeys[0] ?? ''))?.label ?? category.name;
  const description = buildDescription(category.name, focusLabel, productIndex);

  return {
    canonicalName,
    brand,
    categorySlug: category.slug,
    description,
    experiences: buildExperiences(canonicalName, category, productIndex),
  };
}

export function buildProducts(baseProducts: SeedProduct[], categories: SeedCategory[]): SeedProduct[] {
  const products = [...baseProducts];
  const seen = new Set<string>(baseProducts.map((product) => normalizeProductName(product.canonicalName)));
  const targetCount = Math.max(TARGET_PRODUCT_COUNT, baseProducts.length);

  let syntheticIndex = 0;
  while (products.length < targetCount) {
    const category = categories[syntheticIndex % categories.length];
    const product = buildSyntheticProduct(category, syntheticIndex);
    const normalized = normalizeProductName(product.canonicalName);
    syntheticIndex += 1;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    products.push(product);
  }

  return products;
}

export function buildProductImageUrl(canonicalName: string): string {
  const normalized = normalizeProductName(canonicalName);
  return `/api/products/image/${encodeURIComponent(normalized)}`;
}
