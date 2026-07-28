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
  it('runs a single paid call when Perplexity returns valid structured research', async () => {
    const completeJson = vi.fn().mockResolvedValue(validConsensus);
    const braveContext = vi.fn().mockResolvedValue('');
    const service = createService(completeJson, braveContext, 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.positiveThemes).toHaveLength(1);
    expect(result.ratings).toHaveLength(1);
    expect(result.ratings[0]?.source).toBe('idealo');
    expect(completeJson).toHaveBeenCalledTimes(1);
    expect(completeJson.mock.calls[0]?.[1]).toMatchObject({ online: true });
    // The free experience supplement fires once; the paid fallback never does.
    expect(braveContext).toHaveBeenCalledTimes(1);
  });

  it('skips the free experience supplement once the Brave quota reserve is reached', async () => {
    const completeJson = vi.fn().mockResolvedValue(validConsensus);
    const braveContext = vi.fn().mockResolvedValue('');
    const service = createService(completeJson, braveContext, 'openrouter', {
      hasMonthlyBudget: false,
    });

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.ratings).toHaveLength(1);
    expect(braveContext).not.toHaveBeenCalled();
  });

  it('falls back to Brave grounding only after an invalid Perplexity response', async () => {
    const completeJson = vi.fn().mockResolvedValueOnce('not-json').mockResolvedValueOnce(validConsensus);
    const braveContext = vi.fn().mockResolvedValue('[1] Test\nhttps://example.de/test\nBeleg');
    const service = createService(completeJson, braveContext, 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.ratings).toHaveLength(1);
    expect(completeJson).toHaveBeenCalledTimes(2);
    expect(completeJson.mock.calls[1]?.[1]).toMatchObject({ online: false });
    // Once for the experience supplement, once for the fallback grounding.
    expect(braveContext).toHaveBeenCalledTimes(2);
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
    const service = createService(completeJson, vi.fn().mockResolvedValue(''), 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.summary).toContain('unabhängiger Test');
    expect(result.sourceUrls).toHaveLength(1);
  });

  it('keeps only source-backed switch alternatives and drops self-references', async () => {
    const completeJson = vi.fn().mockResolvedValue(
      JSON.stringify({
        ratings: [],
        summary: 'Mehrere Quellen vergleichen das Produkt mit direkten Konkurrenten.',
        longTermNote: 'Langzeitberichte nennen nach einem Jahr kaum Defekte.',
        positiveThemes: [],
        negativeThemes: [],
        switchAlternatives: [
          {
            name: 'Roborock S8 Pro',
            brand: 'Roborock',
            reason: 'leiser und bessere Navigation',
            sourceUrls: ['https://review-a.de/produkt'],
          },
          {
            name: 'Acme Sauger 5',
            brand: 'Acme',
            reason: 'Selbstreferenz muss rausfliegen',
            sourceUrls: ['https://review-a.de/produkt'],
          },
          {
            name: 'Phantom 9000',
            brand: null,
            reason: 'Quelle nicht im Quellen-Pool',
            sourceUrls: ['https://unbekannt.de/never-listed'],
          },
        ],
        sourceUrls: ['https://review-a.de/produkt', 'https://review-b.de/langzeittest'],
      }),
    );
    const service = createService(completeJson, vi.fn().mockResolvedValue(''), 'openrouter');

    const result = await service.researchExternalConsensus('Acme Sauger 5', 'Acme');

    expect(result.longTermNote).toContain('Langzeitberichte');
    expect(result.switchAlternatives).toHaveLength(1);
    expect(result.switchAlternatives[0]?.name).toBe('Roborock S8 Pro');
    expect(result.switchAlternatives[0]?.sourceUrls).toEqual(['https://review-a.de/produkt']);
  });

  it('keeps only voices whose source survived the URL gates and dedupes them', async () => {
    const completeJson = vi.fn().mockResolvedValue(
      JSON.stringify({
        ratings: [],
        summary: 'Tests und Nutzerstimmen zeichnen ein gemischtes Bild des Produkts.',
        positiveThemes: [],
        negativeThemes: [],
        voices: [
          {
            sourceLabel: 'TechTest',
            url: 'https://review-a.de/produkt',
            sentiment: 'PRO',
            text: 'Der Test lobt die lange Akkulaufzeit im Alltag.',
          },
          {
            sourceLabel: 'TechTest Kopie',
            url: 'https://review-a.de/produkt',
            sentiment: 'PRO',
            text: 'Doppelte Quelle muss rausfliegen, eine Stimme pro Seite.',
          },
          {
            sourceLabel: 'Werbeblog',
            url: 'https://unbekannt.de/never-listed',
            sentiment: 'PRO',
            text: 'Quelle nicht im Quellen-Pool, darf nicht durchkommen.',
          },
          {
            sourceLabel: 'Trustpilot',
            url: 'https://de.trustpilot.com/review/test.de',
            sentiment: 'CONTRA',
            text: 'Geblockte Shop-Bewertungsdomain, muss rausfliegen.',
          },
        ],
        sourceUrls: ['https://review-a.de/produkt', 'https://review-b.de/langzeittest'],
      }),
    );
    const service = createService(completeJson, vi.fn().mockResolvedValue(''), 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', 'Test');

    expect(result.voices).toHaveLength(1);
    expect(result.voices[0]?.sourceLabel).toBe('TechTest');
    expect(result.voices[0]?.sentiment).toBe('PRO');
  });

  it('carries the theme detail sentence through to the result', async () => {
    const completeJson = vi.fn().mockResolvedValue(
      JSON.stringify({
        ratings: [],
        summary: 'Mehrere Tests loben die Leistung, sehen aber Schwächen bei der Laufzeit.',
        positiveThemes: [
          {
            label: 'Starke Reinigungsleistung',
            detail: 'Nutzer berichten, dass auch Tierhaare zuverlässig entfernt werden.',
            sourceUrls: ['https://test-a.de/produkt', 'https://test-b.de/review'],
          },
        ],
        negativeThemes: [],
        sourceUrls: ['https://test-a.de/produkt', 'https://test-b.de/review'],
      }),
    );
    const service = createService(completeJson, vi.fn().mockResolvedValue(''), 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', null);

    expect(result.positiveThemes[0]?.detail).toContain('Tierhaare');
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
    const service = createService(completeJson, vi.fn().mockResolvedValue(''), 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', null);

    expect(result.positiveThemes[0]?.sourceUrls).toHaveLength(2);
    expect(result.negativeThemes[0]?.label).toBe('Erhöhter Akkuverbrauch');
  });

  it('drops a theme from the positives when it is also listed as criticism', async () => {
    const sourceUrls = ['https://test-a.de/produkt', 'https://test-b.de/review'];
    const completeJson = vi.fn().mockResolvedValue(
      JSON.stringify({
        ratings: [],
        summary: 'Mehrere Tests loben das Bild, sehen aber Schwächen bei der Ausstattung.',
        positiveThemes: [
          { label: 'Scharfes 4K-Bild', sourceUrls },
          // The model leaks criticism into the positives — differing case and
          // punctuation must not let it slip past the filter.
          { label: 'Ausstattung  ausbaufähig!', sourceUrls },
        ],
        negativeThemes: [{ label: 'Ausstattung ausbaufähig', sourceUrls }],
        sourceUrls,
      }),
    );
    const service = createService(completeJson, vi.fn().mockResolvedValue(''), 'openrouter');

    const result = await service.researchExternalConsensus('Test Product', null);

    expect(result.positiveThemes.map((theme) => theme.label)).toEqual(['Scharfes 4K-Bild']);
    expect(result.negativeThemes.map((theme) => theme.label)).toEqual(['Ausstattung ausbaufähig']);
  });
});

function createService(
  completeJson: ReturnType<typeof vi.fn>,
  context: ReturnType<typeof vi.fn>,
  provider: 'brave' | 'openrouter',
  options: { hasMonthlyBudget?: boolean } = {},
): OpenRouterAiService {
  const client: JsonChatClient = {
    modelChain: ['test'],
    completeJson,
    ping: vi.fn().mockResolvedValue({ ok: true }),
  };
  const brave = {
    enabled: true,
    context,
    hasMonthlyBudget: vi.fn().mockReturnValue(options.hasMonthlyBudget ?? true),
  };
  return new OpenRouterAiService(
    client,
    new DummyAiService(),
    {} as never,
    brave as never,
    provider,
  );
}
