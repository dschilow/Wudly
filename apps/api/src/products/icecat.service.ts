import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

/** A hit from an external product database (title + optional brand/photo/specs). */
export interface EanLookupHit {
  title: string;
  brand: string | null;
  image: string | null;
  /** Short product description, when the source provides one. */
  description?: string | null;
  /** Key technical facts (model, dimensions, …), order-preserving. */
  specs?: Array<{ label: string; value: string }>;
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
      SummaryDescription?: {
        ShortSummaryDescription?: string;
        LongSummaryDescription?: string;
      };
      Description?: { LongDesc?: string; ShortDesc?: string };
    };
    Image?: {
      HighPic?: string;
      LowPic?: string;
      Pic500x500?: string;
    };
    Gallery?: Array<{ Pic?: string; Pic500x500?: string }>;
    FeaturesGroups?: Array<{
      Features?: Array<{
        Feature?: { Name?: { Value?: string } };
        LocalValue?: string;
        PresentationValue?: string;
        Value?: string;
      }>;
    }>;
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

  constructor(@Inject(ConfigService) config: ConfigService<AppConfig, true>) {
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
        `&Language=${lang}&GTIN=${encodeURIComponent(ean)}` +
        `&Content=GeneralInfo,Image,Gallery,FeaturesGroups`;
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
        description: this.pickDescription(info),
        specs: this.pickSpecs(json),
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

  /** A short marketing/summary line, trimmed to a sane length. */
  private pickDescription(info: NonNullable<IcecatResponse['data']>['GeneralInfo']): string | null {
    const raw =
      info?.SummaryDescription?.ShortSummaryDescription?.trim() ||
      info?.Description?.ShortDesc?.trim() ||
      info?.SummaryDescription?.LongSummaryDescription?.trim() ||
      info?.Description?.LongDesc?.trim() ||
      '';
    if (!raw) return null;
    const clean = raw.replace(/\s+/g, ' ').trim();
    return clean.length > 600 ? `${clean.slice(0, 597).trimEnd()}…` : clean;
  }

  /** The most useful named features as flat label/value pairs (top ~12). */
  private pickSpecs(json: IcecatResponse): Array<{ label: string; value: string }> {
    const out: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    for (const group of json.data?.FeaturesGroups ?? []) {
      for (const feat of group.Features ?? []) {
        const label = feat.Feature?.Name?.Value?.trim();
        const value = (
          feat.PresentationValue?.trim() ||
          feat.LocalValue?.trim() ||
          feat.Value?.trim() ||
          ''
        ).trim();
        if (!label || !value) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        // Skip noise: pure yes/no flags and overly long values.
        if (/^(y|n|yes|no|ja|nein|true|false)$/i.test(value)) continue;
        if (value.length > 80) continue;
        seen.add(key);
        out.push({ label, value });
        if (out.length >= 12) return out;
      }
    }
    return out;
  }
}
