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

type JsonLd = Record<string, unknown>;

/** Product structured data — eligible for rich results when there's real data. */
export function productJsonLd(product: ProductDetailDto): JsonLd {
  const ins = product.insights;
  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.canonicalName,
    url: absoluteUrl(`/products/${product.id}`),
    image: productThumbUrl(product),
  };
  if (product.description) data.description = product.description;
  if (product.brand) data.brand = { '@type': 'Brand', name: product.brand };
  if (product.category) data.category = product.category.name;

  // Only claim a rating when owners have actually weighed in — the score is the
  // share who would rebuy (0–100), expressed honestly as the rating value.
  if (ins.rebuyScore !== null && ins.experienceCount > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ins.rebuyScore,
      bestRating: 100,
      worstRating: 0,
      ratingCount: ins.experienceCount,
      reviewCount: ins.experienceCount,
    };
  }
  return data;
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
    name: 'Wudly',
    alternateName: 'Würdest du es wieder kaufen?',
    url: `${base}/`,
    inLanguage: 'de-DE',
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
    name: 'Wudly',
    url: `${base}/`,
    logo: `${base}/manifest-icon-512.png`,
    description: 'Echte Besitzer. Echte Nutzung. Bessere Käufe.',
  };
}
