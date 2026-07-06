import { Injectable, Logger } from '@nestjs/common';

/** A single web result distilled to what an LLM needs as grounding context. */
export interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  /** Up to a handful of extra excerpts Brave pulls from the page. */
  snippets: string[];
}

/** Live free-plan quota, read from Brave's X-RateLimit-* response headers. */
export interface BraveQuotaSnapshot {
  /** Requests left in the current month (null until the first response). */
  remainingMonth: number | null;
  /** Monthly plan size as reported by the API (null until the first response). */
  limitMonth: number | null;
  updatedAt: string | null;
}

// Quota is account-wide (one key), so all service instances share one snapshot.
const quotaSnapshot: BraveQuotaSnapshot = {
  remainingMonth: null,
  limitMonth: null,
  updatedAt: null,
};

/** Latest known Brave quota — for the AI health endpoint. */
export function getBraveQuotaSnapshot(): BraveQuotaSnapshot {
  return { ...quotaSnapshot };
}

/** Brave sends "per-second, per-month" pairs, e.g. "1, 1985" → 1985. */
function parseMonthlyValue(header: string | null): number | null {
  const monthly = header?.split(',')[1]?.trim();
  if (!monthly) return null;
  const value = Number(monthly);
  return Number.isFinite(value) ? value : null;
}

/**
 * Thin wrapper around Brave's Web Search API. We use it to GROUND the AI: instead
 * of letting the model search the web blind (OpenRouter's `:online` plugin), we
 * fetch real, current results ourselves and hand the titles/URLs/snippets to the
 * model as context. That makes the research traceable (real source links), faster
 * (no second LLM web round-trip), and cheaper (no `:online` surcharge).
 *
 * Disabled (every method returns `[]`/`''`) until BRAVE_SEARCH_KEY is set, so the
 * AI service degrades gracefully back to `:online`.
 */
@Injectable()
export class BraveSearchService {
  private readonly logger = new Logger(BraveSearchService.name);

  constructor(private readonly apiKey: string | null) {}

  /** True when a key is configured — callers branch on this to keep `:online` as fallback. */
  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /** Latest known monthly quota (see {@link getBraveQuotaSnapshot}). */
  get quota(): BraveQuotaSnapshot {
    return getBraveQuotaSnapshot();
  }

  /**
   * True while the free monthly quota still has more than `reserve` requests
   * left. Gates OPTIONAL supplementary searches so they can never starve the
   * essential ones (research fallback, curation workbench, image hunt).
   * Unknown quota (no response seen yet) counts as available — a wrong "yes"
   * only costs one free request and refreshes the snapshot.
   */
  hasMonthlyBudget(reserve: number): boolean {
    if (!this.enabled) return false;
    const remaining = quotaSnapshot.remainingMonth;
    return remaining === null || remaining > reserve;
  }

  /**
   * Top web results for a query, German-localized. Returns `[]` on any failure or
   * when disabled — never throws, so it can sit on the request path safely.
   */
  async web(query: string, count = 6): Promise<BraveWebResult[]> {
    if (!this.apiKey || query.trim().length < 2) return [];
    try {
      const url =
        `https://api.search.brave.com/res/v1/web/search` +
        `?q=${encodeURIComponent(query.trim())}` +
        `&count=${Math.min(Math.max(count, 1), 20)}` +
        // result_filter=web drops the news/FAQ/discussion clusters — for product
        // grounding we only want page results. spellcheck repairs typo'd model
        // names so the grounding isn't empty for "honor magci5".
        `&country=de&search_lang=de&ui_lang=de-DE&safesearch=moderate` +
        `&extra_snippets=1&result_filter=web&spellcheck=1`;
      const res = await fetch(url, {
        headers: {
          'X-Subscription-Token': this.apiKey,
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
        },
        signal: AbortSignal.timeout(8_000),
      });
      this.captureQuota(res);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Brave web search HTTP ${res.status}: ${body.slice(0, 200)}`);
        return [];
      }
      const data = (await res.json()) as {
        web?: {
          results?: Array<{
            title?: string;
            url?: string;
            description?: string;
            extra_snippets?: string[];
          }>;
        };
      };
      return (data.web?.results ?? [])
        .filter((r) => r.url && /^https?:\/\//i.test(r.url))
        .map((r) => ({
          title: stripTags(r.title ?? ''),
          url: r.url!,
          description: stripTags(r.description ?? ''),
          snippets: (r.extra_snippets ?? []).map(stripTags).filter(Boolean).slice(0, 4),
        }));
    } catch (err) {
      this.logger.warn(`Brave web search failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /** Refresh the shared quota snapshot from a response (429s carry headers too). */
  private captureQuota(res: Response): void {
    const remaining = parseMonthlyValue(res.headers.get('x-ratelimit-remaining'));
    const limit = parseMonthlyValue(res.headers.get('x-ratelimit-limit'));
    if (remaining === null && limit === null) return;
    quotaSnapshot.remainingMonth = remaining ?? quotaSnapshot.remainingMonth;
    quotaSnapshot.limitMonth = limit ?? quotaSnapshot.limitMonth;
    quotaSnapshot.updatedAt = new Date().toISOString();
    if (remaining !== null && remaining <= 100) {
      this.logger.warn(`Brave monthly quota low: ${remaining} requests left`);
    }
  }

  /**
   * Render web results as a compact context block to prepend to an LLM prompt.
   * Empty string when there are no results, so the caller can cleanly skip it.
   */
  async context(query: string, count = 6): Promise<string> {
    const results = await this.web(query, count);
    if (results.length === 0) return '';
    const blocks = results.map((r, i) => {
      const body = [r.description, ...r.snippets].filter(Boolean).join(' ');
      return `[${i + 1}] ${r.title}\n${r.url}\n${body}`.trim();
    });
    return blocks.join('\n\n');
  }
}

/** Brave wraps matched terms in <strong>…</strong>; strip all tags for a clean prompt. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
