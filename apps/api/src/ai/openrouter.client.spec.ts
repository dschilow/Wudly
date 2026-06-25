import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterClient } from './openrouter.client';

describe('OpenRouterClient web search', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the Perplexity engine through the OpenRouter web plugin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{found:true}',
                annotations: [
                  {
                    type: 'url_citation',
                    url_citation: { url: 'https://example.com/product' },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.0052 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenRouterClient({
      apiKey: 'test-key',
      model: 'google/gemini-3.1-flash-lite',
      appTitle: 'Wudly Test',
      webSearchEngine: 'perplexity',
      webSearchMaxResults: 5,
      webSearchPrompt: 'Nur Recherchekontext; antworte im verlangten JSON-Format.',
      webSearchExcludeDomains: ['youtube.com', 'ebay.de'],
    });

    const result = await client.completeJsonDetailed(
      [{ role: 'user', content: 'Find product' }],
      { online: true },
    );

    expect(result).toMatchObject({
      ok: true,
      content: '{found:true}',
      citations: ['https://example.com/product'],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.0052 },
    });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.model).toBe('google/gemini-3.1-flash-lite');
    expect(body.plugins).toEqual([
      {
        id: 'web',
        engine: 'perplexity',
        max_results: 5,
        search_prompt: 'Nur Recherchekontext; antworte im verlangten JSON-Format.',
        exclude_domains: ['youtube.com', 'ebay.de'],
      },
    ]);
  });

  it('does not attach a web plugin to offline calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{ok:true}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenRouterClient({
      apiKey: 'test-key',
      model: 'google/gemini-3.1-flash-lite',
      appTitle: 'Wudly Test',
      webSearchEngine: 'perplexity',
    });
    await client.completeJson([{ role: 'user', content: 'Normalize product' }]);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.plugins).toBeUndefined();
  });
});
