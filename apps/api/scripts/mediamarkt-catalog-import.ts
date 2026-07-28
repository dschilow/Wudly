/* eslint-disable no-console */
/**
 * MediaMarkt bulk catalog importer.
 *
 * This script does not call OpenRouter. It harvests public MediaMarkt product
 * pages per Wudly category, turns them into AgentProductSeed rows, then runs the
 * existing AI-free ProductAgentCurationService. Commit still goes through
 * ProductsService.createCurated(), so duplicate protection, image hunt, external
 * ratings and consensus storage stay identical to the admin pipeline.
 */
import 'reflect-metadata';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  createCuratedProductSchema,
  normalizeProductName,
  type CreateProductResultDto,
} from '@wudly/shared';
import { AppModule } from '../src/app.module';
import { BraveSearchService } from '../src/ai/brave-search.service';
import {
  ProductAgentCurationService,
  type AgentProductCurationDraft,
  type AgentProductSeed,
} from '../src/products/product-agent-curation.service';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MEDIA_MARKT_BASE = 'https://www.mediamarkt.de';
const DEFAULT_OUT_DIR = 'tmp/mediamarkt-catalog-import';
const MAX_HTML_BYTES = 800 * 1024;

interface CategoryTarget {
  slug: string;
  label: string;
  searchQueries: string[];
  includeTerms: string[];
  excludeTerms?: string[];
  priorityTerms: string[];
}

interface CliFlags {
  categories: string[] | null;
  categoryQueries: Array<{ slug: string; query: string }>;
  categoryUrls: Array<{ slug: string; url: string }>;
  seedFile: string | null;
  commit: boolean;
  forceCreate: boolean;
  allowLowScore: boolean;
  harvestOnly: boolean;
  useBrave: boolean;
  productPageProbe: boolean;
  createdByUserId: string | null;
  outDir: string;
  perCategory: number;
  searchPageLimit: number;
  sourceLimit: number;
  minScore: number;
  limit: number | null;
  help: boolean;
}

interface ProductLink {
  url: string;
  title: string | null;
  source: string;
}

interface ProductProbe {
  url: string;
  title: string;
  brand: string | null;
  sku: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  fetched: boolean;
  error: string | null;
}

interface HarvestedProduct extends AgentProductSeed {
  categorySlug: string;
  mediaMarktUrl: string;
  title: string;
  brand: string | null;
  sku: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  relevanceScore: number;
  harvestSource: string;
  pageFetched: boolean;
  error: string | null;
}

interface RunRow {
  seed: HarvestedProduct;
  draft: AgentProductCurationDraft;
  committed: boolean;
  skipped: string | null;
  result: CreateProductResultDto | null;
}

const CATEGORY_TARGETS: CategoryTarget[] = [
  {
    slug: 'saugroboter',
    label: 'Saugroboter',
    searchQueries: ['saugroboter', 'saug wischroboter', 'roborock saugroboter', 'dreame saugroboter'],
    includeTerms: ['saugroboter', 'saug wischroboter', 'wischroboter', 'roborock', 'deebot', 'roomba', 'dreame', 'mova'],
    priorityTerms: ['roborock', 'dreame', 'ecovacs', 'deebot', 'irobot', 'roomba', 'mova', 'eufy', 'narwal'],
  },
  {
    slug: 'akku-staubsauger',
    label: 'Akku-Staubsauger',
    searchQueries: ['akku staubsauger', 'kabelloser staubsauger', 'dyson akku staubsauger', 'bosch unlimited'],
    includeTerms: ['akku staubsauger', 'akkustaubsauger', 'kabelloser staubsauger', 'handstaubsauger', 'dyson v', 'bosch unlimited'],
    priorityTerms: ['dyson', 'bosch unlimited', 'miele triflex', 'dreame', 'shark', 'philips', 'aeg', 'rowenta'],
  },
  {
    slug: 'kaffeevollautomat',
    label: 'Kaffeevollautomat',
    searchQueries: ['kaffeevollautomat', 'espresso vollautomat', 'delonghi kaffeevollautomat', 'jura kaffeevollautomat'],
    includeTerms: ['kaffeevollautomat', 'vollautomat', 'lattego', 'dinamica', 'magnifica', 'jura', 'eq 6', 'eq6', 'eletta'],
    priorityTerms: ['delonghi', 'jura', 'siemens eq', 'philips lattego', 'melitta', 'krups', 'saeco', 'nivona'],
  },
  {
    slug: 'kindersitz',
    label: 'Kindersitz',
    searchQueries: ['kindersitz auto', 'cybex kindersitz', 'maxi cosi kindersitz'],
    includeTerms: ['kindersitz', 'autositz', 'reboarder', 'cybex', 'maxi cosi'],
    priorityTerms: ['cybex', 'maxi cosi', 'britax', 'joie', 'recaro', 'besafe'],
  },
  {
    slug: 'e-bike',
    label: 'E-Bike',
    searchQueries: ['e-bike', 'pedelec', 'e bike trekking'],
    includeTerms: ['e bike', 'ebike', 'pedelec'],
    priorityTerms: ['cube', 'haibike', 'prophete', 'fischer', 'telefunken', 'kalkhoff', 'bosch motor'],
  },
  {
    slug: 'matratze',
    label: 'Matratze',
    searchQueries: ['matratze', 'kaltschaummatratze', 'bett1 matratze'],
    includeTerms: ['matratze', 'kaltschaummatratze', 'taschenfederkernmatratze'],
    priorityTerms: ['bett1', 'emma', 'bodyguard', 'tempur', 'schlaraffia', 'dormia', 'malie'],
  },
  {
    slug: 'pv-speicher',
    label: 'PV-Speicher',
    searchQueries: ['powerstation solar', 'pv speicher', 'ecoflow powerstation', 'anker solix'],
    includeTerms: ['powerstation', 'solargenerator', 'solar generator', 'pv speicher', 'speicher'],
    priorityTerms: ['ecoflow', 'anker solix', 'jackery', 'bluetti', 'zendure', 'goal zero'],
    excludeTerms: ['usb stick', 'speicherkarte', 'ssd', 'festplatte'],
  },
  {
    slug: 'waermepumpe',
    label: 'Waermepumpe',
    searchQueries: ['waermepumpe heizung', 'waermepumpe'],
    includeTerms: ['waermepumpe', 'warmepumpe'],
    priorityTerms: ['daikin', 'viessmann', 'vaillant', 'bosch', 'stiebel', 'wolf', 'buderus'],
    excludeTerms: ['trockner', 'waschtrockner', 'waermepumpentrockner', 'warmepumpentrockner'],
  },
  {
    slug: 'smartphone',
    label: 'Smartphone',
    searchQueries: ['smartphone ohne vertrag', 'handy ohne vertrag', 'iphone', 'samsung galaxy'],
    includeTerms: ['smartphone', 'iphone', 'galaxy', 'pixel', 'redmi', 'xiaomi', 'motorola', 'honor', 'oneplus', 'nothing phone'],
    priorityTerms: ['iphone', 'galaxy s', 'galaxy a', 'pixel', 'redmi note', 'xiaomi', 'motorola edge', 'honor', 'oneplus', 'nothing phone'],
  },
  {
    slug: 'fernseher',
    label: 'Fernseher',
    searchQueries: ['fernseher 55 zoll', 'fernseher 65 zoll', 'oled tv', 'qled tv', '4k smart tv'],
    includeTerms: ['fernseher', 'tv', 'smart tv', 'oled', 'qled', 'mini led', 'uhd', '4k', 'ambilight'],
    priorityTerms: [
      'lg oled',
      'samsung qled',
      'samsung neo qled',
      'sony bravia',
      'philips ambilight',
      'tcl',
      'hisense',
      'panasonic',
      'grundig',
    ],
    excludeTerms: ['wandhalterung', 'halterung', 'soundbar', 'receiver', 'fernbedienung', 'hdmi kabel'],
  },
  {
    slug: 'laptop',
    label: 'Laptop',
    searchQueries: ['laptop notebook', 'notebook', 'macbook', 'gaming laptop'],
    includeTerms: ['laptop', 'notebook', 'macbook', 'thinkpad', 'vivobook', 'ideapad', 'pavilion', 'chromebook', 'surface pro'],
    priorityTerms: ['macbook', 'lenovo', 'asus vivobook', 'asus zenbook', 'hp pavilion', 'hp envy', 'acer aspire', 'dell xps', 'surface'],
  },
  {
    slug: 'waschmaschine',
    label: 'Waschmaschine',
    searchQueries: ['waschmaschine frontlader', 'waschmaschine', 'bosch waschmaschine', 'siemens waschmaschine'],
    includeTerms: ['waschmaschine', 'frontlader', 'toplader', 'waschtrockner'],
    priorityTerms: ['bosch serie', 'siemens iq', 'miele', 'aeg', 'samsung', 'lg', 'beko', 'bauknecht'],
    excludeTerms: ['zubehoer', 'sockel', 'anschluss', 'reiniger'],
  },
];

const COMMON_EXCLUDE_TERMS = [
  'huelle',
  'hulle',
  'case',
  'cover',
  'schutzfolie',
  'panzerglas',
  'displayglas',
  'ladekabel',
  'kabel',
  'adapter',
  'netzteil',
  'ersatzteil',
  'ersatz',
  'zubehoer',
  'zubehor',
  'camera',
  'kamera',
  'camcorder',
  'digitalkamera',
  'mirrorless',
  'objektiv',
  'lumix',
  'werbedisplay',
  'commercial display',
  'garantie',
  'versicherung',
  'refurbished',
  'gebraucht',
  'b ware',
  'b-ware',
];

loadEnv(resolve(process.cwd(), '.env'));
loadEnv(resolve(process.cwd(), 'apps/api/.env'));

void main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const targets = selectedTargets(flags);
  const harvested = flags.seedFile
    ? parseHarvestedProducts(readFileSync(resolve(flags.seedFile), 'utf8'), flags.seedFile)
    : await harvestAll(targets, flags);
  const limited = flags.limit ? harvested.slice(0, flags.limit) : harvested;

  writeHarvestReports(limited, flags);
  console.warn(
    `[mediamarkt-catalog] harvested=${limited.length} categories=${new Set(limited.map((p) => p.categorySlug)).size}`,
  );

  if (flags.harvestOnly) {
    console.warn(`[mediamarkt-catalog] harvest-only; wrote reports to ${flags.outDir}`);
    return;
  }

  if (limited.length === 0) {
    console.warn('[mediamarkt-catalog] no products to research.');
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const service = app.get(ProductAgentCurationService);
  const rows: RunRow[] = [];

  try {
    console.warn(
      `[mediamarkt-catalog] mode=${flags.commit ? 'commit' : 'dry-run'} products=${limited.length}`,
    );
    for (let index = 0; index < limited.length; index += 1) {
      const seed = limited[index]!;
      const draft = await service.research(seed, {
        minQualityScore: flags.minScore,
        sourceLimit: flags.sourceLimit,
      });
      normalizeDraftPayload(draft, seed);
      const prefix = `[${index + 1}/${limited.length}] ${seed.query}`;
      console.warn(
        `${prefix}: score=${draft.quality.score} ready=${draft.quality.ready ? 'yes' : 'no'} ` +
          `ratings=${draft.payload.ratings.length} specs=${draft.payload.specs.length} ` +
          `themes=${draft.payload.positiveThemes.length}+${draft.payload.negativeThemes.length}`,
      );

      let skipped: string | null = null;
      let result: CreateProductResultDto | null = null;
      let committed = false;
      if (flags.commit) {
        if (!draft.quality.ready && !flags.allowLowScore) {
          skipped = `quality-below-${flags.minScore}`;
        } else {
          result = await service.commit(draft, {
            createdByUserId: flags.createdByUserId,
            forceCreate: flags.forceCreate,
          });
          committed = result.created;
          console.warn(
            `${prefix}: ${
              result.created ? `created=${result.product.id}` : `duplicate-candidates=${result.candidates.length}`
            }`,
          );
        }
      }

      rows.push({ seed, draft, committed, skipped, result });
    }
  } finally {
    await app.close();
  }

  writeRunReports(rows, flags);
  const ready = rows.filter((row) => row.draft.quality.ready).length;
  const created = rows.filter((row) => row.committed).length;
  console.warn(
    `[mediamarkt-catalog] wrote reports to ${flags.outDir}; ready=${ready}/${rows.length}; created=${created}`,
  );
}

async function harvestAll(targets: CategoryTarget[], flags: CliFlags): Promise<HarvestedProduct[]> {
  const brave = flags.useBrave
    ? new BraveSearchService((process.env.BRAVE_SEARCH_KEY ?? '').trim() || null)
    : null;
  const all: HarvestedProduct[] = [];
  for (const target of targets) {
    const products = await harvestCategory(target, flags, brave);
    all.push(...products);
    console.warn(`[mediamarkt-catalog] ${target.slug}: harvested=${products.length}`);
  }
  return dedupeHarvested(all);
}

async function harvestCategory(
  target: CategoryTarget,
  flags: CliFlags,
  brave: BraveSearchService | null,
): Promise<HarvestedProduct[]> {
  const queryOverrides = flags.categoryQueries
    .filter((entry) => entry.slug === target.slug)
    .map((entry) => entry.query);
  const queries = [...new Set([...target.searchQueries, ...queryOverrides])];
  const links: ProductLink[] = [];

  for (const url of mediaMarktSearchUrls(target.slug, queries, flags)) {
    const html = await fetchText(url);
    if (html.ok) {
      links.push(...extractMediaMarktLinks(html.text, url, 'mediamarkt-page'));
    } else {
      console.warn(`[mediamarkt-catalog] fetch failed ${url}: ${html.error}`);
    }
    if (links.length >= flags.perCategory * 4) break;
  }

  if (brave?.enabled && links.length < flags.perCategory) {
    for (const query of queries) {
      const results = await brave.web(`site:mediamarkt.de/de/product ${query}`, 20);
      links.push(
        ...results
          .map((result): ProductLink | null => {
            const url = cleanMediaMarktUrl(result.url, MEDIA_MARKT_BASE);
            if (!url) return null;
            return { url, title: cleanSearchTitle(result.title), source: 'brave' };
          })
          .filter((item): item is ProductLink => item !== null),
      );
      if (links.length >= flags.perCategory * 3) break;
    }
  }

  const uniqueLinks = dedupeLinks(links).slice(0, Math.max(flags.perCategory * 4, flags.perCategory + 30));
  const probes = flags.productPageProbe
    ? await mapLimit(uniqueLinks, 4, (link) => probeProductPage(link))
    : uniqueLinks.map((link) => probeFromLink(link));
  const candidates: HarvestedProduct[] = [];
  for (const [index, probe] of probes.entries()) {
    if (!categoryAllows(target, probe.title)) continue;
    const product: HarvestedProduct = {
      query: probe.title,
      brand: probe.brand,
      categorySlug: target.slug,
      productUrl: probe.url,
      imageUrl: null,
      ean: null,
      mediaMarktUrl: probe.url,
      title: probe.title,
      sku: probe.sku,
      ratingValue: probe.ratingValue,
      ratingCount: probe.ratingCount,
      relevanceScore: 0,
      harvestSource: uniqueLinks.find((link) => normalizeUrl(link.url) === normalizeUrl(probe.url))?.source ?? 'unknown',
      pageFetched: probe.fetched,
      error: probe.error,
    };
    product.relevanceScore = relevanceScore(target, product, index);
    candidates.push(product);
  }
  return candidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore || (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
    .slice(0, flags.perCategory);
}

function mediaMarktSearchUrls(slug: string, queries: string[], flags: CliFlags): string[] {
  const urls: string[] = [];
  for (const entry of flags.categoryUrls.filter((item) => item.slug === slug)) {
    for (let page = 1; page <= flags.searchPageLimit; page += 1) {
      urls.push(withPageParam(entry.url, page));
    }
  }
  for (const query of queries) {
    for (let page = 1; page <= flags.searchPageLimit; page += 1) {
      const url = new URL('/de/search.html', MEDIA_MARKT_BASE);
      url.searchParams.set('query', query);
      if (page > 1) url.searchParams.set('page', String(page));
      urls.push(url.toString());
    }
  }
  return [...new Set(urls)];
}

async function probeProductPage(link: ProductLink): Promise<ProductProbe> {
  const fallback = probeFromLink(link);
  const fetched = await fetchText(link.url);
  if (!fetched.ok) return { ...fallback, fetched: false, error: fetched.error };

  const facts = extractProductFacts(fetched.text, link.url);
  const title = cleanProductTitle(facts.title || link.title || titleFromMediaMarktUrl(link.url));
  return {
    url: link.url,
    title,
    brand: facts.brand || brandFromTitle(title),
    sku: facts.sku || skuFromUrl(link.url) || null,
    ratingValue: facts.ratingValue,
    ratingCount: facts.ratingCount,
    fetched: true,
    error: null,
  };
}

function probeFromLink(link: ProductLink): ProductProbe {
  const title = cleanProductTitle(link.title || titleFromMediaMarktUrl(link.url));
  return {
    url: link.url,
    title,
    brand: brandFromTitle(title),
    sku: skuFromUrl(link.url) || null,
    ratingValue: null,
    ratingCount: null,
    fetched: false,
    error: null,
  };
}

function normalizeDraftPayload(draft: AgentProductCurationDraft, seed: HarvestedProduct): void {
  const payload = { ...draft.payload };
  const seedName = cleanProductTitle(seed.query);
  payload.canonicalName = seedName;
  payload.brand = seed.brand ?? payload.brand;
  payload.categorySlug = seed.categorySlug;
  delete payload.imageUrl;

  if (payload.productUrl && isMediaMarktUrl(payload.productUrl)) {
    const official = bestNonRetailProductUrl(draft);
    if (official) payload.productUrl = official;
    else delete payload.productUrl;
  }
  payload.sourceUrls = mergeUrls([
    seed.mediaMarktUrl,
    ...payload.sourceUrls,
    ...draft.sourceEvidence.filter((source) => source.fetched).map((source) => source.url),
  ]).slice(0, 20);
  payload.description = buildNeutralDescription(seedName, payload.specs);

  const parsed = createCuratedProductSchema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Generated payload failed validation for ${seed.query}: ${issues}`);
  }
  draft.payload = parsed.data;
}

function bestNonRetailProductUrl(draft: AgentProductCurationDraft): string | undefined {
  return draft.sourceEvidence.find((source) => {
    if (!source.fetched || source.sourceKind === 'rating') return false;
    return !isRetailOrRatingUrl(source.url);
  })?.url;
}

function buildNeutralDescription(name: string, specs: Array<{ label: string; value: string }>): string {
  const size = specValue(specs, /bildschirmdiagonale|diagonale|screen size|displaygroesse/i);
  const panel = specValue(specs, /display technologie|display-technologie|panel|technologie/i);
  const quality = specValue(specs, /bildqualitaet|aufloesung|resolution/i);
  const os = specValue(specs, /betriebssystem|operating system|smart tv/i);
  const hdr = specValue(specs, /\bhdr\b|dolby vision|hlg/i);
  const refresh = specValue(specs, /bildwiederhol|refresh|hertz|hz/i);
  const details = [
    size ? `Bildschirmdiagonale: ${size}` : null,
    panel ? `Display-Technologie: ${panel}` : null,
    quality ? `Bildqualität/Auflösung: ${quality}` : null,
    os ? `Smart-TV-System: ${os}` : null,
    hdr ? `HDR: ${hdr}` : null,
    refresh ? `Bildwiederholrate: ${refresh}` : null,
  ].filter(Boolean);
  const suffix = details.length > 0 ? ` Wichtige Eckdaten: ${details.slice(0, 5).join('; ')}.` : '';
  return `Der ${name} ist ein Fernseher aus dem Wudly-Katalog. Die Angaben stammen aus MediaMarkt-, Hersteller- und Bewertungsquellen und dienen der sachlichen Einordnung vor dem Kauf.${suffix}`.slice(0, 2000);
}

function specValue(specs: Array<{ label: string; value: string }>, pattern: RegExp): string | null {
  const match = specs.find((spec) => pattern.test(normalizeForMatch(spec.label)));
  return match?.value.trim() || null;
}
function selectedTargets(flags: CliFlags): CategoryTarget[] {
  if (!flags.categories) return CATEGORY_TARGETS;
  const wanted = new Set(flags.categories);
  const targets = CATEGORY_TARGETS.filter((target) => wanted.has(target.slug));
  const missing = [...wanted].filter((slug) => !CATEGORY_TARGETS.some((target) => target.slug === slug));
  if (missing.length > 0) throw new Error(`Unknown category slug(s): ${missing.join(', ')}`);
  return targets;
}

function parseArgs(args: string[]): CliFlags {
  const flags: CliFlags = {
    categories: null,
    categoryQueries: [],
    categoryUrls: [],
    seedFile: null,
    commit: false,
    forceCreate: false,
    allowLowScore: false,
    harvestOnly: false,
    useBrave: true,
    productPageProbe: true,
    createdByUserId: null,
    outDir: DEFAULT_OUT_DIR,
    perCategory: 30,
    searchPageLimit: 4,
    sourceLimit: 10,
    minScore: 70,
    limit: null,
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    const next = () => {
      i += 1;
      if (i >= args.length) throw new Error(`Missing value after ${arg}`);
      return args[i]!;
    };
    if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--commit') flags.commit = true;
    else if (arg === '--dry-run') flags.commit = false;
    else if (arg === '--force-create') flags.forceCreate = true;
    else if (arg === '--allow-low-score') flags.allowLowScore = true;
    else if (arg === '--harvest-only' || arg === '--skip-research') flags.harvestOnly = true;
    else if (arg === '--no-brave') flags.useBrave = false;
    else if (arg === '--no-product-page-probe') flags.productPageProbe = false;
    else if (arg === '--seed-file') flags.seedFile = next();
    else if (arg.startsWith('--seed-file=')) flags.seedFile = arg.slice('--seed-file='.length);
    else if (arg === '--categories') flags.categories = parseCsv(next());
    else if (arg.startsWith('--categories=')) flags.categories = parseCsv(arg.slice('--categories='.length));
    else if (arg === '--category') flags.categories = [...(flags.categories ?? []), next()];
    else if (arg.startsWith('--category=')) flags.categories = [...(flags.categories ?? []), arg.slice('--category='.length)];
    else if (arg === '--category-query') flags.categoryQueries.push(parsePair(next(), '--category-query'));
    else if (arg.startsWith('--category-query=')) {
      flags.categoryQueries.push(parsePair(arg.slice('--category-query='.length), '--category-query'));
    } else if (arg === '--category-url') flags.categoryUrls.push(parsePair(next(), '--category-url'));
    else if (arg.startsWith('--category-url=')) {
      flags.categoryUrls.push(parsePair(arg.slice('--category-url='.length), '--category-url'));
    } else if (arg === '--created-by') flags.createdByUserId = next();
    else if (arg.startsWith('--created-by=')) flags.createdByUserId = arg.slice('--created-by='.length);
    else if (arg === '--out') flags.outDir = next();
    else if (arg.startsWith('--out=')) flags.outDir = arg.slice('--out='.length);
    else if (arg === '--per-category') flags.perCategory = parsePositiveInt(next(), '--per-category');
    else if (arg.startsWith('--per-category=')) {
      flags.perCategory = parsePositiveInt(arg.slice('--per-category='.length), '--per-category');
    } else if (arg === '--search-pages') flags.searchPageLimit = parsePositiveInt(next(), '--search-pages');
    else if (arg.startsWith('--search-pages=')) {
      flags.searchPageLimit = parsePositiveInt(arg.slice('--search-pages='.length), '--search-pages');
    } else if (arg === '--source-limit') flags.sourceLimit = parsePositiveInt(next(), '--source-limit');
    else if (arg.startsWith('--source-limit=')) {
      flags.sourceLimit = parsePositiveInt(arg.slice('--source-limit='.length), '--source-limit');
    } else if (arg === '--min-score') flags.minScore = parsePositiveInt(next(), '--min-score');
    else if (arg.startsWith('--min-score=')) flags.minScore = parsePositiveInt(arg.slice('--min-score='.length), '--min-score');
    else if (arg === '--limit') flags.limit = parsePositiveInt(next(), '--limit');
    else if (arg.startsWith('--limit=')) flags.limit = parsePositiveInt(arg.slice('--limit='.length), '--limit');
    else throw new Error(`Unknown argument: ${arg}`);
  }

  flags.perCategory = clampInt(flags.perCategory, 1, 100);
  flags.searchPageLimit = clampInt(flags.searchPageLimit, 1, 20);
  flags.sourceLimit = clampInt(flags.sourceLimit, 3, 20);
  flags.minScore = clampInt(flags.minScore, 1, 100);
  return flags;
}

function parseHarvestedProducts(raw: string, label: string): HarvestedProduct[] {
  const parsed = JSON.parse(raw.trim()) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${label} must contain a JSON array.`);
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`${label} #${index + 1}: expected object.`);
    const row = entry as Record<string, unknown>;
    const query = stringField(row, 'query') || stringField(row, 'title');
    const categorySlug = stringField(row, 'categorySlug');
    const productUrl = stringField(row, 'productUrl') || stringField(row, 'mediaMarktUrl');
    if (!query || !categorySlug || !productUrl) {
      throw new Error(`${label} #${index + 1}: query, categorySlug and productUrl/mediaMarktUrl are required.`);
    }
    return {
      query,
      brand: stringField(row, 'brand'),
      categorySlug,
      productUrl,
      imageUrl: null,
      ean: null,
      mediaMarktUrl: productUrl,
      title: stringField(row, 'title') || query,
      sku: stringField(row, 'sku'),
      ratingValue: numberField(row, 'ratingValue'),
      ratingCount: numberField(row, 'ratingCount'),
      relevanceScore: numberField(row, 'relevanceScore') ?? 0,
      harvestSource: stringField(row, 'harvestSource') || 'seed-file',
      pageFetched: Boolean(row.pageFetched),
      error: stringField(row, 'error'),
    };
  });
}

function writeHarvestReports(products: HarvestedProduct[], flags: CliFlags): void {
  const outDir = resolve(flags.outDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'mediamarkt-seeds.json'), JSON.stringify(products, null, 2));
  writeFileSync(
    resolve(outDir, 'mediamarkt-seeds.txt'),
    products.map((product) => `${product.categorySlug}\t${product.query}\t${product.mediaMarktUrl}`).join('\n'),
  );
  writeFileSync(resolve(outDir, 'mediamarkt-harvest.md'), harvestMarkdown(products, flags));
}

function writeRunReports(rows: RunRow[], flags: CliFlags): void {
  const outDir = resolve(flags.outDir);
  mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: flags.commit ? 'commit' : 'dry-run',
    options: {
      perCategory: flags.perCategory,
      minScore: flags.minScore,
      sourceLimit: flags.sourceLimit,
      forceCreate: flags.forceCreate,
      allowLowScore: flags.allowLowScore,
    },
    products: rows.map((row) => ({
      seed: row.seed,
      quality: row.draft.quality,
      payload: row.draft.payload,
      sourceEvidence: row.draft.sourceEvidence.map((source) => ({
        url: source.url,
        title: source.title,
        fetched: source.fetched,
        error: source.error,
        sourceKind: source.sourceKind,
        specs: source.specs.length,
        ratings: source.ratings.length,
        positiveThemes: source.positiveThemes.length,
        negativeThemes: source.negativeThemes.length,
      })),
      committed: row.committed,
      skipped: row.skipped,
      result: row.result,
    })),
  };
  writeFileSync(resolve(outDir, 'mediamarkt-catalog-import.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    resolve(outDir, 'mediamarkt-payloads.json'),
    JSON.stringify(rows.map((row) => row.draft.payload), null, 2),
  );
  writeFileSync(resolve(outDir, 'mediamarkt-catalog-import.md'), runMarkdown(rows, flags));
}

function harvestMarkdown(products: HarvestedProduct[], flags: CliFlags): string {
  const byCategory = new Map<string, HarvestedProduct[]>();
  for (const product of products) {
    byCategory.set(product.categorySlug, [...(byCategory.get(product.categorySlug) ?? []), product]);
  }
  const lines = [
    '# MediaMarkt Harvest',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Per category target: ${flags.perCategory}`,
    `Products: ${products.length}`,
    '',
    '| Category | Count |',
    '|---|---:|',
  ];
  for (const target of CATEGORY_TARGETS) {
    if (!byCategory.has(target.slug)) continue;
    lines.push(`| ${target.slug} | ${byCategory.get(target.slug)!.length} |`);
  }
  lines.push('', '| # | Category | Product | Score | MM ratings | Source | URL |', '|---:|---|---|---:|---:|---|---|');
  products.forEach((product, index) => {
    const ratingCount = product.ratingCount === null ? '-' : String(product.ratingCount);
    lines.push(
      `| ${index + 1} | ${product.categorySlug} | ${escapeMd(product.query)} | ` +
        `${Math.round(product.relevanceScore)} | ${ratingCount} | ${product.harvestSource} | ${product.mediaMarktUrl} |`,
    );
  });
  return lines.join('\n');
}

function runMarkdown(rows: RunRow[], flags: CliFlags): string {
  const ready = rows.filter((row) => row.draft.quality.ready).length;
  const created = rows.filter((row) => row.committed).length;
  const lines = [
    '# MediaMarkt Catalog Import',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${flags.commit ? 'commit' : 'dry-run'}`,
    `Ready: ${ready}/${rows.length}`,
    `Created: ${created}/${rows.length}`,
    '',
    '| # | Category | Product | Score | Ready | Ratings | Specs | Themes | Result |',
    '|---:|---|---|---:|---|---:|---:|---:|---|',
  ];
  rows.forEach((row, index) => {
    const result = row.result
      ? row.result.created
        ? `created ${row.result.product.id}`
        : `${row.result.candidates.length} duplicate candidates`
      : row.skipped || '-';
    lines.push(
      `| ${index + 1} | ${row.seed.categorySlug} | ${escapeMd(row.draft.payload.canonicalName)} | ` +
        `${row.draft.quality.score} | ${row.draft.quality.ready ? 'yes' : 'no'} | ` +
        `${row.draft.payload.ratings.length} | ${row.draft.payload.specs.length} | ` +
        `${row.draft.payload.positiveThemes.length + row.draft.payload.negativeThemes.length} | ${escapeMd(result)} |`,
    );
  });
  lines.push('', 'Dry run writes no products. Review `mediamarkt-payloads.json` before using `--commit`.');
  return lines.join('\n');
}

function extractMediaMarktLinks(html: string, baseUrl: string, source: string): ProductLink[] {
  const out: ProductLink[] = [];
  const normalized = decodeHtmlEntities(html)
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/');
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/de\/product\/[^"']*?-\d{5,}\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of normalized.matchAll(anchorPattern)) {
    const url = cleanMediaMarktUrl(match[1] ?? '', baseUrl);
    if (!url) continue;
    out.push({ url, title: cleanText(match[2] ?? '') || null, source });
  }
  const urlPattern = /https?:\/\/(?:www\.)?mediamarkt\.de\/de\/product\/[^"'<>\s\\]+?-\d{5,}\.html/gi;
  for (const match of normalized.matchAll(urlPattern)) {
    const url = cleanMediaMarktUrl(match[0], baseUrl);
    if (url) out.push({ url, title: null, source });
  }
  const pathPattern = /\/de\/product\/[^"'<>\s\\]+?-\d{5,}\.html/gi;
  for (const match of normalized.matchAll(pathPattern)) {
    const url = cleanMediaMarktUrl(match[0], baseUrl);
    if (url) out.push({ url, title: null, source });
  }
  return dedupeLinks(out);
}

function extractProductFacts(
  html: string,
  pageUrl: string,
): { title: string | null; brand: string | null; sku: string | null; ratingValue: number | null; ratingCount: number | null } {
  const products = extractJsonLdProducts(html);
  const first = products[0];
  const jsonName = first ? stringValue(first.name) : null;
  const jsonBrand = first ? brandValue(first.brand) : null;
  const sku = (first ? stringValue(first.sku) || stringValue(first.mpn) : null) || skuFromUrl(pageUrl);
  const rating = first ? aggregateRating(first.aggregateRating) : { ratingValue: null, ratingCount: null };
  return {
    title: jsonName || metaContent(html, ['og:title', 'twitter:title']) || h1Text(html) || titleText(html),
    brand: jsonBrand,
    sku,
    ratingValue: rating.ratingValue,
    ratingCount: rating.ratingCount,
  };
}

function aggregateRating(value: unknown): { ratingValue: number | null; ratingCount: number | null } {
  if (!isRecord(value)) return { ratingValue: null, ratingCount: null };
  const ratingValue = numberValue(value.ratingValue);
  const ratingCount = numberValue(value.ratingCount) ?? numberValue(value.reviewCount);
  return {
    ratingValue,
    ratingCount: ratingCount === null ? null : Math.round(ratingCount),
  };
}
function extractJsonLdProducts(html: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = [];
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    const raw = decodeHtmlEntities(script[1] ?? '').trim();
    if (!raw) continue;
    const parsed = safeJsonParse(raw);
    if (parsed === null) continue;
    for (const node of flattenJsonLd(parsed)) {
      if (isJsonLdType(node, 'Product')) products.push(node);
    }
  }
  return products;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (!isRecord(current)) continue;
    out.push(current);
    const graph = current['@graph'];
    if (Array.isArray(graph)) {
      for (const item of graph) stack.push(item);
    }
  }
  return out;
}

function isJsonLdType(node: Record<string, unknown>, type: string): boolean {
  const raw = node['@type'];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some((value) => String(value).toLowerCase() === type.toLowerCase());
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = escapeRegex(key);
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
      const value = cleanText(pattern.exec(html)?.[1] ?? '');
      if (value) return value;
    }
  }
  return null;
}

function h1Text(html: string): string | null {
  return cleanText(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '') || null;
}

function titleText(html: string): string | null {
  return cleanText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '') || null;
}

async function fetchText(url: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    const contentType = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml|application\/json/i.test(contentType)) {
      return { ok: false, error: `content-type ${contentType || 'unknown'}` };
    }
    return { ok: true, text: await readLimitedText(res, MAX_HTML_BYTES) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function readLimitedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  while (text.length < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  void reader.cancel().catch(() => undefined);
  return text.slice(0, maxBytes);
}

function cleanMediaMarktUrl(raw: string, baseUrl: string): string | null {
  try {
    const decoded = decodeHtmlEntities(raw).replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    const parsed = new URL(decoded, baseUrl);
    if (!isMediaMarktHost(parsed.hostname)) return null;
    if (!parsed.pathname.includes('/de/product/') || !/-\d{5,}\.html$/i.test(parsed.pathname)) return null;
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function withPageParam(rawUrl: string, page: number): string {
  try {
    const url = new URL(rawUrl);
    if (page > 1) url.searchParams.set('page', String(page));
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function categoryAllows(target: CategoryTarget, title: string): boolean {
  const text = normalizeForMatch(title);
  if (COMMON_EXCLUDE_TERMS.some((term) => text.includes(term))) return false;
  if ((target.excludeTerms ?? []).some((term) => text.includes(normalizeForMatch(term)))) return false;
  return target.includeTerms.some((term) => text.includes(normalizeForMatch(term)));
}

function relevanceScore(target: CategoryTarget, product: HarvestedProduct, index: number): number {
  const text = normalizeForMatch(`${product.brand ?? ''} ${product.title}`);
  let score = Math.max(0, 1000 - index * 4);

  const priorityHits = target.priorityTerms.filter((term) => text.includes(normalizeForMatch(term))).length;
  score += Math.min(priorityHits, 3) * 120;

  if (product.ratingCount !== null && product.ratingCount > 0) {
    score += Math.min(360, Math.log10(product.ratingCount + 1) * 120);
  }
  if (product.ratingValue !== null && product.ratingValue >= 4.4) score += 60;
  else if (product.ratingValue !== null && product.ratingValue >= 4.0) score += 30;

  if (product.brand && target.priorityTerms.some((term) => normalizeForMatch(term).startsWith(normalizeForMatch(product.brand!)))) {
    score += 40;
  }
  if (/\b(set|bundle|starter kit|zubehoerpaket)\b/i.test(text)) score -= 80;
  if (product.harvestSource === 'brave') score -= 20;
  return score;
}

function dedupeLinks(links: ProductLink[]): ProductLink[] {
  const seen = new Set<string>();
  const out: ProductLink[] = [];
  for (const link of links) {
    const key = normalizeUrl(link.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

function dedupeHarvested(products: HarvestedProduct[]): HarvestedProduct[] {
  const seen = new Set<string>();
  const out: HarvestedProduct[] = [];
  for (const product of products) {
    const key = product.sku ? `${product.categorySlug}:sku:${product.sku}` : normalizeUrl(product.mediaMarktUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  return out;
}

function mergeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!raw || !/^https?:\/\//i.test(raw)) continue;
    const normalized = normalizeUrl(raw);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(raw);
  }
  return out;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

function isMediaMarktUrl(url: string): boolean {
  try {
    return isMediaMarktHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isMediaMarktHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'mediamarkt.de' || host.endsWith('.mediamarkt.de');
}

function isRetailOrRatingUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return /mediamarkt|saturn|amazon|ebay|idealo|geizhals|billiger|testberichte|test\.de|chip|notebookcheck|connect|trusted|review|bewertungen/.test(
      host,
    );
  } catch {
    return true;
  }
}

function titleFromMediaMarktUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(segment)
      .replace(/\.html$/i, '')
      .replace(/-\d{5,}$/i, '')
      .replace(/^_+/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return url;
  }
}

function cleanSearchTitle(value: string | null): string | null {
  if (!value) return null;
  const cleaned = cleanProductTitle(value.replace(/\s+[|-]\s+MediaMarkt.*$/i, ''));
  return cleaned.length >= 3 ? cleaned : null;
}

function cleanProductTitle(value: string): string {
  return cleanText(value)
    .replace(/ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢|Ã¢â€žÂ¢|â„¢/g, '')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“|Ã¢â‚¬â€œ|â€“|–/g, '-')
    .replace(/\s+[|I-]\s+(Media\s*Markt|MediaMarkt|Saturn).*$/i, '')
    .replace(/\s+kaufen\s+\S?\s*media\s*markt.*$/i, '')
    .replace(/\b(online kaufen|bei mediamarkt kaufen|bei mediamarkt|kaufen bei mediamarkt)\b/gi, '')
    .replace(/\s+kaufen$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function brandFromTitle(title: string): string | null {
  const first = title.trim().split(/\s+/)[0];
  if (!first || first.length > 40) return null;
  return first.replace(/[^\p{L}\p{N}-]/gu, '') || null;
}

function skuFromUrl(url: string): string | null {
  try {
    return new URL(url).pathname.match(/-(\d{5,})\.html$/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return cleanText(value) || null;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return stringValue(value[0]);
  if (isRecord(value)) return stringValue(value.name) || stringValue(value['@id']);
  return null;
}

function brandValue(value: unknown): string | null {
  if (typeof value === 'string') return cleanText(value) || null;
  if (isRecord(value)) return stringValue(value.name);
  return null;
}

function numberField(row: Record<string, unknown>, key: string): number | null {
  return numberValue(row[key]);
}

function stringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').replace(/[^\d.]+/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeForMatch(value: string): string {
  return normalizeProductName(value)
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss');
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePair(value: string, flag: string): { slug: string; url: string; query: string } {
  const separator = value.indexOf('=');
  if (separator < 1) throw new Error(`${flag} expects slug=value.`);
  const slug = value.slice(0, separator).trim();
  const right = value.slice(separator + 1).trim();
  if (!slug || !right) throw new Error(`${flag} expects slug=value.`);
  return { slug, url: right, query: right };
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeMd(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]!, current);
    }
  });
  await Promise.all(workers);
  return results;
}

function printHelp(): void {
  console.log(`MediaMarkt catalog import (AI-free, no OpenRouter)

Usage:
  pnpm --filter @wudly/api catalog:mediamarkt -- --harvest-only --per-category=30
  pnpm --filter @wudly/api catalog:mediamarkt -- --categories=smartphone,laptop --per-category=30
  pnpm --filter @wudly/api catalog:mediamarkt -- --seed-file tmp/mediamarkt-catalog-import/mediamarkt-seeds.json
  pnpm --filter @wudly/api catalog:mediamarkt -- --commit --per-category=30

Safety:
  --dry-run                  Default. Research + reports only; writes no products.
  --commit                   Insert ready products through createCurated().
  --force-create             Bypass duplicate soft-blocks during commit.
  --allow-low-score          Commit drafts below --min-score. Review first.
  --harvest-only             Only collect MediaMarkt product seeds.

Scope:
  --categories=a,b           Wudly category slugs. Default: all known slugs.
  --category=slug            Add one category slug. Repeatable.
  --per-category=30          Product target per category. Max 100.
  --limit=N                  Process first N harvested products globally.
  --category-query=s=q       Add MediaMarkt search query for category slug.
  --category-url=s=https://  Add a MediaMarkt category/listing URL for slug.
  --search-pages=4           Search/listing pages fetched per query/url.

Research:
  --source-limit=10          Source pages fetched per product.
  --min-score=70             Readiness threshold.
  --no-brave                 Disable Brave fallback for finding MediaMarkt URLs.
  --no-product-page-probe    Do not fetch product pages while harvesting.
  --created-by=USER_ID       Attribute created products to an admin user.
  --out=DIR                  Report directory. Default: ${DEFAULT_OUT_DIR}.
`);
}

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
