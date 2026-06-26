import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  ExternalRatingKind,
  guessBrand,
  normalizeProductName,
  type CreateCuratedProductInput,
  type CreateProductResultDto,
  type ExternalConsensusThemeDto,
  type ProductCurationDraftDto,
  type ProductCurationResearchDto,
  type ProductSpecDto,
  type ProductSummaryDto,
  type UpsertExternalRatingInput,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

const MAX_HTML_BYTES = 700 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface AgentProductSeed {
  query: string;
  brand?: string | null;
  categorySlug?: string | null;
  ean?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
}

export interface AgentProductCurationOptions {
  /** Product/rating pages fetched and parsed per product. */
  sourceLimit?: number;
  /** Minimum score that marks a draft as commit-ready. */
  minQualityScore?: number;
}

export interface AgentProductSourceEvidence {
  url: string;
  title: string | null;
  sourceKind: 'product' | 'rating' | 'manual';
  fetched: boolean;
  error: string | null;
  productName: string | null;
  brand: string | null;
  description: string | null;
  imageUrl: string | null;
  specs: ProductSpecDto[];
  ratings: UpsertExternalRatingInput[];
  positiveThemes: ExternalConsensusThemeDto[];
  negativeThemes: ExternalConsensusThemeDto[];
}

export interface AgentProductQualityReport {
  score: number;
  ready: boolean;
  missing: string[];
  notes: string[];
  sourceCount: number;
  fetchedSourceCount: number;
}

export interface AgentProductCurationDraft {
  seed: AgentProductSeed;
  payload: CreateCuratedProductInput;
  quality: AgentProductQualityReport;
  catalogMatches: ProductSummaryDto[];
  eanDraft: ProductCurationDraftDto | null;
  webResearch: ProductCurationResearchDto;
  sourceEvidence: AgentProductSourceEvidence[];
}

/**
 * Agent-facing product curation pipeline.
 *
 * This service intentionally avoids AI providers. It uses the same curated
 * create path as the admin workbench, but prepares the payload automatically
 * from EAN databases, Brave results and source-page structured data.
 */
@Injectable()
export class ProductAgentCurationService {
  private readonly logger = new Logger(ProductAgentCurationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}

  async research(
    seed: AgentProductSeed,
    options: AgentProductCurationOptions = {},
  ): Promise<AgentProductCurationDraft> {
    const normalizedSeed = normalizeSeed(seed);
    const sourceLimit = clampInt(options.sourceLimit ?? 10, 3, 20);
    const minQualityScore = clampInt(options.minQualityScore ?? 70, 1, 100);

    const webResearch = await this.products.curationResearch(normalizedSeed.query);
    const ean =
      normalizedSeed.ean ??
      webResearch.market.find((suggestion) => Boolean(suggestion.ean))?.ean ??
      null;
    const eanDraft = ean ? await this.products.curationDraftFromEan(ean) : null;

    const sourceTargets = this.sourceTargets(normalizedSeed, webResearch, sourceLimit);
    const sourceEvidence = await mapLimit(sourceTargets, 3, (target) =>
      this.fetchEvidence(target.url, target.kind),
    );

    const canonicalName = this.pickCanonicalName(normalizedSeed, eanDraft, sourceEvidence);
    const brand =
      normalizedSeed.brand ||
      eanDraft?.brand ||
      firstValue(sourceEvidence.map((page) => page.brand)) ||
      guessBrand(canonicalName) ||
      guessBrand(normalizedSeed.query) ||
      null;
    const categorySlug =
      normalizedSeed.categorySlug || (await this.guessCategorySlug(canonicalName, brand));
    const productUrl =
      normalizedSeed.productUrl ||
      bestProductUrl(sourceEvidence) ||
      webResearch.productSources[0]?.url ||
      undefined;
    const description =
      eanDraft?.description ||
      bestDescription(sourceEvidence, normalizedSeed.query) ||
      buildFallbackDescription(canonicalName, brand);
    const imageUrl =
      normalizedSeed.imageUrl ||
      eanDraft?.image ||
      firstValue(sourceEvidence.map((page) => page.imageUrl)) ||
      webResearch.imageUrl ||
      undefined;
    const specs = mergeSpecs([
      ...(eanDraft?.specs ?? []),
      ...sourceEvidence.flatMap((page) => page.specs),
    ]);
    const ratings = mergeRatings(sourceEvidence.flatMap((page) => page.ratings));
    const positiveThemes = mergeThemes(sourceEvidence.flatMap((page) => page.positiveThemes));
    const negativeThemes = mergeThemes(sourceEvidence.flatMap((page) => page.negativeThemes));
    const sourceUrls = mergeUrls([
      ...(productUrl ? [productUrl] : []),
      ...sourceEvidence.filter((page) => page.fetched).map((page) => page.url),
      ...ratings.map((rating) => rating.url),
      ...positiveThemes.flatMap((theme) => theme.sourceUrls),
      ...negativeThemes.flatMap((theme) => theme.sourceUrls),
    ]).slice(0, 20);

    const payload: CreateCuratedProductInput = {
      canonicalName,
      brand: brand ?? undefined,
      categorySlug: categorySlug ?? undefined,
      description,
      imageUrl,
      productUrl,
      ean: ean ?? undefined,
      specs,
      ratings,
      consensusSummary: buildConsensusSummary(
        sourceEvidence.filter((page) => page.fetched).length,
        ratings.length,
        positiveThemes,
        negativeThemes,
      ),
      positiveThemes,
      negativeThemes,
      sourceUrls,
      forceCreate: false,
    };

    return {
      seed: normalizedSeed,
      payload,
      quality: this.score(payload, sourceEvidence, webResearch.catalog, minQualityScore),
      catalogMatches: webResearch.catalog,
      eanDraft,
      webResearch,
      sourceEvidence,
    };
  }

  async commit(
    draft: AgentProductCurationDraft,
    options: { createdByUserId?: string | null; forceCreate?: boolean } = {},
  ): Promise<CreateProductResultDto> {
    return this.products.createCurated(
      {
        ...draft.payload,
        forceCreate: Boolean(options.forceCreate),
      },
      options.createdByUserId ?? null,
    );
  }

  private sourceTargets(
    seed: AgentProductSeed,
    research: ProductCurationResearchDto,
    limit: number,
  ): Array<{ url: string; kind: AgentProductSourceEvidence['sourceKind'] }> {
    const targets: Array<{ url: string; kind: AgentProductSourceEvidence['sourceKind'] }> = [];
    if (seed.productUrl) targets.push({ url: seed.productUrl, kind: 'manual' });
    for (const result of research.productSources) targets.push({ url: result.url, kind: 'product' });
    for (const result of research.ratingSources) targets.push({ url: result.url, kind: 'rating' });
    return dedupeByUrl(targets).slice(0, limit);
  }

  private async fetchEvidence(
    url: string,
    sourceKind: AgentProductSourceEvidence['sourceKind'],
  ): Promise<AgentProductSourceEvidence> {
    const empty = (error: string | null): AgentProductSourceEvidence => ({
      url,
      title: null,
      sourceKind,
      fetched: false,
      error,
      productName: null,
      brand: null,
      description: null,
      imageUrl: null,
      specs: [],
      ratings: [],
      positiveThemes: [],
      negativeThemes: [],
    });

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return empty(`http ${res.status}`);
      const contentType = res.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml|application\/json/i.test(contentType)) {
        return empty(`content-type ${contentType || 'unknown'}`);
      }

      const html = await readLimitedText(res, MAX_HTML_BYTES);
      const finalUrl = res.url || url;
      const meta = extractMeta(html, finalUrl);
      const products = extractJsonLdProducts(html);
      const productFacts = mergeProductFacts(products);
      const specs = mergeSpecs([
        ...productFacts.specs,
        ...extractSpecsFromHtml(html),
      ]);
      const ratings = mergeRatings([
        ...productFacts.ratings.map((rating) => withSource(rating, finalUrl)),
        ...extractRatingFromText(htmlToText(html), finalUrl),
      ]);
      const themes = extractThemesFromHtml(html, finalUrl);

      return {
        url: finalUrl,
        title: meta.title,
        sourceKind,
        fetched: true,
        error: null,
        productName: productFacts.name || cleanTitle(meta.title),
        brand: productFacts.brand,
        description: productFacts.description || meta.description,
        imageUrl: productFacts.imageUrl || meta.imageUrl,
        specs,
        ratings,
        positiveThemes: themes.positive,
        negativeThemes: themes.negative,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Agent product evidence fetch failed for ${url}: ${message}`);
      return empty(message);
    }
  }

  private pickCanonicalName(
    seed: AgentProductSeed,
    eanDraft: ProductCurationDraftDto | null,
    pages: AgentProductSourceEvidence[],
  ): string {
    const pageName = pages
      .filter((page) => page.fetched)
      .map((page) => page.productName)
      .find((name) => looksLikeProductName(name, seed.query));
    return cleanProductName(eanDraft?.title || pageName || seed.query);
  }

  private async guessCategorySlug(name: string, brand: string | null): Promise<string | null> {
    const categories = await this.prisma.category.findMany({ select: { slug: true, name: true } });
    if (categories.length === 0) return null;
    const valid = new Set(categories.map((category) => category.slug));
    const text = normalizeProductName([brand, name].filter(Boolean).join(' '));
    const guess = guessCategoryByText(text);
    if (guess && valid.has(guess)) return guess;
    const category = categories.find((row) =>
      normalizeProductName(row.name)
        .split(' ')
        .some((token) => token.length > 2 && text.includes(token)),
    );
    return category?.slug ?? null;
  }

  private score(
    payload: CreateCuratedProductInput,
    pages: AgentProductSourceEvidence[],
    catalogMatches: ProductSummaryDto[],
    minQualityScore: number,
  ): AgentProductQualityReport {
    const missing: string[] = [];
    const notes: string[] = [];
    let score = 0;

    if (payload.canonicalName.length >= 3) score += 10;
    else missing.push('canonicalName');
    if (payload.brand) score += 8;
    else missing.push('brand');
    if (payload.productUrl || payload.sourceUrls.length > 0) score += 12;
    else missing.push('sourceUrl');
    if (payload.description && payload.description.length >= 30) score += 10;
    else missing.push('description');
    if (payload.specs.length >= 4) score += 20;
    else if (payload.specs.length > 0) score += 8;
    else missing.push('specs');
    if (payload.imageUrl) score += 10;
    else missing.push('imageUrl');
    if (payload.ratings.length > 0) score += 15;
    else missing.push('externalRatings');
    if (payload.positiveThemes.length + payload.negativeThemes.length > 0) score += 10;
    else missing.push('proContraThemes');
    if (payload.sourceUrls.length >= 3) score += 5;
    else if (payload.sourceUrls.length === 0) missing.push('sourceUrls');

    if (catalogMatches.length > 0) {
      notes.push(`catalog-matches:${catalogMatches.length}`);
    }
    const fetchedSourceCount = pages.filter((page) => page.fetched).length;
    if (fetchedSourceCount === 0) notes.push('no-source-pages-fetched');

    return {
      score: Math.min(score, 100),
      ready: score >= minQualityScore && payload.sourceUrls.length > 0,
      missing,
      notes,
      sourceCount: pages.length,
      fetchedSourceCount,
    };
  }
}

interface MetaFacts {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

interface ProductFacts {
  name: string | null;
  brand: string | null;
  description: string | null;
  imageUrl: string | null;
  specs: ProductSpecDto[];
  ratings: Array<Omit<UpsertExternalRatingInput, 'source' | 'sourceLabel' | 'url'>>;
}

function normalizeSeed(seed: AgentProductSeed): AgentProductSeed {
  return {
    query: seed.query.trim(),
    brand: trimOrNull(seed.brand),
    categorySlug: trimOrNull(seed.categorySlug),
    ean: trimOrNull(seed.ean),
    productUrl: trimOrNull(seed.productUrl),
    imageUrl: trimOrNull(seed.imageUrl),
  };
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanProductName(value: string): string {
  return value
    .replace(/\s+[|–-]\s+(Amazon|MediaMarkt|Saturn|idealo|Test|Review|Bewertung).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function cleanTitle(value: string | null): string | null {
  if (!value) return null;
  const cleaned = cleanProductName(value);
  return cleaned.length >= 3 ? cleaned : null;
}

function looksLikeProductName(name: string | null, query: string): boolean {
  if (!name) return false;
  const nameNorm = normalizeProductName(name);
  const queryTokens = normalizeProductName(query)
    .split(' ')
    .filter((token) => token.length > 2);
  if (queryTokens.length === 0) return false;
  const hits = queryTokens.filter((token) => nameNorm.includes(token)).length;
  return hits >= Math.min(2, queryTokens.length);
}

function firstValue(values: Array<string | null | undefined>): string | null {
  return values.find((value): value is string => Boolean(value && value.trim())) ?? null;
}

function bestProductUrl(pages: AgentProductSourceEvidence[]): string | null {
  return (
    pages.find((page) => page.fetched && page.sourceKind !== 'rating' && page.productName)?.url ??
    pages.find((page) => page.fetched && page.sourceKind !== 'rating')?.url ??
    null
  );
}

function bestDescription(pages: AgentProductSourceEvidence[], query: string): string | null {
  const queryTokens = normalizeProductName(query)
    .split(' ')
    .filter((token) => token.length > 2);
  const candidates = pages
    .map((page) => page.description?.replace(/\s+/g, ' ').trim())
    .filter((value): value is string => Boolean(value && value.length >= 30 && value.length <= 800));
  return (
    candidates.find((value) => {
      const normalized = normalizeProductName(value);
      return queryTokens.some((token) => normalized.includes(token));
    }) ??
    candidates[0] ??
    null
  );
}

function buildFallbackDescription(name: string, brand: string | null): string {
  return [brand, name].filter(Boolean).join(' ').slice(0, 500);
}

function buildConsensusSummary(
  fetchedSources: number,
  ratingCount: number,
  positiveThemes: ExternalConsensusThemeDto[],
  negativeThemes: ExternalConsensusThemeDto[],
): string | undefined {
  if (fetchedSources === 0 && ratingCount === 0 && positiveThemes.length + negativeThemes.length === 0) {
    return undefined;
  }
  const positives = positiveThemes.slice(0, 3).map((theme) => theme.label).join(', ');
  const negatives = negativeThemes.slice(0, 3).map((theme) => theme.label).join(', ');
  const parts = [`Quellenbasierter Netz-Konsens aus ${fetchedSources} geprueften Seiten`];
  if (ratingCount > 0) parts.push(`${ratingCount} externe Bewertungsfakten`);
  if (positives) parts.push(`haeufig positiv: ${positives}`);
  if (negatives) parts.push(`haeufig kritisch: ${negatives}`);
  return `${parts.join('; ')}.`;
}

function extractMeta(html: string, baseUrl: string): MetaFacts {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = cleanText(titleMatch?.[1] ?? '') || metaContent(html, ['og:title', 'twitter:title']);
  const description = metaContent(html, ['description', 'og:description', 'twitter:description']);
  const rawImage = metaContent(html, ['og:image', 'og:image:url', 'twitter:image']);
  return {
    title,
    description,
    imageUrl: absolutizeUrl(rawImage, baseUrl),
  };
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = escapeRegex(key);
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        'i',
      ),
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(html);
      const value = cleanText(match?.[1] ?? '');
      if (value) return value;
    }
  }
  return null;
}

function extractJsonLdProducts(html: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = [];
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    const raw = decodeHtmlEntities(script[1] ?? '')
      .replace(/^\s*<!--/, '')
      .replace(/-->\s*$/, '')
      .trim();
    if (!raw) continue;
    const parsed = safeJsonParse(raw);
    if (parsed === null) continue;
    for (const node of flattenJsonLd(parsed)) {
      if (isJsonLdType(node, 'Product')) products.push(node);
    }
  }
  return products;
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

function mergeProductFacts(products: Record<string, unknown>[]): ProductFacts {
  const facts: ProductFacts = {
    name: null,
    brand: null,
    description: null,
    imageUrl: null,
    specs: [],
    ratings: [],
  };
  for (const product of products) {
    facts.name ||= stringValue(product.name);
    facts.brand ||= brandValue(product.brand);
    facts.description ||= stringValue(product.description);
    facts.imageUrl ||= imageValue(product.image);
    facts.specs.push(...propertyValueSpecs(product.additionalProperty));
    const rating = aggregateRating(product.aggregateRating);
    if (rating) facts.ratings.push(rating);
  }
  facts.specs = mergeSpecs(facts.specs);
  return facts;
}

function propertyValueSpecs(value: unknown): ProductSpecDto[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter(isRecord)
    .map((row) => ({
      label: cleanText(stringValue(row.name) || stringValue(row.propertyID) || ''),
      value: cleanText(stringValue(row.value) || ''),
    }))
    .filter((row) => validSpec(row.label, row.value));
}

function aggregateRating(
  value: unknown,
): Omit<UpsertExternalRatingInput, 'source' | 'sourceLabel' | 'url'> | null {
  if (!isRecord(value)) return null;
  const ratingValue = numberValue(value.ratingValue);
  if (ratingValue === null) return null;
  const maxValue = numberValue(value.bestRating) ?? (ratingValue > 5 ? 100 : 5);
  const count = numberValue(value.ratingCount) ?? numberValue(value.reviewCount);
  if (maxValue <= 0 || ratingValue < 0 || ratingValue > maxValue) return null;
  return {
    kind: maxValue === 100 ? ExternalRatingKind.PERCENT : ExternalRatingKind.STARS,
    value: ratingValue,
    maxValue,
    count: count === null ? null : Math.round(count),
    note: null,
  };
}

function withSource(
  rating: Omit<UpsertExternalRatingInput, 'source' | 'sourceLabel' | 'url'>,
  url: string,
): UpsertExternalRatingInput {
  const source = sourceKey(url);
  return {
    ...rating,
    source,
    sourceLabel: sourceLabel(url),
    url,
  };
}

function extractRatingFromText(text: string, url: string): UpsertExternalRatingInput[] {
  if (!isLikelyRatingSource(url)) return [];
  const match = /\b([0-5](?:[.,]\d)?)\s*(?:\/|von)\s*5\b/i.exec(text);
  if (!match?.[1]) return [];
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > 5) return [];
  return [
    {
      source: sourceKey(url),
      sourceLabel: sourceLabel(url),
      url,
      kind: ExternalRatingKind.STARS,
      value,
      maxValue: 5,
      count: null,
      note: 'Aus Seitentext extrahiert',
    },
  ];
}

function extractSpecsFromHtml(html: string): ProductSpecDto[] {
  const specs: ProductSpecDto[] = [];
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const row of rowMatches) {
    const cells = [...(row[1] ?? '').matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
      cleanText(cell[1] ?? ''),
    );
    if (cells.length >= 2 && validSpec(cells[0]!, cells[1]!)) {
      specs.push({ label: cells[0]!, value: cells[1]! });
    }
  }
  const dlMatches = html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi);
  for (const row of dlMatches) {
    const label = cleanText(row[1] ?? '');
    const value = cleanText(row[2] ?? '');
    if (validSpec(label, value)) specs.push({ label, value });
  }
  return mergeSpecs(specs);
}

function extractThemesFromHtml(
  html: string,
  url: string,
): { positive: ExternalConsensusThemeDto[]; negative: ExternalConsensusThemeDto[] } {
  const positive: ExternalConsensusThemeDto[] = [];
  const negative: ExternalConsensusThemeDto[] = [];
  const headings = html.matchAll(/<(h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const heading of headings) {
    const headingText = normalizeProductName(cleanText(heading[2] ?? ''));
    const isPositive = /\b(vorteile|pros|pro|staerken|pluspunkte|positiv)\b/.test(headingText);
    const isNegative = /\b(nachteile|cons|contra|schwaechen|minuspunkte|kritik|negativ)\b/.test(
      headingText,
    );
    if (!isPositive && !isNegative) continue;
    const tail = html.slice((heading.index ?? 0) + heading[0].length, (heading.index ?? 0) + 4500);
    const labels = [...tail.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match) => cleanThemeLabel(match[1] ?? ''))
      .filter((label): label is string => Boolean(label))
      .slice(0, 6);
    const target = isPositive ? positive : negative;
    for (const label of labels) target.push({ label, sourceUrls: [url] });
  }
  return { positive: mergeThemes(positive), negative: mergeThemes(negative) };
}

function cleanThemeLabel(value: string): string | null {
  const label = cleanText(value)
    .replace(/^[-+•*\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (label.length < 3 || label.length > 140) return null;
  if (/cookie|newsletter|datenschutz|affiliate|anzeige/i.test(label)) return null;
  return label;
}

function mergeSpecs(specs: ProductSpecDto[]): ProductSpecDto[] {
  const seen = new Set<string>();
  const out: ProductSpecDto[] = [];
  for (const spec of specs) {
    const label = cleanText(spec.label);
    const value = cleanText(spec.value);
    if (!validSpec(label, value)) continue;
    const key = normalizeProductName(label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: label.slice(0, 80), value: value.slice(0, 160) });
    if (out.length >= 30) break;
  }
  return out;
}

function validSpec(label: string, value: string): boolean {
  if (label.length < 2 || label.length > 80) return false;
  if (value.length < 1 || value.length > 180) return false;
  if (/cookie|newsletter|warenkorb|zahlung|versand|kunden/i.test(label)) return false;
  if (/^(ja|nein|yes|no|true|false)$/i.test(value)) return false;
  return true;
}

function mergeRatings(ratings: UpsertExternalRatingInput[]): UpsertExternalRatingInput[] {
  const bySource = new Map<string, UpsertExternalRatingInput>();
  for (const rating of ratings) {
    if (!rating.url || !rating.source) continue;
    const existing = bySource.get(rating.source);
    if (!existing || (rating.count ?? 0) > (existing.count ?? 0)) {
      bySource.set(rating.source, {
        ...rating,
        source: rating.source.slice(0, 40),
        sourceLabel: rating.sourceLabel.slice(0, 60),
        note: rating.note?.slice(0, 200) ?? null,
      });
    }
  }
  return [...bySource.values()].slice(0, 12);
}

function mergeThemes(themes: ExternalConsensusThemeDto[]): ExternalConsensusThemeDto[] {
  const byLabel = new Map<string, ExternalConsensusThemeDto>();
  for (const theme of themes) {
    const label = cleanThemeLabel(theme.label);
    if (!label) continue;
    const key = normalizeProductName(label);
    const existing = byLabel.get(key);
    byLabel.set(key, {
      label,
      sourceUrls: mergeUrls([...(existing?.sourceUrls ?? []), ...theme.sourceUrls]).slice(0, 8),
    });
  }
  return [...byLabel.values()].slice(0, 12);
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

function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!/^https?:\/\//i.test(item.url)) continue;
    const normalized = normalizeUrl(item.url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(item);
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

function absolutizeUrl(url: string | null, baseUrl: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function sourceKey(url: string): string {
  try {
    const host = new URL(url).hostname
      .replace(/^www\./, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return host.slice(0, 40) || 'web';
  } catch {
    return 'web';
  }
}

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').slice(0, 60);
  } catch {
    return 'Web';
  }
}

function isLikelyRatingSource(url: string): boolean {
  const host = sourceKey(url);
  return /amazon|idealo|test|trusted|notebookcheck|stiftung|chip|connect|dxomark|review|bewertungen/.test(
    host,
  );
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

function imageValue(value: unknown): string | null {
  if (typeof value === 'string') return value.startsWith('http') ? value : null;
  if (Array.isArray(value)) return imageValue(value[0]);
  if (isRecord(value)) return stringValue(value.url) || stringValue(value.contentUrl);
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').replace(/[^\d.]+/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function htmlToText(html: string): string {
  return cleanText(html).slice(0, 30_000);
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function guessCategoryByText(text: string): string | null {
  const rules: Array<{ slug: string; terms: string[] }> = [
    { slug: 'smartphone', terms: ['smartphone', 'iphone', 'galaxy', 'pixel', 'phone'] },
    { slug: 'laptop', terms: ['laptop', 'notebook', 'macbook', 'thinkpad', 'xps'] },
    { slug: 'waschmaschine', terms: ['waschmaschine', 'washer', 'wgg', 'iq700'] },
    { slug: 'saugroboter', terms: ['saugroboter', 'roborock', 'roomba', 'dreame'] },
    { slug: 'akku-staubsauger', terms: ['akkustaubsauger', 'staubsauger', 'dyson v', 'unlimited'] },
    { slug: 'kaffeevollautomat', terms: ['kaffeevollautomat', 'magnifica', 'lattego', 'jura', 'eq 6'] },
    { slug: 'kindersitz', terms: ['kindersitz', 'sirona', 'cybex'] },
    { slug: 'e-bike', terms: ['e bike', 'ebike', 'pedelec'] },
    { slug: 'matratze', terms: ['matratze', 'mattress'] },
    { slug: 'pv-speicher', terms: ['pv speicher', 'powerstation', 'solix', 'delta 2', 'jackery'] },
    { slug: 'waermepumpe', terms: ['waermepumpe', 'heat pump'] },
  ];
  return rules.find((rule) => rule.terms.some((term) => text.includes(term)))?.slug ?? null;
}
