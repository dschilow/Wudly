import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

/**
 * Dynamic robots.txt: index everything public, keep private/account and API
 * surfaces out of the index, and point crawlers at the dynamic sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/me', '/login', '/admin', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
