import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../config/configuration';

/** Hard cap so a hostile/huge source can't bloat the DB (per image). */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif|avif)$/i;
/** Cap for HTML downloads when extracting og:image from a product page. */
const MAX_HTML_BYTES = 400 * 1024;

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
  private readonly cseKey: string | null;
  private readonly cseId: string | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cseKey = config.get('GOOGLE_CSE_KEY', { infer: true })?.trim() || null;
    this.cseId = config.get('GOOGLE_CSE_ID', { infer: true })?.trim() || null;
  }

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

    // Convention: stored API-relative paths include the global "/api" prefix and
    // resolve against the API origin (same as the seed's preview-SVG URLs).
    await this.store(productId, url.startsWith('data:') ? null : url, source, fetched);
  }

  private async download(url: string): Promise<{ mime: string; bytes: Uint8Array<ArrayBuffer> } | null> {
    if (!/^https?:\/\//i.test(url)) return null;
    // Browser UA + a same-origin referer: many product CDNs hotlink-protect
    // their images and 403 a bot UA. We pull the bytes into our own cache, so
    // there's no lasting hotlink — this just gets past the gate once.
    let referer: string | undefined;
    try {
      referer = new URL(url).origin + '/';
    } catch {
      referer = undefined;
    }
    const res = await fetch(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        ...(referer ? { Referer: referer } : {}),
      },
      signal: AbortSignal.timeout(8_000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!ALLOWED_MIME.test(mime)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { mime, bytes };
  }

  /**
   * The product-photo hunt for products no EAN database covered. Tries every
   * candidate in order and caches the FIRST one that actually downloads as a
   * real image — `product.imageUrl` is only ever set after validation, so the
   * UI never renders a broken photo. Candidate order (most reliable first):
   *
   *   1. Google image search (finds REAL urls instead of guessing — by far the
   *      most reliable source for products no EAN db covers)
   *   2. og:image of the official product page the AI named (good when the url
   *      is right, but the AI guesses it — a lead, not a guarantee)
   *   3. direct AI-suggested image url (LLMs hallucinate these — last resort)
   *
   * Fire-and-forget; on total failure the generated placeholder remains.
   */
  findAndCacheInBackground(
    productId: string,
    query: string,
    options: { candidateUrls?: Array<string | null | undefined>; pageUrl?: string | null },
  ): void {
    void this.hunt(productId, query, options).then((report) => {
      if (report.storedVia) {
        this.logger.log(`Image found for ${productId} via ${report.storedVia} (q="${query}")`);
      } else {
        this.logger.warn(
          `Image hunt EMPTY for ${productId} (q="${query}"): ` +
            `google=${report.googleCount} og=${report.ogFound ? 'yes' : 'no'} ` +
            `ai=${report.aiCount} cse=${this.cseKey && this.cseId ? 'configured' : 'OFF'}`,
        );
      }
    });
  }

  /**
   * The actual hunt — returns a diagnostic report so the debug endpoint can show
   * exactly which stage produced what (the #1 thing missing when "no images"
   * needs answering without a redeploy). Never throws.
   */
  async hunt(
    productId: string,
    query: string,
    options: { candidateUrls?: Array<string | null | undefined>; pageUrl?: string | null },
  ): Promise<{
    storedVia: string | null;
    cseConfigured: boolean;
    googleCount: number;
    ogFound: boolean;
    aiCount: number;
    tried: Array<{ url: string; source: string; ok: boolean; reason?: string }>;
  }> {
    const report = {
      storedVia: null as string | null,
      cseConfigured: Boolean(this.cseKey && this.cseId),
      googleCount: 0,
      ogFound: false,
      aiCount: 0,
      tried: [] as Array<{ url: string; source: string; ok: boolean; reason?: string }>,
    };
    const candidates: Array<{ url: string; source: string }> = [];

    try {
      // 1 · Google CSE first — it finds real, live image urls.
      const googleUrls = await this.searchGoogleImages(query);
      report.googleCount = googleUrls.length;
      for (const url of googleUrls) candidates.push({ url, source: 'google-images' });

      // 2 · og:image of the AI-named product page.
      if (options.pageUrl) {
        const og = await this.findOgImage(options.pageUrl);
        if (og) {
          report.ogFound = true;
          candidates.push({ url: og, source: 'og-image' });
        }
      }

      // 3 · direct AI-suggested image urls (least reliable).
      for (const url of options.candidateUrls ?? []) {
        if (url && /^https?:\/\//i.test(url)) {
          report.aiCount += 1;
          candidates.push({ url: this.absolutize(url), source: 'ai' });
        }
      }

      for (const candidate of candidates) {
        let reason: string | undefined;
        const fetched = await this.download(candidate.url).catch((e) => {
          reason = e instanceof Error ? e.message : 'error';
          return null;
        });
        report.tried.push({ url: candidate.url, source: candidate.source, ok: Boolean(fetched), reason });
        if (!fetched) continue;
        await this.store(productId, candidate.url, candidate.source, fetched);
        report.storedVia = candidate.source;
        return report;
      }
    } catch (err) {
      this.logger.warn(
        `Image hunt failed for ${productId}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return report;
  }

  /** Resolve protocol-relative (`//host/…`) urls to absolute https. */
  private absolutize(url: string): string {
    const u = url.trim();
    return u.startsWith('//') ? `https:${u}` : u;
  }

  /** Extract og:image / twitter:image from a product page (capped download). */
  private async findOgImage(pageUrl: string): Promise<string | null> {
    if (!/^https?:\/\//i.test(pageUrl)) return null;
    try {
      // Browser UA on purpose: manufacturer pages (mi.com & co) 403 anything
      // bot-labelled, and we only read the og:image meta — the tag that exists
      // precisely so third parties can render a share preview.
      const res = await fetch(pageUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8_000),
        redirect: 'follow',
      });
      if (!res.ok) return null;
      const reader = res.body?.getReader();
      if (!reader) return null;
      let html = '';
      const decoder = new TextDecoder();
      while (html.length < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      void reader.cancel().catch(() => undefined);

      const match =
        /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:url|twitter:image)["'][^>]+content=["']([^"']+)["']/i.exec(
          html,
        ) ??
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:url|twitter:image)["']/i.exec(
          html,
        );
      if (!match?.[1]) return null;
      const raw = match[1].replace(/&amp;/g, '&').trim();
      return new URL(raw, pageUrl).toString();
    } catch {
      return null;
    }
  }

  /** Top image-search hits for "<query>" (empty when CSE isn't configured). */
  private async searchGoogleImages(query: string): Promise<string[]> {
    if (!this.cseKey || !this.cseId || query.trim().length < 2) return [];
    try {
      const url =
        `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(this.cseKey)}` +
        `&cx=${encodeURIComponent(this.cseId)}&searchType=image&num=8&safe=active` +
        // Bias towards usable product shots over tiny icons / huge banners.
        `&imgSize=large&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        // Google returns a precise reason (bad key, CSE not enabled, quota) in
        // the body — surface it, otherwise "no images" is unanswerable.
        const body = await res.text().catch(() => '');
        this.logger.warn(`Google CSE HTTP ${res.status}: ${body.slice(0, 300)}`);
        return [];
      }
      const data = (await res.json()) as { items?: Array<{ link?: string }> };
      return (data.items ?? [])
        .map((i) => this.absolutize(i.link?.trim() ?? ''))
        .filter((u) => /^https?:\/\//i.test(u));
    } catch (err) {
      this.logger.warn(`Google image search failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /** Persist validated bytes + flip the product's imageUrl to our cached photo. */
  private async store(
    productId: string,
    sourceUrl: string | null,
    source: string,
    fetched: { mime: string; bytes: Uint8Array<ArrayBuffer> },
  ): Promise<void> {
    await this.prisma.productImage.upsert({
      where: { productId },
      create: { productId, mime: fetched.mime, bytes: fetched.bytes, sourceUrl, source },
      update: { mime: fetched.mime, bytes: fetched.bytes, sourceUrl, source },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl: `/api/products/${productId}/photo` },
    });
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
