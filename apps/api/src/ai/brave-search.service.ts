import { Injectable, Logger } from '@nestjs/common';

/** A single web result distilled to what an LLM needs as grounding context. */
export interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  /** Up to a handful of extra excerpts Brave pulls from the page. */
  snippets: string[];
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
