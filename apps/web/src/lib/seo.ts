/**
 * Canonical site URL + Schema.org JSON-LD builders.
 *
 * Organic search is Wudly's primary growth channel, so every public page ships a
 * canonical URL and structured data: `Product` + `AggregateRating` on product
 * pages, `WebSite` + `SearchAction` + `Organization` on the home page. The data
 * stays honest — an aggregateRating is only emitted when real owner experiences
 * back the score, never for empty products.
 */
import type { ProductDetailDto } from '@wudly/shared';
import { productThumbUrl } from './product-media';

const FALLBACK_SITE_URL = 'https://wudly-web-production.up.railway.app';

/** Absolute, trailing-slash-free public origin of the web app. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL;
  return raw.replace(/\/+$/, '');
}

/** Build an absolute URL on the site origin for a given path. */
export function absoluteUrl(path = '/'): string {
  const base = siteUrl();
  if (!path || path === '/') return `${base}/`;
  return base + (path.startsWith('/') ? path : `/${path}`);
}

/** URL-safe product slug: readable for search results, stable because the id stays last. */
export function productSlug(product: { id: string; canonicalName: string }): string {
  return `${slugify(product.canonicalName)}-${product.id}`;
}

/** Public, canonical product overview path used by sitemap, metadata and links. */
export function productPath(product: { id: string; canonicalName: string }): string {
  return `/produkte/${productSlug(product)}`;
}

/** Extract the stable product id from `/produkte/<name>-<id>`. IDs may be
 *  cuids (alphanumeric) or seed/import ids (`seed_product_1`, `runtime_seed_*`)
 *  which contain underscores — the character class must allow both. */
export function productIdFromSlug(slug: string): string | null {
  const match = slug.match(/-([a-z0-9_]{6,})$/i);
  return match?.[1] ?? null;
}

function slugify(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/đ/g, 'd');
  return (
    ascii
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'produkt'
  );
}
type JsonLd = Record<string, unknown>;

/**
 * The minimum owner experiences before we let a product claim an aggregateRating
 * in structured data. Below this the sample is too thin to present as a rating —
 * kept in sync with the app's own "early signal" gate so the rich result and the
 * on-page verdict never disagree.
 */
export const MIN_EXPERIENCES_FOR_RATING = 20;

/** Product structured data — eligible for rich results when there's real data. */
export function productJsonLd(product: ProductDetailDto): JsonLd {
  const ins = product.insights;
  const url = absoluteUrl(productPath(product));
  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.canonicalName,
    url,
    mainEntityOfPage: url,
    image: productThumbUrl(product),
    inLanguage: 'de-DE',
  };
  if (product.description) data.description = product.description;
  if (product.brand) data.brand = { '@type': 'Brand', name: product.brand };
  if (product.category) data.category = product.category.name;
  if (product.specs.length > 0) {
    data.additionalProperty = product.specs.slice(0, 12).map((spec) => ({
      '@type': 'PropertyValue',
      name: spec.label,
      value: spec.value,
    }));
  }

  // Only claim a rating when owners have actually weighed in. Google's rich
  // results expect a conventional star scale, so the rebuy share (0–100) is
  // expressed on a 5-point scale — honest, and eligible for the rating snippet.
  if (ins.rebuyScore !== null && ins.experienceCount >= MIN_EXPERIENCES_FOR_RATING) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.round((ins.rebuyScore / 20) * 10) / 10,
      bestRating: 5,
      worstRating: 0,
      ratingCount: ins.experienceCount,
      reviewCount: ins.experienceCount,
    };
  }
  return data;
}

/**
 * Q&A structured data (`QAPage`) for a product's owner questions. Emitted only
 * for questions that have at least one real answer — an unanswered question is
 * not eligible and Google would flag it. Each answer maps to `suggestedAnswer`
 * (or `acceptedAnswer` for the most helpful one), with its own upvote count.
 */
export function productQaPageJsonLd(
  product: { id: string; canonicalName: string },
  questions: Array<{
    questionText: string;
    createdAt: string;
    answers: Array<{ answerText: string; helpfulCount: number; createdAt: string; authorName: string | null }>;
  }>,
): JsonLd | null {
  const answered = questions
    .map((q) => ({ ...q, answers: q.answers.filter((a) => a.answerText.trim().length > 1) }))
    .filter((q) => q.answers.length > 0)
    .slice(0, 10);
  if (answered.length === 0) return null;

  const pageUrl = absoluteUrl(productPath(product));
  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    inLanguage: 'de-DE',
    mainEntity: answered.map((q) => {
      const sorted = [...q.answers].sort((a, b) => b.helpfulCount - a.helpfulCount);
      const [best, ...rest] = sorted;
      const toAnswer = (a: (typeof sorted)[number]) => ({
        '@type': 'Answer',
        text: a.answerText,
        url: pageUrl,
        dateCreated: a.createdAt,
        upvoteCount: Math.max(0, a.helpfulCount),
        ...(a.authorName ? { author: { '@type': 'Person', name: a.authorName } } : {}),
      });
      return {
        '@type': 'Question',
        name: q.questionText,
        text: q.questionText,
        answerCount: q.answers.length,
        dateCreated: q.createdAt,
        ...(best ? { acceptedAnswer: toAnswer(best) } : {}),
        ...(rest.length > 0 ? { suggestedAnswer: rest.map(toAnswer) } : {}),
      };
    }),
  };
}

/** Ordered list of products for a category page (helps rich results / discovery). */
export function itemListJsonLd(
  name: string,
  products: Array<{ id: string; canonicalName: string }>,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.canonicalName,
      url: absoluteUrl(productPath(p)),
    })),
  };
}

/**
 * A category landing page as a `CollectionPage` that wraps the product ItemList —
 * the schema Google prefers for "best [category]"-style listing pages, tying the
 * page's name/description/URL to the ordered products it presents.
 */
export function collectionPageJsonLd(params: {
  name: string;
  description: string;
  path: string;
  products: Array<{ id: string; canonicalName: string }>;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: params.name,
    description: params.description,
    url: absoluteUrl(params.path),
    inLanguage: 'de-DE',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: params.products.length,
      itemListElement: params.products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.canonicalName,
        url: absoluteUrl(productPath(p)),
      })),
    },
  };
}

/**
 * FAQ structured data — eligible for the FAQ rich result. Only real
 * question/answer pairs; skip anything with an empty answer.
 */
export function faqPageJsonLd(items: Array<{ question: string; answer: string }>): JsonLd | null {
  const valid = items.filter((i) => i.question.trim() && i.answer.trim());
  if (valid.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'de-DE',
    mainEntity: valid.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

/** Breadcrumb trail for a product (Start → Charts → Produkt). */
export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Site-level entity + a sitelinks search box pointing at Wudly's search. */
export function websiteJsonLd(): JsonLd {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name: 'Wudly',
    alternateName: 'Würdest du es wieder kaufen?',
    url: `${base}/`,
    inLanguage: 'de-DE',
    publisher: { '@id': `${base}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/check?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Brand/organization entity for knowledge-graph eligibility. */
export function organizationJsonLd(): JsonLd {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: 'Wudly',
    url: `${base}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${base}/manifest-icon-512.png`,
      width: 512,
      height: 512,
    },
    description:
      'Wudly bündelt echte Besitzer-Erfahrungen nach echter Nutzung zu einem Wiederkauf-Urteil — keine Sterne-Show, keine Werbung im Score.',
    slogan: 'Echte Besitzer. Echte Nutzung. Bessere Käufe.',
  };
}
