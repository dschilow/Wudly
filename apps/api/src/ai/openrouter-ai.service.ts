import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  type AiService,
  type ProductInput,
  type ProductCandidate,
  type NormalizedExperience,
  type ProductInsightSummary,
  type IdentifiedProduct,
  type RegretAssessment,
  type ResearchedProduct,
  type SuggestedProductCandidate,
  type ResearchedExternalRating,
  AspectSentiment,
  guessBrand,
  EXPERIENCE_MOOD_LABEL,
  USAGE_DURATION_LABEL,
  WOULD_BUY_AGAIN_LABEL,
  COMMON_QUESTIONS,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DummyAiService } from './dummy-ai.service';
import { parseJsonObject, type ChatMessage, type JsonChatClient } from './openrouter.client';
import { BraveSearchService } from './brave-search.service';

/* ----- Zod schemas to validate model output (never trust it raw) ----- */

const candidateSchema = z.object({
  canonicalName: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(80).optional().nullable(),
  categorySlug: z.string().trim().max(80).optional().nullable(),
});

const aspectSchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(60),
});
const normalizedSchema = z.object({
  positive: z.array(aspectSchema).max(8).optional().default([]),
  negative: z.array(aspectSchema).max(8).optional().default([]),
  summary: z.string().trim().max(280).optional(),
});

const summarySchema = z.object({
  headline: z.string().trim().min(1).max(180),
  strengths: z.array(z.string().trim().min(1).max(80)).max(6).optional().default([]),
  weaknesses: z.array(z.string().trim().min(1).max(80)).max(6).optional().default([]),
  suitedFor: z.array(z.string().trim().min(1).max(90)).max(4).optional().default([]),
  notSuitedFor: z.array(z.string().trim().min(1).max(90)).max(4).optional().default([]),
});

const questionsSchema = z.object({
  questions: z.array(z.string().trim().min(5).max(120)).max(6).optional().default([]),
});

const identifySchema = z.object({
  brand: z.string().trim().max(80).nullable().optional(),
  product: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  confidence: z.coerce.number().min(0).max(1).catch(0).default(0),
});

const regretSchema = z.object({
  rebuyProbability: z.coerce.number().min(0).max(100).nullable().optional(),
  topConcern: z.string().trim().max(80).nullable().optional(),
  summary: z.string().trim().min(1).max(240),
});

const suggestProductsSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(160),
        brand: z.string().trim().max(80).nullable().optional(),
        ean: z
          .string()
          .trim()
          .regex(/^\d{8,14}$/)
          .nullable()
          .optional(),
      }),
    )
    .max(3)
    .default([]),
});

const externalRatingsSchema = z.object({
  ratings: z
    .array(
      z.object({
        source: z.string().trim().min(2).max(40),
        sourceLabel: z.string().trim().min(2).max(60),
        url: z.string().trim().url().max(600),
        kind: z.enum(['STARS', 'PERCENT', 'GRADE_DE']),
        value: z.number(),
        maxValue: z.number(),
        count: z.number().int().positive().nullable().optional(),
      }),
    )
    .max(4)
    .default([]),
});

const researchSchema = z.object({
  canonicalName: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(80).nullable().optional(),
  categorySlug: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(400).nullable().optional(),
  specs: z
    .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(80) }))
    .max(14)
    .optional(),
  imageUrl: z.string().trim().url().max(600).nullable().optional(),
  productUrl: z.string().trim().url().max(600).nullable().optional(),
  found: z.coerce.boolean().optional().default(false),
});

/**
 * Real AI implementation backed by OpenRouter (Gemini Flash 3.1 Lite by default).
 *
 * Every method validates the model's JSON with Zod and **falls back to the
 * deterministic DummyAiService** on any failure (missing key, network, bad JSON).
 * This keeps the app fully functional with or without a configured AI key.
 */
@Injectable()
export class OpenRouterAiService implements AiService {
  private readonly logger = new Logger(OpenRouterAiService.name);

  constructor(
    private readonly client: JsonChatClient,
    private readonly fallback: DummyAiService,
    private readonly prisma: PrismaService,
    private readonly brave: BraveSearchService,
  ) {}

  /**
   * When Brave is configured, ground research in real search results we fetch
   * ourselves rather than the model's blind `:online` web plugin. Returns the
   * context block to inject, whether `:online` is still needed as fallback, and
   * `grounded` — true only when we actually have web context in hand.
   *
   * `grounded` lets the caller decide what to do in the "Brave keyed but empty"
   * case: a gated path (ratings) can let the model answer from memory, but a
   * path that would otherwise invent names (suggestProducts) must return nothing
   * rather than guess unverifiably.
   */
  private async groundedSearch(
    query: string,
    count = 6,
  ): Promise<{ contextMessages: ChatMessage[]; online: boolean; grounded: boolean }> {
    if (!this.brave.enabled) return { contextMessages: [], online: true, grounded: false };
    const context = await this.brave.context(query, count);
    if (!context) {
      // Key present but no hits for this query. Don't re-enable `:online`: Brave
      // is our web layer now (and a local Ollama model can't do `:online` at all).
      // `grounded: false` tells callers there is nothing to verify against.
      return { contextMessages: [], online: false, grounded: false };
    }
    return {
      online: false,
      grounded: true,
      contextMessages: [
        {
          role: 'system',
          content:
            'Aktuelle Websuche-Ergebnisse (nutze NUR diese als Quelle; jede Zahl/URL muss hier ' +
            `belegt sein, sonst weglassen):\n\n${context}`,
        },
      ],
    };
  }

  async extractProductCandidate(input: ProductInput): Promise<ProductCandidate> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du bist ein Produktdaten-Normalisierer für eine deutsche Produkt-Plattform. ' +
          'Bereinige rohe Produktnamen zu einem sauberen, eindeutigen kanonischen Namen, ' +
          'erkenne die Marke und ordne grob eine Kategorie zu. Erfinde keine Modellnummern. ' +
          'Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"canonicalName": string, "brand": string|null, "categorySlug": string|null}.',
      },
      {
        role: 'user',
        content:
          `Roher Name: "${input.rawName}"` +
          (input.brandHint ? `\nMarken-Hinweis: ${input.brandHint}` : '') +
          (input.categoryHint ? `\nKategorie-Hinweis (slug): ${input.categoryHint}` : ''),
      },
    ];

    const parsed = candidateSchema.safeParse(
      parseJsonObject(await this.client.completeJson(messages, { temperature: 0.2, maxTokens: 300 })),
    );
    if (!parsed.success) return this.fallback.extractProductCandidate(input);

    return {
      canonicalName: parsed.data.canonicalName,
      brand: parsed.data.brand ?? guessBrand(parsed.data.canonicalName),
      categorySlug: parsed.data.categorySlug ?? input.categoryHint,
      confidence: 0.85,
    };
  }

  async normalizeExperienceText(text: string): Promise<NormalizedExperience> {
    if (!text || text.trim().length < 8) return this.fallback.normalizeExperienceText(text);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du extrahierst aus einem deutschen Erfahrungstext zu einem Produkt die wichtigsten ' +
          'positiven und negativen Aspekte. Jeder Aspekt: kurzer key (lowercase, ohne Leerzeichen) ' +
          'und ein lesbares deutsches label (1–2 Wörter). Max 4 je Seite. ' +
          'Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"positive":[{"key","label"}],"negative":[{"key","label"}],"summary": string}.',
      },
      { role: 'user', content: text.slice(0, 1500) },
    ];

    const parsed = normalizedSchema.safeParse(
      parseJsonObject(await this.client.completeJson(messages, { temperature: 0.3, maxTokens: 500 })),
    );
    if (!parsed.success) return this.fallback.normalizeExperienceText(text);

    return {
      positiveAspects: parsed.data.positive.map((a) => ({
        key: a.key,
        label: a.label,
        sentiment: AspectSentiment.POSITIVE,
      })),
      negativeAspects: parsed.data.negative.map((a) => ({
        key: a.key,
        label: a.label,
        sentiment: AspectSentiment.NEGATIVE,
      })),
      summary: parsed.data.summary,
    };
  }

  async summarizeProductInsights(productId: string): Promise<ProductInsightSummary> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product) return this.fallback.summarizeProductInsights(productId);

    const reports = await this.prisma.experienceReport.findMany({
      where: { productId, isPublic: true },
      include: { aspects: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    // Not enough signal → cheap deterministic fallback (avoids paying for nothing).
    if (reports.length < 2) return this.fallback.summarizeProductInsights(productId);

    const lines = reports.map((r) => {
      const pos = r.aspects.filter((a) => a.sentiment === 'POSITIVE').map((a) => a.aspectKey);
      const neg = r.aspects.filter((a) => a.sentiment === 'NEGATIVE').map((a) => a.aspectKey);
      return (
        `- Wiederkauf: ${WOULD_BUY_AGAIN_LABEL[r.wouldBuyAgain]}, ` +
        `Nutzung: ${USAGE_DURATION_LABEL[r.usageDuration]}, ` +
        `Eindruck: ${EXPERIENCE_MOOD_LABEL[r.experienceMood]}` +
        (pos.length ? `, mag: ${pos.join('/')}` : '') +
        (neg.length ? `, nervt: ${neg.join('/')}` : '') +
        (r.wishKnownText ? `, vorher-gewusst: ${r.wishKnownText}` : '')
      );
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du fasst echte Besitzer-Erfahrungen zu einem Produkt neutral und ehrlich zusammen. ' +
          'Kurz, konkret, deutsch, kein Marketing. Nenne Stärken und Schwächen nur, wenn sie in den ' +
          'Daten vorkommen. "headline" ist ein prägnanter Satz (max 140 Zeichen). ' +
          'Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"headline":string,"strengths":string[],"weaknesses":string[],"suitedFor":string[],"notSuitedFor":string[]}.',
      },
      {
        role: 'user',
        content:
          `Produkt: ${product.canonicalName}${product.brand ? ` (${product.brand})` : ''}` +
          `${product.category ? `, Kategorie: ${product.category.name}` : ''}\n` +
          `Anzahl Erfahrungen: ${reports.length}\n\nErfahrungen:\n${lines.join('\n')}`,
      },
    ];

    const parsed = summarySchema.safeParse(
      parseJsonObject(await this.client.completeJson(messages, { temperature: 0.5, maxTokens: 700 })),
    );
    if (!parsed.success) return this.fallback.summarizeProductInsights(productId);

    return { productId, ...parsed.data };
  }

  async suggestQuestions(productId: string): Promise<string[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product) return this.fallback.suggestQuestions(productId);

    // Give the model some context: existing questions (avoid repeats) and known aspects.
    const [existing, snapshot] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where: { productId, status: { not: 'HIDDEN' } },
        select: { questionText: true },
        take: 12,
      }),
      this.prisma.productInsightSnapshot.findUnique({ where: { productId } }),
    ]);

    const asked = existing.map((q) => q.questionText).join(' | ');
    const negatives = Array.isArray(snapshot?.topNegativeAspects)
      ? (snapshot?.topNegativeAspects as Array<{ label?: string }>)
          .map((a) => a?.label)
          .filter(Boolean)
          .join(', ')
      : '';

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du hilfst Kaufinteressenten, die richtigen Fragen an echte Besitzer eines Produkts zu ' +
          'stellen. Erzeuge 4 kurze, konkrete, alltagsnahe Fragen auf Deutsch (max 90 Zeichen je Frage). ' +
          'Keine Ja/Nein-Floskeln ohne Inhalt, keine Wiederholung bereits gestellter Fragen. ' +
          'Antworte ausschließlich als valides JSON ohne Markdown: {"questions": string[]}.',
      },
      {
        role: 'user',
        content:
          `Produkt: ${product.canonicalName}${product.brand ? ` (${product.brand})` : ''}` +
          `${product.category ? `, Kategorie: ${product.category.name}` : ''}` +
          (negatives ? `\nBekannte Schwachpunkte: ${negatives}` : '') +
          (asked ? `\nBereits gestellt: ${asked}` : ''),
      },
    ];

    const parsed = questionsSchema.safeParse(
      parseJsonObject(
        await this.client.completeJson(messages, {
          temperature: 0.7,
          maxTokens: 180,
          timeoutMs: 5_000,
        }),
      ),
    );
    const questions = parsed.success
      ? parsed.data.questions.filter((q) => q.trim().length > 0)
      : [];

    // Top up from product/category-aware prompts if the local model is too slow.
    if (questions.length < 3) {
      for (const q of fallbackOwnerQuestions(product.canonicalName, product.category?.name ?? null)) {
        if (questions.length >= 4) break;
        if (!questions.includes(q)) questions.push(q);
      }
    }
    return questions.slice(0, 4);
  }

  async identifyProductFromImage(imageDataUrl: string): Promise<IdentifiedProduct> {
    if (!imageDataUrl.startsWith('data:image/')) {
      return this.fallback.identifyProductFromImage(imageDataUrl);
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du erkennst Konsumprodukte auf einem Foto für eine deutsche Produkt-Plattform. ' +
          'Nenne Marke, Produktnamen (inkl. Modell, falls klar lesbar) und eine grobe Kategorie. ' +
          'Rate nicht: Wenn du dir unsicher bist, setze die Felder auf null und confidence niedrig. ' +
          'Antworte ausschließlich als valides JSON ohne Markdown, kein Fließtext: ' +
          '{"brand": string|null, "product": string|null, "category": string|null, "confidence": number}.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Welches Produkt ist auf dem Bild? Antworte nur mit dem JSON.' },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ];

    const parsed = identifySchema.safeParse(
      parseJsonObject(await this.client.completeJson(messages, { temperature: 0.1, maxTokens: 200 })),
    );
    if (!parsed.success) return this.fallback.identifyProductFromImage(imageDataUrl);

    return {
      brand: parsed.data.brand ?? null,
      product: parsed.data.product ?? null,
      category: parsed.data.category ?? null,
      confidence: parsed.data.confidence ?? 0,
    };
  }

  async assessRegret(productName: string, category?: string | null): Promise<RegretAssessment> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du schätzt für ein Konsumprodukt grob ein, wie wahrscheinlich echte Käufer es wieder ' +
          'kaufen würden — basierend auf allgemein bekannten Mustern dieser Produktart, ohne Fakten ' +
          'zu erfinden. Sei vorsichtig: Wenn du nichts Belastbares weißt, setze rebuyProbability auf null. ' +
          '"summary" ist EIN knapper, ehrlicher deutscher Satz. "topConcern" ist der häufigste Vorbehalt ' +
          '(1–3 Wörter) oder null. Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"rebuyProbability": number|null, "topConcern": string|null, "summary": string}.',
      },
      {
        role: 'user',
        content: `Produkt: ${productName}${category ? ` (Kategorie: ${category})` : ''}`,
      },
    ];

    const parsed = regretSchema.safeParse(
      parseJsonObject(await this.client.completeJson(messages, { temperature: 0.3, maxTokens: 220 })),
    );
    if (!parsed.success) return this.fallback.assessRegret(productName, category);

    return {
      rebuyProbability: parsed.data.rebuyProbability ?? null,
      topConcern: parsed.data.topConcern ?? null,
      summary: parsed.data.summary,
    };
  }

  async researchProduct(name: string, categorySlugs: string[]): Promise<ResearchedProduct> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du recherchierst ein Konsumprodukt im Web und lieferst strukturierte, faktische Daten. ' +
          'Findest du das Produkt nicht zweifelsfrei, setze found=false und erfinde nichts. ' +
          `categorySlug MUSS exakt einer aus dieser Liste sein oder null: ${categorySlugs.join(', ')}. ` +
          '"canonicalName" ist der saubere offizielle Produktname (mit Marke), "description" ein ' +
          'sachlicher deutscher Satz. "specs" sind bis zu 8 zentrale technische Fakten als ' +
          '{label,value}-Paare auf Deutsch (z. B. {"label":"Display","value":"6,8\\" OLED"}); nur ' +
          'sichere Fakten, sonst leer. "productUrl" ist die URL der offiziellen Produktseite ' +
          '(Hersteller bevorzugt, sonst großer Händler) — wichtig, bitte angeben wenn bekannt. ' +
          '"imageUrl" ist die direkte URL eines offiziellen Produktfotos, nur wenn du sehr ' +
          'sicher bist, sonst null. Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"canonicalName": string, "brand": string|null, "categorySlug": string|null, ' +
          '"description": string|null, "specs": [{"label":string,"value":string}], ' +
          '"imageUrl": string|null, "productUrl": string|null, "found": boolean}.',
      },
      { role: 'user', content: `Produkt: ${name}` },
    ];

    const grounding = await this.groundedSearch(`${name} Produkt Test technische Daten`);
    const parsed = researchSchema.safeParse(
      parseJsonObject(
        await this.client.completeJson([...grounding.contextMessages, ...messages], {
          temperature: 0.2,
          maxTokens: 600,
          online: grounding.online,
        }),
      ),
    );
    if (!parsed.success) return this.fallback.researchProduct(name, categorySlugs);

    const slug =
      parsed.data.categorySlug && categorySlugs.includes(parsed.data.categorySlug)
        ? parsed.data.categorySlug
        : null;
    return {
      canonicalName: parsed.data.canonicalName,
      brand: parsed.data.brand ?? null,
      categorySlug: slug,
      description: parsed.data.description ?? null,
      specs: parsed.data.specs ?? [],
      imageUrl: parsed.data.imageUrl ?? null,
      productUrl: parsed.data.productUrl ?? null,
      found: parsed.data.found ?? false,
    };
  }

  async suggestProducts(query: string): Promise<SuggestedProductCandidate[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du bist die Produktsuche von Wudly. Der Nutzer sucht ein Konsumprodukt per Freitext. ' +
          'Nenne bis zu 3 real existierende, konkrete Produkte (offizielle Modellnamen mit Marke), ' +
          'die der Nutzer höchstwahrscheinlich meint. WENN dir oben Websuche-Ergebnisse vorliegen, ' +
          'dürfen die Modellnamen NUR aus diesen Ergebnissen stammen — niemals einen Modellnamen ' +
          'erfinden oder kombinieren, der dort nicht wörtlich vorkommt. Taucht in den Ergebnissen ' +
          'kein passendes konkretes Modell auf, liefere eine leere Liste. ' +
          'Keine Erfindungen, keine Zubehörartikel. "ean" (8–14 Ziffern) nur angeben, wenn du die ' +
          'GTIN sicher kennst, sonst null. Findest du nichts Eindeutiges, liefere eine leere Liste. ' +
          'Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"candidates":[{"name":string,"brand":string|null,"ean":string|null}]}.',
      },
      { role: 'user', content: `Suchanfrage: ${query}` },
    ];

    const grounding = await this.groundedSearch(`${query} Modell kaufen Test`, 8);
    // Brave is our web layer but found nothing for this query: don't ask the
    // model to name products from memory — there's no code gate on suggestions,
    // so an invented model name would leak. No web evidence → no suggestions.
    if (this.brave.enabled && !grounding.grounded) return [];

    const parsed = suggestProductsSchema.safeParse(
      parseJsonObject(
        await this.client.completeJson([...grounding.contextMessages, ...messages], {
          temperature: 0.2,
          maxTokens: 400,
          online: grounding.online,
        }),
      ),
    );
    if (!parsed.success) return [];

    return parsed.data.candidates.map((c) => ({
      name: c.name,
      brand: c.brand ?? guessBrand(c.name) ?? null,
      ean: c.ean ?? null,
    }));
  }

  async researchExternalRatings(
    name: string,
    brand: string | null,
  ): Promise<ResearchedExternalRating[]> {
    const label = [brand, name].filter(Boolean).join(' ');
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du recherchierst aggregierte Bewertungs-FAKTEN zu einem Produkt auf großen Plattformen ' +
          '(z. B. Amazon.de, Idealo, MediaMarkt, Otto, Galaxus). Liefere NUR Werte, die du über die ' +
          'Websuche tatsächlich findest — Durchschnittswert, Anzahl der Bewertungen und den Link zur ' +
          'konkreten Produktseite. Niemals Zahlen schätzen oder erfinden; im Zweifel die Plattform ' +
          'weglassen. Keine Review-Texte. kind: STARS (maxValue 5), PERCENT (maxValue 100) oder ' +
          'GRADE_DE (Schulnote, maxValue 6). "source" ist ein kleingeschriebener Schlüssel wie ' +
          '"amazon". Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"ratings":[{"source":string,"sourceLabel":string,"url":string,"kind":"STARS"|"PERCENT"|"GRADE_DE","value":number,"maxValue":number,"count":number|null}]}.',
      },
      { role: 'user', content: `Produkt: ${label}` },
    ];

    const grounding = await this.groundedSearch(`${label} Bewertungen Sterne Test Erfahrungen`, 8);
    const parsed = externalRatingsSchema.safeParse(
      parseJsonObject(
        await this.client.completeJson([...grounding.contextMessages, ...messages], {
          temperature: 0.1,
          maxTokens: 600,
          online: grounding.online,
        }),
      ),
    );
    if (!parsed.success) return [];

    // Plausibility gate — drop anything that doesn't add up instead of trusting it.
    return parsed.data.ratings
      .filter((r) => {
        if (!/^https?:\/\//i.test(r.url)) return false;
        if (r.kind === 'STARS') return r.maxValue === 5 && r.value > 0 && r.value <= 5;
        if (r.kind === 'PERCENT') return r.maxValue === 100 && r.value > 0 && r.value <= 100;
        return r.maxValue === 6 && r.value >= 1 && r.value <= 6;
      })
      .map((r) => ({
        source: r.source.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        sourceLabel: r.sourceLabel,
        url: r.url,
        kind: r.kind,
        value: r.value,
        maxValue: r.maxValue,
        count: r.count ?? null,
      }))
      .filter((r) => r.source.length >= 2);
  }
}

function fallbackOwnerQuestions(productName: string, categoryName: string | null): string[] {
  const category = (categoryName ?? '').toLowerCase();
  const name = productName.trim();

  if (category.includes('waschmaschine')) {
    return [
      'Wie laut ist sie beim Schleudern im Alltag?',
      'Wie gut wäscht sie kurze Programme sauber?',
      'Wie zuverlässig ist sie nach mehreren Monaten?',
      'Wie einfach lassen sich Dichtung und Filter reinigen?',
    ];
  }

  if (category.includes('saugroboter')) {
    return [
      'Wie gut kommt er mit Teppichen und Kanten zurecht?',
      'Wie oft muss man Behälter oder Bürsten reinigen?',
      'Findet er nach längerer Nutzung zuverlässig zur Station?',
      'Wie gut erkennt er Kabel, Socken und kleine Hindernisse?',
    ];
  }

  if (category.includes('wärmepumpe') || category.includes('waermepumpe')) {
    return [
      'Wie stabil läuft sie bei niedrigen Außentemperaturen?',
      'Wie laut ist sie draußen im normalen Betrieb?',
      'Wie hoch ist der Stromverbrauch im Winter?',
      'Wie aufwendig waren Wartung und Service bisher?',
    ];
  }

  if (category.includes('kaffeemaschine')) {
    return [
      'Wie gut schmeckt Kaffee nach mehreren Monaten Nutzung?',
      'Wie oft muss man reinigen oder entkalken?',
      'Wie laut ist Mahlwerk oder Pumpe morgens?',
      'Gab es Probleme mit Brüheinheit oder Milchsystem?',
    ];
  }

  return [
    `Was nervt dich im Alltag an ${name}?`,
    'Wie zuverlässig ist es nach mehreren Monaten?',
    'Wie gut funktioniert es im Vergleich zur Erwartung?',
    'Würdest du es zum heutigen Preis wieder kaufen?',
  ];
}
