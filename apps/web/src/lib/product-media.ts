/**
 * Public product-media helpers.
 *
 * Product previews are served by the API, so browser-facing URLs must be
 * resolved against the public API base URL. When a product has no real image,
 * we fall back to the API's generated per-category preview SVG (addressed by id),
 * so the UI always shows a distinctive thumbnail instead of a blank box.
 */

function getPublicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
}

/** Resolve a stored imageUrl (absolute or API-relative) to an absolute URL, or null. */
export function resolveProductImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (/^data:image\//i.test(imageUrl)) return imageUrl;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return new URL(imageUrl, getPublicApiBaseUrl()).toString();
}

/** The API-generated preview SVG for a product (always available). */
export function productPreviewUrl(productId: string): string {
  const base = getPublicApiBaseUrl().replace(/\/$/, '');
  return `${base}/products/${productId}/image`;
}

/** The API-generated 1200×630 social share card (rebuy score + product). */
export function productShareImageUrl(productId: string): string {
  const base = getPublicApiBaseUrl().replace(/\/$/, '');
  return `${base}/products/${productId}/share.svg`;
}

/**
 * Best thumbnail for a product: its real image if set, otherwise the generated
 * per-category preview. Always returns a usable URL.
 */
export function productThumbUrl(product: { id: string; imageUrl: string | null }): string {
  return resolveProductImageUrl(product.imageUrl) ?? productPreviewUrl(product.id);
}
