import { describe, expect, it, vi } from 'vitest';
import { DummyAiService } from './dummy-ai.service';
import { OpenRouterAiService } from './openrouter-ai.service';
import type { JsonChatClient } from './openrouter.client';

const validConsensus = JSON.stringify({
  ratings: [
    { source: 'idealo', sourceLabel: 'Idealo', url: 'https://idealo.de/p', kind: 'STARS', value: 4.5, maxValue: 5, count: 120 },
    { source: 'trustpilot', sourceLabel: 'Trustpilot', url: 'https://de.trustpilot.com/review/test.de', kind: 'STARS', value: 1.5, maxValue: 5, count: 500 },
  ],
  summary: 'Mehrere öffentliche Quellen loben die Leistung, kritisieren aber das Gewicht.',
  positiveThemes: [{ label: 'Starke Leistung', sourceUrls: ['https://idealo.de/p', 'https://example.de/test'] }],
  negativeThemes: [{ label: 'Relativ hohes Gewicht', sourceUrls: ['https://idealo.de/p', 'https://example.de/test'] }],
  sourceUrls: ['https://idealo.de/p', 'https://example.de/test'],
});

describe('OpenRouterAiService research cost gates', () => {
  it('does not call Brave when Perplexity returns valid structured research', async () => {
    const completeJson = vi.fn().mockResolvedValue(validConsensus);
    const braveContext = vi.fn();
    const service = createService(completeJson, braveContext, 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.positiveThemes).toHaveLength(1);
    expect(result.ratings).toHaveLength(1);
    expect(result.ratings[0]?.source).toBe('idealo');
    expect(completeJson).toHaveBeenCalledTimes(1);
    expect(completeJson.mock.calls[0]?.[1]).toMatchObject({ online: true });
    expect(braveContext).not.toHaveBeenCalled();
  });

  it('pays for Brave only after an invalid Perplexity response', async () => {
    const completeJson = vi.fn().mockResolvedValueOnce('not-json').mockResolvedValueOnce(validConsensus);
    const braveContext = vi.fn().mockResolvedValue('[1] Test\nhttps://example.de/test\nBeleg');
    const service = createService(completeJson, braveContext, 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.ratings).toHaveLength(1);
    expect(completeJson).toHaveBeenCalledTimes(2);
    expect(completeJson.mock.calls[1]?.[1]).toMatchObject({ online: false });
    expect(braveContext).toHaveBeenCalledTimes(1);
  });

  it('keeps a sourced summary even when only one product-review source is available', async () => {
    const completeJson = vi.fn().mockResolvedValue(
      JSON.stringify({
        ratings: [],
        summary: 'Ein unabhängiger Test bewertet das Produkt insgesamt positiv.',
        positiveThemes: [],
        negativeThemes: [],
        sourceUrls: ['https://example.de/produkt-test'],
      }),
    );
    const service = createService(completeJson, vi.fn(), 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.summary).toContain('unabhängiger Test');
    expect(result.sourceUrls).toHaveLength(1);
  });

  it('normalizes flattened themes when two independent review sources are present', async () => {
    const completeJson = vi.fn().mockResolvedValue(
      JSON.stringify({
        ratings: [],
        summary: 'Mehrere Tests loben die Leistung, sehen aber Schwächen bei der Laufzeit.',
        positiveThemes: ['Starke Reinigungsleistung'],
        negativeThemes: ['Erhöhter Akkuverbrauch'],
        sourceUrls: ['https://test-a.de/produkt', 'https://test-b.de/review'],
      }),
    );
    const service = createService(completeJson, vi.fn(), 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', null);

    expect(result.positiveThemes[0]?.sourceUrls).toHaveLength(2);
    expect(result.negativeThemes[0]?.label).toBe('Erhöhter Akkuverbrauch');
  });
});

function createService(
  completeJson: ReturnType<typeof vi.fn>,
  context: ReturnType<typeof vi.fn>,
  provider: 'brave' | 'openrouter',
): OpenRouterAiService {
  const client: JsonChatClient = {
    modelChain: ['test'],
    completeJson,
    ping: vi.fn().mockResolvedValue({ ok: true }),
  };
  const brave = { enabled: true, context };
  return new OpenRouterAiService(
    client,
    new DummyAiService(),
    {} as never,
    brave as never,
    provider,
  );
}
