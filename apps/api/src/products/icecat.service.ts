import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

/** A hit from an external product database (title + optional brand/photo). */
export interface EanLookupHit {
  title: string;
  brand: string | null;
  image: string | null;
  /** Provider key for attribution, e.g. "icecat". */
  source: string;
}

/** Subset of the Icecat Live JSON response we read. */
interface IcecatResponse {
  msg?: string;
  data?: {
    GeneralInfo?: {
      Title?: string;
      Brand?: string;
      ProductName?: string;
    };
    Image?: {
      HighPic?: string;
      LowPic?: string;
      Pic500x500?: string;
    };
    Gallery?: Array<{ Pic?: string; Pic500x500?: string }>;
  };
}

/**
 * Open Icecat lookup — official manufacturer product titles + press-quality
 * images by GTIN/EAN. Free for registered users ("Open Icecat" sponsor brands
 * cover most big consumer brands). Disabled (returns null) until
 * ICECAT_USERNAME is configured, so the EAN chain degrades gracefully.
 */
@Injectable()
export class IcecatService {
  private readonly logger = new Logger(IcecatService.name);
  private readonly username: string | null;
  private readonly apiToken: string | null;

  constructor(config: ConfigService<AppConfig, true>) {
    this.username = config.get('ICECAT_USERNAME', { infer: true })?.trim() || null;
    this.apiToken = config.get('ICECAT_API_TOKEN', { infer: true })?.trim() || null;
  }

  get enabled(): boolean {
    return this.username !== null;
  }

  /** Look up a GTIN/EAN. German content first, English as fallback. */
  async lookupGtin(ean: string): Promise<EanLookupHit | null> {
    if (!this.username) return null;
    return (await this.fetchLang(ean, 'de')) ?? (await this.fetchLang(ean, 'en'));
  }

  private async fetchLang(ean: string, lang: 'de' | 'en'): Promise<EanLookupHit | null> {
    try {
      const url =
        `https://live.icecat.biz/api?UserName=${encodeURIComponent(this.username!)}` +
        `&Language=${lang}&GTIN=${encodeURIComponent(ean)}&Content=GeneralInfo,Image,Gallery`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.apiToken) headers['api_token'] = this.apiToken;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(6_000) });
      if (!res.ok) return null;

      const json = (await res.json()) as IcecatResponse;
      const info = json.data?.GeneralInfo;
      if (!info) return null;

      const title =
        info.Title?.trim() ||
        [info.Brand, info.ProductName]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(' ');
      if (!title) return null;

      return {
        title,
        brand: info.Brand?.trim() || null,
        image: this.pickImage(json),
        source: 'icecat',
      };
    } catch (err) {
      this.logger.warn(`Icecat lookup failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /** Prefer the 500×500 rendition (uniform thumbnails) over the huge HighPic. */
  private pickImage(json: IcecatResponse): string | null {
    const img = json.data?.Image;
    const gallery = json.data?.Gallery?.[0];
    const candidates = [
      img?.Pic500x500,
      img?.HighPic,
      gallery?.Pic500x500,
      gallery?.Pic,
      img?.LowPic,
    ];
    return candidates.find((u) => typeof u === 'string' && u.startsWith('http'))?.trim() ?? null;
  }
}
