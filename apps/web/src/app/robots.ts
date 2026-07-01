import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

/**
 * Dynamic robots.txt: index everything public, keep private/account and API
 * surfaces out of the index, and point crawlers at the dynamic sitemap.
 *
 * `/products/` (the internal id route) is disallowed because `/produkte/<slug>`
 * is the single canonical product URL — this prevents Google from discovering
 * and having to de-dupe two paths to the same page. `/e/` invite pages, the
 * search-results and register/ki-test screens carry no standalone SEO value.
 * Major AI answer engines are explicitly welcomed — increasingly a real
 * discovery channel for "würde man X wieder kaufen"-style questions.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const disallow = [
    '/me',
    '/login',
    '/register',
    '/admin',
    '/api/',
    '/products/', // internal id route — /produkte/<slug> is canonical
    '/e/', // one-off rating invites
    '/ki-test',
    '/check?', // search-result permutations, not the clean /check landing
  ];
  const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      ...aiCrawlers.map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
