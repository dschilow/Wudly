import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  normalizeProductName,
  normalizeProductNameLoose,
  tokenSimilarity,
  tokenize,
  DEFAULT_SIMILARITY_THRESHOLDS,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ProductWithRelations } from './product.mapper';

export interface MatchCandidate {
  product: ProductWithRelations;
  similarity: number;
}

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;
const SEARCH_MIN_SIMILARITY = 0.18;
const SEARCH_FALLBACK_LIMIT = 1200;
const MAX_PREFILTER_TOKENS = 6;
const MAX_SCORE_TOKENS = 10;

const CATEGORY_ALIASES = [
  {
    slug: 'saugroboter',
    aliases: [
      'saugroboter',
      'saug roboter',
      'roboter sauger',
      'staubsauger roboter',
      'wischroboter',
      'wisch sauger',
      'robot vacuum',
      'staubsauger',
    ],
  },
  {
    slug: 'akku-staubsauger',
    aliases: [
      'akku staubsauger',
      'akkusauger',
      'akku sauger',
      'kabelloser staubsauger',
      'kabellos sauger',
      'handstaubsauger',
      'bodenstaubsauger',
      'staubsauger',
      'sauger',
      'vacuum',
    ],
  },
  {
    slug: 'kaffeevollautomat',
    aliases: [
      'kaffeevollautomat',
      'kaffee automat',
      'kaffeeautomat',
      'kaffeemaschine',
      'espresso maschine',
      'espresso',
      'cappuccino',
      'vollautomat',
      'milchschaum',
    ],
  },
  {
    slug: 'kindersitz',
    aliases: [
      'kindersitz',
      'kinder sitz',
      'autositz',
      'auto sitz',
      'kinder autositz',
      'reboarder',
      'isofix',
      'baby sitz',
    ],
  },
  {
    slug: 'e-bike',
    aliases: [
      'e bike',
      'ebike',
      'pedelec',
      'elektro fahrrad',
      'elektrisches fahrrad',
      'fahrrad',
      'bike',
      'cargo bike',
    ],
  },
  {
    slug: 'matratze',
    aliases: [
      'matratze',
      'matraze',
      'bett',
      'bett matratze',
      'schaum matratze',
      'sleep',
      'schlaf',
      'haertegrad',
      'hartergrad',
    ],
  },
  {
    slug: 'pv-speicher',
    aliases: [
      'pv speicher',
      'pvspeicher',
      'solar speicher',
      'solarspeicher',
      'stromspeicher',
      'batteriespeicher',
      'akku speicher',
      'heim speicher',
      'heimspeicher',
      'photovoltaik speicher',
    ],
  },
  {
    slug: 'waermepumpe',
    aliases: [
      'waermepumpe',
      'warmepumpe',
      'waerme pumpe',
      'heizung',
      'heat pump',
      'luft wasser',
      'klima heizung',
      'heizsystem',
    ],
  },
  {
    slug: 'smartphone',
    aliases: [
      'smartphone',
      'handy',
      'mobiltelefon',
      'phone',
      'iphone',
      'iphon',
      'galaxy',
      'pixel',
      'android',
    ],
  },
  {
    slug: 'laptop',
    aliases: [
      'laptop',
      'notebook',
      'computer',
      'pc',
      'ultrabook',
      'macbook',
      'mac book',
      'thinkpad',
      'windows laptop',
    ],
  },
  {
    slug: 'waschmaschine',
    aliases: [
      'waschmaschine',
      'wasch maschine',
      'wascher',
      'waesche',
      'waesche waschen',
      'frontlader',
      'toplader',
      'waschautomat',
    ],
  },
] as const;

const QUERY_REWRITES = [
  { terms: ['iphone', 'iphon'], addTerms: ['apple', 'smartphone'], brand: 'apple', categorySlugs: ['smartphone'] },
  { terms: ['galaxy'], addTerms: ['samsung', 'smartphone'], brand: 'samsung', categorySlugs: ['smartphone'] },
  { terms: ['pixel'], addTerms: ['google', 'smartphone'], brand: 'google', categorySlugs: ['smartphone'] },
  { terms: ['macbook', 'mac book'], addTerms: ['apple', 'laptop'], brand: 'apple', categorySlugs: ['laptop'] },
  { terms: ['thinkpad'], addTerms: ['lenovo', 'laptop'], brand: 'lenovo', categorySlugs: ['laptop'] },
  { terms: ['delonghi', 'de longhi'], addTerms: ['delonghi', 'kaffeevollautomat'], brand: 'delonghi', categorySlugs: ['kaffeevollautomat'] },
  { terms: ['dyson'], addTerms: ['dyson', 'staubsauger'], brand: 'dyson', categorySlugs: ['akku-staubsauger'] },
] as const;

type PreparedSearch = {
  normalized: string;
  expanded: string;
  tokens: string[];
  categorySlugs: Set<string>;
  brandHints: Set<string>;
};

const CATEGORY_ALIAS_TEXT: ReadonlyMap<string, string> = new Map(
  CATEGORY_ALIASES.map((category) => [
    category.slug,
    normalizeProductName([category.slug.replace(/-/g, ' '), ...category.aliases].join(' ')),
  ]),
);

/**
 * Product matching / deduplication.
 *
 * Search is intentionally more forgiving than duplicate detection:
 * - search expands everyday terms ("Handy", "Kaffeemaschine", "Akkusauger")
 * - search tolerates small typos and compact model names ("roborok", "v 15")
 * - duplicate detection remains name-focused to avoid blocking valid new products
 */
@Injectable()
export class ProductMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Free-text search used by GET /products/search. */
  async search(query: string, take: number): Promise<MatchCandidate[]> {
    const prepared = prepareSearch(query);
    if (!prepared.normalized) return [];

    const prefiltered = await this.prefilter(
      prepared,
      Math.max(take * 12, 80),
      'search',
    );
    const candidates =
      prefiltered.length >= Math.max(take * 2, 20)
        ? prefiltered
        : await this.withBroadFallback(prefiltered);

    return rankSearchCandidates(candidates, prepared, take);
  }

  /**
   * Finds likely-duplicate products for a name the user is about to create.
   * Returns candidates at/above the "possible match" threshold, best first.
   */
  async findDuplicateCandidates(name: string, limit = 5): Promise<MatchCandidate[]> {
    const normalized = normalizeProductName(name);
    if (!normalized) return [];

    const prepared: PreparedSearch = {
      normalized,
      expanded: normalized,
      tokens: searchTokens(normalized),
      categorySlugs: new Set(),
      brandHints: new Set(),
    };

    const candidates = await this.prefilter(prepared, 30, 'duplicate');
    return rankDuplicateCandidates(
      candidates,
      normalized,
      limit,
      DEFAULT_SIMILARITY_THRESHOLDS.candidate,
    );
  }

  /** True when a near-identical product already exists (auto-block create). */
  async hasStrongDuplicate(name: string): Promise<MatchCandidate | null> {
    const candidates = await this.findDuplicateCandidates(name, 1);
    const top = candidates[0];
    if (top && top.similarity >= DEFAULT_SIMILARITY_THRESHOLDS.duplicate) {
      return top;
    }
    return null;
  }

  /**
   * DB-side prefilter. Search can use category aliases, duplicate checks only
   * use product names so generic inputs do not create false duplicate blocks.
   */
  private async prefilter(
    prepared: PreparedSearch,
    limit: number,
    mode: 'search' | 'duplicate',
  ): Promise<ProductWithRelations[]> {
    const normalized = mode === 'search' ? prepared.expanded : prepared.normalized;
    const loose = normalizeProductNameLoose(normalized);
    const tokens = distinctTokens(loose || normalized)
      .filter((token) => token.length >= 2)
      .sort((a, b) => b.length - a.length)
      .slice(0, MAX_PREFILTER_TOKENS);

    if (tokens.length === 0 && prepared.categorySlugs.size === 0) return [];

    const or: Prisma.ProductWhereInput[] = [
      { normalizedName: { contains: prepared.normalized } },
      ...tokens.map((token) => ({ normalizedName: { contains: token } })),
    ];

    if (mode === 'search' && prepared.categorySlugs.size > 0) {
      or.push({ category: { is: { slug: { in: [...prepared.categorySlugs] } } } });
    }

    return this.prisma.product.findMany({
      where: {
        status: { in: ['ACTIVE', 'PENDING_REVIEW'] },
        OR: or,
      },
      include: PRODUCT_INCLUDE,
      orderBy: [{ insightSnapshot: { experienceCount: 'desc' } }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  private async withBroadFallback(
    candidates: ProductWithRelations[],
  ): Promise<ProductWithRelations[]> {
    const seen = new Set(candidates.map((product) => product.id));
    const fallback = await this.prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING_REVIEW'] } },
      include: PRODUCT_INCLUDE,
      orderBy: [{ insightSnapshot: { experienceCount: 'desc' } }, { createdAt: 'desc' }],
      take: SEARCH_FALLBACK_LIMIT,
    });

    for (const product of fallback) {
      if (!seen.has(product.id)) {
        seen.add(product.id);
        candidates.push(product);
      }
    }

    return candidates;
  }
}

function prepareSearch(query: string): PreparedSearch {
  const normalized = normalizeProductName(query);
  const categorySlugs = detectCategorySlugs(normalized);
  const brandHints = new Set<string>();
  const extraTerms = new Set<string>();

  for (const slug of categorySlugs) {
    extraTerms.add(slug.replace(/-/g, ' '));
  }

  for (const rewrite of QUERY_REWRITES) {
    if (!rewrite.terms.some((term) => containsPhrase(normalized, normalizeProductName(term)))) {
      continue;
    }

    for (const term of rewrite.addTerms) extraTerms.add(term);
    if (rewrite.brand) brandHints.add(normalizeProductName(rewrite.brand));
    for (const slug of rewrite.categorySlugs ?? []) {
      categorySlugs.add(slug);
      extraTerms.add(slug.replace(/-/g, ' '));
    }
  }

  const expanded = normalizeProductName([normalized, ...extraTerms].join(' '));

  return {
    normalized,
    expanded,
    tokens: searchTokens(expanded || normalized),
    categorySlugs,
    brandHints,
  };
}

function detectCategorySlugs(normalizedQuery: string): Set<string> {
  const slugs = new Set<string>();
  if (!normalizedQuery) return slugs;

  for (const category of CATEGORY_ALIASES) {
    for (const alias of category.aliases) {
      const normalizedAlias = normalizeProductName(alias);
      if (
        containsPhrase(normalizedQuery, normalizedAlias) ||
        isCompactPhraseMatch(normalizedQuery, normalizedAlias) ||
        tokenSimilarity(normalizedQuery, normalizedAlias) >= 0.72
      ) {
        slugs.add(category.slug);
        break;
      }
    }
  }

  return slugs;
}

function rankSearchCandidates(
  candidates: ProductWithRelations[],
  prepared: PreparedSearch,
  take: number,
): MatchCandidate[] {
  return candidates
    .map((product) => ({
      product,
      similarity: scoreSearchProduct(product, prepared),
    }))
    .filter((candidate) => candidate.similarity >= SEARCH_MIN_SIMILARITY)
    .sort(compareCandidates)
    .slice(0, take);
}

function rankDuplicateCandidates(
  candidates: ProductWithRelations[],
  normalizedQuery: string,
  take: number,
  minSimilarity: number,
): MatchCandidate[] {
  return candidates
    .map((product) => ({
      product,
      similarity: scoreDuplicateProduct(product, normalizedQuery),
    }))
    .filter((candidate) => candidate.similarity >= minSimilarity)
    .sort(compareCandidates)
    .slice(0, take);
}

function scoreSearchProduct(product: ProductWithRelations, prepared: PreparedSearch): number {
  const name = product.normalizedName;
  const document = buildSearchDocument(product);
  const queryTokens = prepared.tokens;
  const nameTokens = distinctTokens(name);
  const documentTokens = distinctTokens(document);
  const categoryScore = product.category?.slug && prepared.categorySlugs.has(product.category.slug) ? 1 : 0;
  const brandScore = scoreBrand(product, prepared);
  const nameCoverage = tokenCoverage(queryTokens, nameTokens);
  const documentCoverage = tokenCoverage(queryTokens, documentTokens);
  const nameSimilarity = Math.max(
    tokenSimilarity(prepared.normalized, name),
    tokenSimilarity(prepared.expanded, name),
  );

  let score =
    nameCoverage * 0.4 +
    documentCoverage * 0.24 +
    nameSimilarity * 0.2 +
    categoryScore * 0.12 +
    brandScore * 0.12;

  if (name === prepared.normalized || compact(name) === compact(prepared.normalized)) {
    score = Math.max(score, 1);
  } else if (containsPhrase(name, prepared.normalized)) {
    score = Math.max(score, 0.94);
  } else if (isCompactPhraseMatch(name, prepared.normalized)) {
    score = Math.max(score, 0.9);
  } else if (prepared.normalized.includes(name) && name.length >= 8) {
    score = Math.max(score, 0.82);
  }

  if (categoryScore > 0 && brandScore > 0) {
    score += 0.08;
  }

  return clamp01(score);
}

function scoreDuplicateProduct(product: ProductWithRelations, normalizedQuery: string): number {
  const name = product.normalizedName;
  const nameSimilarity = tokenSimilarity(normalizedQuery, name);
  const compactQuery = compact(normalizedQuery);
  const compactName = compact(name);

  if (name === normalizedQuery || compactName === compactQuery) return 1;
  if (containsPhrase(name, normalizedQuery) || containsPhrase(normalizedQuery, name)) {
    return Math.max(nameSimilarity, 0.88);
  }
  if (
    compactQuery.length >= 6 &&
    (compactName.includes(compactQuery) || compactQuery.includes(compactName))
  ) {
    return Math.max(nameSimilarity, 0.82);
  }

  return nameSimilarity;
}

function buildSearchDocument(product: ProductWithRelations): string {
  const categorySlug = product.category?.slug ?? '';
  return normalizeProductName(
    [
      product.canonicalName,
      product.normalizedName,
      product.brand ?? '',
      product.category?.name ?? '',
      categorySlug.replace(/-/g, ' '),
      CATEGORY_ALIAS_TEXT.get(categorySlug) ?? '',
      product.description ?? '',
    ].join(' '),
  );
}

function scoreBrand(product: ProductWithRelations, prepared: PreparedSearch): number {
  const brand = normalizeProductName(product.brand ?? '');
  if (!brand) return 0;
  if (prepared.brandHints.has(brand)) return 1;
  if (containsPhrase(prepared.expanded, brand)) return 1;
  if (isCompactPhraseMatch(prepared.expanded, brand)) return 1;

  return tokenCoverage(distinctTokens(brand), prepared.tokens);
}

function searchTokens(input: string): string[] {
  return distinctTokens(input).slice(0, MAX_SCORE_TOKENS);
}

function distinctTokens(input: string): string[] {
  return [...tokenize(input)];
}

function tokenCoverage(queryTokens: string[], documentTokens: string[]): number {
  if (queryTokens.length === 0 || documentTokens.length === 0) return 0;

  let total = 0;
  for (const queryToken of queryTokens) {
    total += bestTokenMatch(queryToken, documentTokens);
  }

  return total / queryTokens.length;
}

function bestTokenMatch(queryToken: string, documentTokens: string[]): number {
  let best = 0;

  for (const documentToken of documentTokens) {
    if (queryToken === documentToken) return 1;

    if (isModelNumberMatch(queryToken, documentToken)) {
      best = Math.max(best, 0.9);
      continue;
    }

    if (queryToken.length >= 3 || documentToken.length >= 3) {
      if (documentToken.startsWith(queryToken) || queryToken.startsWith(documentToken)) {
        best = Math.max(best, 0.88);
      }
    }

    if (queryToken.length >= 4 && documentToken.includes(queryToken)) {
      best = Math.max(best, 0.78);
    }

    if (documentToken.length >= 4 && queryToken.includes(documentToken)) {
      best = Math.max(best, 0.76);
    }

    const typoScore = typoMatchScore(queryToken, documentToken);
    if (typoScore > best) best = typoScore;
  }

  return best;
}

function isModelNumberMatch(a: string, b: string): boolean {
  if (/^\d+$/.test(a) && b.endsWith(a)) return true;
  if (/^\d+$/.test(b) && a.endsWith(b)) return true;
  return false;
}

function typoMatchScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 4 || Math.abs(a.length - b.length) > 2) return 0;

  const distance = levenshtein(a, b);
  if (distance === 1) return 0.86;
  if (distance === 2 && maxLen >= 7) return 0.7;
  return 0;
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + substitutionCost,
      );
    }

    for (let j = 0; j < previous.length; j += 1) {
      previous[j] = current[j]!;
    }
  }

  return previous[b.length]!;
}

function containsPhrase(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  return (
    text === phrase ||
    text.startsWith(`${phrase} `) ||
    text.endsWith(` ${phrase}`) ||
    text.includes(` ${phrase} `)
  );
}

function isCompactPhraseMatch(text: string, phrase: string): boolean {
  const compactText = compact(text);
  const compactPhrase = compact(phrase);
  return (
    compactPhrase.length >= 4 &&
    (compactText === compactPhrase ||
      compactText.includes(compactPhrase) ||
      compactPhrase.includes(compactText))
  );
}

function compact(input: string): string {
  return input.replace(/\s+/g, '');
}

function compareCandidates(a: MatchCandidate, b: MatchCandidate): number {
  if (b.similarity !== a.similarity) return b.similarity - a.similarity;

  const popularityDelta = productPopularity(b.product) - productPopularity(a.product);
  if (popularityDelta !== 0) return popularityDelta;

  return a.product.canonicalName.localeCompare(b.product.canonicalName);
}

function productPopularity(product: ProductWithRelations): number {
  const snapshot = product.insightSnapshot;
  return (snapshot?.experienceCount ?? 0) * 2 + (snapshot?.ownerCount ?? 0);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
