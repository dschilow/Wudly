import { beforeEach, describe, expect, it } from 'vitest';
import { detectFromJsonLd, strictGtinForPage } from './jsonld';
import { detectFromMediaSaturn } from './media-saturn';
import { asinFromUrl, detectFromAmazon } from './amazon';
import { detectProduct } from './index';

/**
 * The shop page is the one input this extension does not control, and every
 * production incident so far came from a page state nobody expected: stale
 * JSON-LD after SPA navigation, a ProductGroup instead of a Product node, a
 * URL that changed before the DOM did. Each of those is one fixture here.
 */

function render(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

function ldScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

const MM_URL =
  'https://www.mediamarkt.de/de/product/_philips-65oled810-12-oled-ambilight-tv-2982243.html?foo=bar';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('detectFromJsonLd', () => {
  it('reads the product facts and strips tracking params from the URL', () => {
    const doc = render(
      `<h1>Sony WH-1000XM5 Kopfhörer</h1>` +
        ldScript({
          '@type': 'Product',
          name: 'Sony WH-1000XM5 Kopfhörer',
          gtin13: '4548736141549',
          brand: { name: 'Sony' },
          image: ['https://cdn.otto.de/sony.jpg'],
          aggregateRating: { ratingValue: '4,6', bestRating: 5, reviewCount: '1.204' },
        }),
    );
    const detected = detectFromJsonLd(doc, 'https://www.otto.de/p/sony-xm5-123?sid=track#tab');
    expect(detected).toMatchObject({
      identifierType: 'GTIN',
      identifierValue: '4548736141549',
      title: 'Sony WH-1000XM5 Kopfhörer',
      brand: 'Sony',
      imageUrl: 'https://cdn.otto.de/sony.jpg',
      productUrl: 'https://www.otto.de/p/sony-xm5-123',
      domain: 'www.otto.de',
    });
    // German decimal comma and thousands dot.
    expect(detected?.rating).toEqual({ value: 4.6, maxValue: 5, count: 1204 });
  });

  it('ignores structured data left behind by the previous SPA page', () => {
    const doc = render(
      `<h1>TCL 75C7K QLED Fernseher</h1>` +
        ldScript({
          '@type': 'Product',
          name: 'PHILIPS 65OLED810/12 OLED Ambilight TV',
          gtin13: '8718863038000',
        }),
    );
    expect(detectFromJsonLd(doc, MM_URL)).toBeNull();
  });

  it('finds the page product inside a BuyAction wrapper and never a variant', () => {
    const doc = render(
      `<h1>TCL 75C7K QLED Fernseher</h1>` +
        ldScript({
          '@type': 'BuyAction',
          object: {
            '@type': 'ProductGroup',
            name: 'TCL 75C7K QLED Fernseher',
            gtin13: '5901292525729',
            // The 98" sibling — must never be picked up as this page's product.
            hasVariant: [{ '@type': 'Product', name: 'TCL 98C7K', gtin13: '5901292599999' }],
          },
        }),
    );
    expect(detectFromJsonLd(doc, MM_URL)?.identifierValue).toBe('5901292525729');
  });

  it('survives broken JSON-LD instead of dying on it', () => {
    const doc = render(
      `<h1>Sony WH-1000XM5</h1><script type="application/ld+json">{ nope </script>` +
        ldScript({ '@type': 'Product', name: 'Sony WH-1000XM5', gtin13: '4548736141549' }),
    );
    expect(detectFromJsonLd(doc, 'https://www.otto.de/p/sony-123')?.identifierValue).toBe(
      '4548736141549',
    );
  });
});

describe('strictGtinForPage', () => {
  it('accepts a GTIN whose node names this exact page', () => {
    const doc = render(
      ldScript({
        '@type': 'Product',
        name: 'PHILIPS 65OLED810/12',
        url: '/de/product/_philips-65oled810-12-oled-ambilight-tv-2982243.html',
        gtin13: '8718863038000',
      }),
    );
    expect(strictGtinForPage(doc, MM_URL)).toBe('8718863038000');
  });

  it('accepts a GTIN whose node carries this page’s article number', () => {
    const doc = render(
      ldScript({ '@type': 'ProductGroup', name: 'Philips', sku: '2982243', gtin13: '8718863038000' }),
    );
    expect(strictGtinForPage(doc, MM_URL, '2982243')).toBe('8718863038000');
  });

  /**
   * The expensive failure: a GTIN is a worldwide identity, so adopting a stale
   * one binds this shop page to a different catalog product permanently. A
   * shared brand word in the heading is NOT proof and must not be enough.
   */
  it('refuses a GTIN that cannot prove it belongs to this page', () => {
    const doc = render(
      `<h1>PHILIPS 65OLED810/12 OLED Ambilight TV</h1>` +
        ldScript({
          '@type': 'Product',
          name: 'PHILIPS 55OLED759/12 OLED TV',
          url: '/de/product/_philips-55oled759-12-oled-tv-1234567.html',
          gtin13: '8718863099999',
        }),
    );
    expect(strictGtinForPage(doc, MM_URL, '2982243')).toBeUndefined();
  });

  it('ignores implausible GTIN lengths', () => {
    const doc = render(
      ldScript({ '@type': 'Product', sku: '2982243', gtin13: '123' }),
    );
    expect(strictGtinForPage(doc, MM_URL, '2982243')).toBeUndefined();
  });
});

describe('detectFromMediaSaturn', () => {
  const heading = 'PHILIPS 65OLED810/12 OLED Ambilight TV (Flat, 65 Zoll / 164 cm, UHD 4K)';

  it('stays silent while the visible article number disagrees with the URL', () => {
    // SPA race: URL is already the new product, the DOM still shows the old one.
    const doc = render(`<h1>TCL 75C7K QLED Fernseher</h1><span>Art.-Nr.: 1234567</span>`);
    expect(detectFromMediaSaturn(doc, MM_URL)).toBeNull();
  });

  it('reports the shop article number once URL and page agree', () => {
    const doc = render(`<h1>${heading}</h1><span>Art.-Nr. 2982243</span><p>4,6 ★ (207 Bewertungen)</p>`);
    const detected = detectFromMediaSaturn(doc, MM_URL);
    expect(detected).toMatchObject({
      identifierType: 'SKU',
      identifierValue: '2982243',
      brand: 'PHILIPS',
      domain: 'www.mediamarkt.de',
    });
    expect(detected?.title).toBe(heading);
    expect(detected?.rating).toEqual({ value: 4.6, maxValue: 5, count: 207 });
    // Tracking params never leave the browser.
    expect(detected?.productUrl).not.toContain('?');
  });

  it('prefers a proven GTIN over the shop article number', () => {
    // A GTIN dedupes worldwide and rides the FREE catalog path; a shop article
    // number does neither. So when the page proves one, it wins.
    const doc = render(
      `<h1>${heading}</h1><span>Art.-Nr. 2982243</span>` +
        ldScript({ '@type': 'ProductGroup', name: heading, sku: '2982243', gtin13: '8718863038000' }),
    );
    expect(detectFromMediaSaturn(doc, MM_URL)).toMatchObject({
      identifierType: 'GTIN',
      identifierValue: '8718863038000',
    });
  });

  it('keeps out of non-product pages', () => {
    const doc = render(`<h1>Fernseher &amp; Beamer</h1>`);
    expect(detectFromMediaSaturn(doc, 'https://www.mediamarkt.de/de/category/tv-123.html')).toBeNull();
  });
});

describe('detectFromAmazon', () => {
  it('reads ASIN, title, brand and rating', () => {
    const doc = render(
      `<span id="productTitle"> Sony WH-1000XM5 Kopfhörer </span>` +
        `<a id="bylineInfo">Besuche den Sony-Store</a>` +
        `<span id="acrPopover" title="4,4 von 5 Sternen"></span>` +
        `<span id="acrCustomerReviewText">1.234 Sternebewertungen</span>`,
    );
    expect(detectFromAmazon(doc, 'https://www.amazon.de/Sony-Kopfhoerer/dp/b09xs7jwhh/ref=sr_1_1')).toMatchObject({
      identifierType: 'ASIN',
      identifierValue: 'B09XS7JWHH',
      title: 'Sony WH-1000XM5 Kopfhörer',
      brand: 'Sony',
      // Canonical /dp/<ASIN>, never the slug + tracking path.
      productUrl: 'https://www.amazon.de/dp/B09XS7JWHH',
      rating: { value: 4.4, maxValue: 5, count: 1234 },
    });
  });

  it('recognizes the ASIN URL shapes Amazon uses', () => {
    expect(asinFromUrl('https://www.amazon.de/dp/B09XS7JWHH')).toBe('B09XS7JWHH');
    expect(asinFromUrl('https://www.amazon.de/gp/product/B09XS7JWHH?th=1')).toBe('B09XS7JWHH');
    expect(asinFromUrl('https://www.amazon.de/-/en/dp/b09xs7jwhh/ref=x')).toBe('B09XS7JWHH');
    expect(asinFromUrl('https://www.amazon.de/s?k=kopfhoerer')).toBeUndefined();
  });
});

describe('detectProduct routing', () => {
  it('uses the DOM-first adapter on MediaMarkt even when JSON-LD is present', () => {
    // The stale-JSON-LD lesson: on SPA shops the visible page decides, so a
    // JSON-LD product that contradicts it must not win.
    const doc = render(
      `<h1>TCL 75C7K QLED Fernseher</h1><span>Art.-Nr.: 1234567</span>` +
        ldScript({ '@type': 'Product', name: 'PHILIPS 65OLED810/12', gtin13: '8718863038000' }),
    );
    expect(detectProduct(doc, MM_URL)).toBeNull();
  });

  it('returns nothing on a page without any product data', () => {
    const doc = render(`<h1>Kundenservice</h1>`);
    expect(detectProduct(doc, 'https://www.otto.de/service')).toBeNull();
  });
});
