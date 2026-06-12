import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Hard cap so a hostile/huge source can't bloat the DB (per image). */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif|avif)$/i;

/**
 * Downloads external product images ONCE and serves them from our own DB,
 * so thumbnails stay uniform and permanent instead of hotlinking third-party
 * URLs that rot, vary in quality, or leak the visitor to the source.
 *
 * After a successful cache, the product's imageUrl is switched to the
 * API-relative `/products/:id/photo` (the web resolves that against the API
 * base). Failures leave the original URL untouched — nothing gets worse.
 */
@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Cached bytes for serving, or throw 404. */
  async getOrThrow(productId: string): Promise<{ mime: string; bytes: Buffer }> {
    const image = await this.prisma.productImage.findUnique({ where: { productId } });
    if (!image) throw new NotFoundException('Kein Produktfoto vorhanden.');
    return { mime: image.mime, bytes: Buffer.from(image.bytes) };
  }

  /**
   * Fire-and-forget entry point: cache an external (http/https) or inline
   * (data:) image for a product. Never throws — callers don't await quality
   * work on the request path.
   */
  cacheInBackground(productId: string, url: string, source: string): void {
    void this.cache(productId, url, source).catch((err) => {
      this.logger.warn(
        `Image cache failed for ${productId}: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  private async cache(productId: string, url: string, source: string): Promise<void> {
    const fetched = url.startsWith('data:')
      ? this.decodeDataUrl(url)
      : await this.download(url);
    if (!fetched) {
      // An AI-guessed image URL that won't load must not linger as a broken
      // <img> — clear it so the product falls back to its generated placeholder.
      if (source === 'ai') {
        await this.prisma.product
          .updateMany({ where: { id: productId, imageUrl: url }, data: { imageUrl: null } })
          .catch(() => undefined);
      }
      return;
    }

    await this.prisma.productImage.upsert({
      where: { productId },
      create: {
        productId,
        mime: fetched.mime,
        bytes: fetched.bytes,
        sourceUrl: url.startsWith('data:') ? null : url,
        source,
      },
      update: {
        mime: fetched.mime,
        bytes: fetched.bytes,
        sourceUrl: url.startsWith('data:') ? null : url,
        source,
      },
    });
    // Convention: stored API-relative paths include the global "/api" prefix and
    // resolve against the API origin (same as the seed's preview-SVG URLs).
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl: `/api/products/${productId}/photo` },
    });
  }

  private async download(url: string): Promise<{ mime: string; bytes: Uint8Array<ArrayBuffer> } | null> {
    if (!/^https?:\/\//i.test(url)) return null;
    const res = await fetch(url, {
      headers: { Accept: 'image/*', 'User-Agent': 'Wudly/1.0 (wudly.app)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!ALLOWED_MIME.test(mime)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { mime, bytes };
  }

  private decodeDataUrl(url: string): { mime: string; bytes: Uint8Array<ArrayBuffer> } | null {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(url);
    if (!match) return null;
    const mime = match[1]!;
    if (!ALLOWED_MIME.test(mime)) return null;
    try {
      // Copy into a fresh ArrayBuffer-backed array (Prisma Bytes rejects Buffer's
      // ArrayBufferLike typing).
      const bytes = new Uint8Array(Buffer.from(match[2]!, 'base64'));
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
      return { mime, bytes };
    } catch {
      return null;
    }
  }
}
