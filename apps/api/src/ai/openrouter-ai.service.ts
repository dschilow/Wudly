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
  type ResearchedExternalConsensus,
  type ResearchedExternalRating,
  type GeneratedPrompt,
  AspectSentiment,
  guessBrand,
  EXPERIENCE_MOOD_LABEL,
  USAGE_DURATION_LABEL,
  WOULD_BUY_AGAIN_LABEL,
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

const promptsSchema = z.object({
  prompts: z
    .array(
      z.object({
        question: z.string().trim().min(5).max(120),
        quickAnswers: z.array(z.string().trim().min(1).max(40)).max(4).optional().default([]),
      }),
    )
    .max(8)
    .optional()
    .default([]),
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
    .min(1)
    .max(3),
});

const externalThemeSchema = z.union([
  z.object({
    label: z.string().trim().min(4).max(100),
    sourceUrls: z.array(z.string().trim().url().max(600)).min(2).max(4),
  }),
  // Some otherwise valid provider responses flatten themes to strings. Keep
  // them only when the top-level response supplies at least two independent
  // review sources; the normalization gate below attaches those sources.
  z.string().trim().min(4).max(100),
]);

const externalConsensusSchema = z.object({
  ratings: z
    .array(
      z.object({
        source: z.string().trim().min(2).max(120),
        sourceLabel: z.string().trim().min(2).max(120),
        url: z.string().trim().url().max(600),
        kind: z.enum(['STARS', 'PERCENT', 'GRADE_DE']),
        value: z.number(),
        maxValue: z.number(),
        count: z.number().int().positive().nullable().optional(),
      }),
    )
    .max(4)
    .default([]),
  summary: z.string().trim().min(20).max(600).nullable().optional(),
  positiveThemes: z.array(externalThemeSchema).max(5).default([]),
  negativeThemes: z.array(externalThemeSchema).max(5).default([]),
  sourceUrls: z.array(z.string().trim().url().max(600)).min(1).max(12),
});
const externalRatingsSchema = z.object({ ratings: externalConsensusSchema.shape.ratings });

const researchProductShape = z.object({
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
const researchSchema = researchProductShape.refine((product) => product.found, {
  message: 'product not verified',
});

/**
 * Combined add-flow research: product data + rating consensus from ONE search.
 * Both halves are tolerant so a weak half never voids the strong one — an
 * unverified product still lets the consensus through, and an empty consensus
 * (product data found, no independent reviews) still lets the product through.
 */
/** Consensus schema without the strict sourceUrls minimum — for the combined
    add-flow search, where product data may exist without independent reviews. */
const tolerantConsensusSchema = externalConsensusSchema.extend({
  sourceUrls: z.array(z.string().trim().url().max(600)).max(12).default([]),
});

const combinedResearchSchema = z.object({
  product: researchProductShape,
  consensus: tolerantConsensusSchema,
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
    private readonly researchSearchProvider: 'brave' | 'openrouter' = 'brave',
  ) {}

  /**
   * Cost gate for web research: try the configured primary retrieval path once,
   * validate strict JSON, and pay for the secondary path only when the first one
   * fails. This avoids the former A/B behaviour in normal production traffic.
   */
  private async completeResearch<T>(
    query: string,
    count: number,
    messages: ChatMessage[],
    schema: z.ZodType<T>,
    opts: { temperature: number; maxTokens: number },
  ): Promise<T | null> {
    const parse = async (input: ChatMessage[], online: boolean): Promise<T | null> => {
      const raw = await this.client.completeJson(input, { ...opts, online, timeoutMs: 35_000 });
      const result = schema.safeParse(parseJsonObject(raw));
      if (!result.success) {
        const issues = result.error.issues
          .slice(0, 4)
          .map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`)
          .join('; ');
        this.logger.warn(`Research response validation failed: ${issues}`);
      }
      return result.success ? result.data : null;
    };

    if (this.researchSearchProvider === 'openrouter') {
      const primary = await parse(messages, true);
      if (primary) return primary;
      if (!this.brave.enabled) return null;
      const context = await this.brave.context(query, count);
      return context ? parse([braveContext(context), ...messages], false) : null;
    }

    if (this.brave.enabled) {
      const context = await this.brave.context(query, count);
      if (context) {
        const primary = await parse([braveContext(context), ...messages], false);
        if (primary) return primary;
      }
    }
    return parse(messages, true);
  }

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

  async generateProductPrompts(productId: string): Promise<GeneratedPrompt[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product) return this.fallback.generateProductPrompts(productId);

    // Give the model some context: known weak points so prompts target what
    // buyers actually worry about.
    const snapshot = await this.prisma.productInsightSnapshot.findUnique({
      where: { productId },
    });
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
          'Du erstellst die produktspezifischen Besitzer-Fragen für Wudly. Echte Besitzer sollen ' +
          'sie in Sekunden beantworten können, Kaufinteressenten sollen sie stellen wollen. Erzeuge ' +
          '5 kurze, konkrete, alltagsnahe Fragen auf Deutsch (max 80 Zeichen). Gib zu JEDER Frage ' +
          '2–4 sehr kurze, sich gegenseitig ausschließende Antwortmöglichkeiten (je max 22 Zeichen, ' +
          'z. B. ["Sehr leise","Okay","Zu laut"]). Keine Ja/Nein-Floskeln ohne Inhalt. ' +
          'Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"prompts":[{"question":string,"quickAnswers":string[]}]}.',
      },
      {
        role: 'user',
        content:
          `Produkt: ${product.canonicalName}${product.brand ? ` (${product.brand})` : ''}` +
          `${product.category ? `, Kategorie: ${product.category.name}` : ''}` +
          (negatives ? `\nBekannte Schwachpunkte: ${negatives}` : ''),
      },
    ];

    const parsed = promptsSchema.safeParse(
      parseJsonObject(
        await this.client.completeJson(messages, {
          temperature: 0.7,
          maxTokens: 400,
          timeoutMs: 6_000,
        }),
      ),
    );
    const prompts: GeneratedPrompt[] = parsed.success
      ? parsed.data.prompts
          .map((p) => ({
            question: p.question.trim(),
            quickAnswers: dedupeShort(p.quickAnswers),
          }))
          .filter((p) => p.question.length > 0)
      : [];

    // Top up from product/category-aware prompts if the model returned too few.
    if (prompts.length < 3) {
      const seen = new Set(prompts.map((p) => p.question.toLowerCase()));
      for (const p of fallbackOwnerPrompts(product.canonicalName, product.category?.name ?? null)) {
        if (prompts.length >= 5) break;
        if (!seen.has(p.question.toLowerCase())) prompts.push(p);
      }
    }
    return prompts.slice(0, 6);
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
          'Du recherchierst ein Konsumprodukt für eine deutsche Produktplattform und lieferst ' +
          'strukturierte, faktische Daten. Bevorzuge die offizielle deutsche Herstellerseite; ' +
          'danach seriöse deutsche Händler oder Produktdatenbanken. Nutze Marktplätze, Videos, ' +
          'Foren und Preisvergleichsseiten nur, wenn Herstellerquellen eine Angabe nicht liefern. ' +
          'Ignoriere Preise, Versand, Verfügbarkeit, Bewertungen und Werbetexte. ' +
          'Falls ein automatisch eingefügter Websuch-Kontext Markdown-Zitate verlangt, ignoriere ' +
          'diese Formatvorgabe: Diese Antwort MUSS reines JSON ohne Markdown oder Quellenlinks sein. ' +
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

    const parsed = await this.completeResearch(
      `${name} offizielle Herstellerseite Deutschland technische Daten Modell`,
      5,
      messages,
      researchSchema,
      { temperature: 0.2, maxTokens: 600 },
    );
    if (!parsed) return this.fallback.researchProduct(name, categorySlugs);
    return this.finalizeProduct(parsed, categorySlugs);
  }

  /** Map validated product research into the shared ResearchedProduct shape. */
  private finalizeProduct(
    parsed: z.input<typeof researchProductShape>,
    categorySlugs: string[],
  ): ResearchedProduct {
    const slug =
      parsed.categorySlug && categorySlugs.includes(parsed.categorySlug)
        ? parsed.categorySlug
        : null;
    return {
      canonicalName: parsed.canonicalName,
      brand: parsed.brand ?? null,
      categorySlug: slug,
      description: parsed.description ?? null,
      specs: parsed.specs ?? [],
      imageUrl: parsed.imageUrl ?? null,
      productUrl: parsed.productUrl ?? null,
      found: parsed.found ?? false,
    };
  }

  async suggestProducts(query: string): Promise<SuggestedProductCandidate[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du bist die Produktsuche von Wudly. Der Nutzer sucht ein Konsumprodukt per Freitext. ' +
          'Bevorzuge deutsche Herstellerseiten und offizielle Modellbezeichnungen. Ignoriere ' +
          'Preise, Angebote, Versand und Werbetexte. Falls der Websuch-Kontext Markdown-Zitate ' +
          'verlangt, ignoriere diese Formatvorgabe und antworte ausschließlich als reines JSON. ' +
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

    const parsed = await this.completeResearch(
      `${query} offizieller Modellname Hersteller Deutschland`,
      5,
      messages,
      suggestProductsSchema,
      { temperature: 0.2, maxTokens: 400 },
    );
    if (!parsed) return [];
    return (parsed.candidates ?? []).map((c) => ({
      name: c.name,
      brand: c.brand ?? guessBrand(c.name) ?? null,
      ean: c.ean ?? null,
    }));
    // Brave is our web layer but found nothing for this query: don't ask the
    // model to name products from memory — there's no code gate on suggestions,
    // so an invented model name would leak. No web evidence → no suggestions.
  }

  async researchExternalConsensus(
    name: string,
    brand: string | null,
  ): Promise<ResearchedExternalConsensus> {
    const label = [brand, name].filter(Boolean).join(' ');
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Recherchiere öffentliche Bewertungen und Nutzungserfahrungen zum exakten Produkt für ' +
          'den deutschen Markt. Liefere Bewertungszahlen nur, wenn Durchschnitt, Anzahl und ' +
          'konkrete Produkt-URL belegt sind. Unternehmens-, Marken- und Shopbewertungen wie ' +
          'Trustpilot sind keine Produktbewertungen und MÜSSEN weggelassen werden. ' +
          'sourceUrls darf nur konkrete Produkt-Tests, Produktbewertungen oder Erfahrungsseiten ' +
          'enthalten, keine Hersteller- oder allgemeinen Kategorieseiten. ' +
          'Fasse die belastbare Review-Lage in summary in zwei bis drei neutralen deutschen ' +
          'Sätzen zusammen: wichtigste Stärke, wichtigster Kritikpunkt und Einordnung der ' +
          'Quellenlage. Nenne keine unbelegten Details. ' +
          'Erfahrungsthemen müssen wiederkehrend sein und jeweils ' +
          'mindestens zwei unterschiedliche Quellseiten nennen. Kopiere keine Rezensionstexte. ' +
          'Ignoriere automatisch verlangte Markdown-Zitate und antworte nur als JSON: ' +
          '{"ratings":[{"source":string,"sourceLabel":string,"url":string,"kind":"STARS"|"PERCENT"|"GRADE_DE","value":number,"maxValue":number,"count":number|null}],"summary":string|null,"positiveThemes":[{"label":string,"sourceUrls":[string,string]}],"negativeThemes":[{"label":string,"sourceUrls":[string,string]}],"sourceUrls":[string]}.',
      },
      { role: 'user', content: `Produkt: ${label}` },
    ];
    const parsed = await this.completeResearch(
      `${label} Bewertungen Erfahrungen Langzeittest Deutschland Amazon Idealo MediaMarkt Otto Galaxus Reddit Forum`,
      5,
      messages,
      externalConsensusSchema,
      { temperature: 0.1, maxTokens: 900 },
    );
    if (!parsed) {
      return { ratings: [], summary: null, positiveThemes: [], negativeThemes: [], sourceUrls: [] };
    }
    return this.finalizeConsensus(parsed, brand);
  }

  /**
   * Map + sanitize validated consensus research into the shared shape: clean the
   * rating facts, dedupe + domain-filter the sources (no blocked review farms, no
   * brand-owned pages), and keep only recurring themes with ≥2 independent
   * sources. Shared by the separate call and the combined add-flow research.
   */
  private finalizeConsensus(
    parsed: z.input<typeof tolerantConsensusSchema>,
    brand: string | null,
  ): ResearchedExternalConsensus {
    const ratings = this.cleanExternalRatings(parsed.ratings ?? []);
    const sourceUrls = uniqueUrls([
      ...(parsed.sourceUrls ?? []),
      ...(parsed.ratings ?? []).map((rating) => rating.url),
      ...(parsed.positiveThemes ?? []).flatMap((theme) =>
        typeof theme === 'string' ? [] : theme.sourceUrls,
      ),
      ...(parsed.negativeThemes ?? []).flatMap((theme) =>
        typeof theme === 'string' ? [] : theme.sourceUrls,
      ),
    ])
      .filter((url) => !isBlockedReviewDomain(url))
      .filter((url) => !isBrandOwnedDomain(url, brand));
    const sourceSet = new Set(sourceUrls);
    const independentReviewUrls = sourceUrls.filter((url) => !isCommerceDomain(url));
    const cleanThemes = (themes: typeof parsed.positiveThemes) =>
      (themes ?? [])
        .map((theme) =>
          typeof theme === 'string'
            ? { label: theme, sourceUrls: independentReviewUrls.slice(0, 4) }
            : { label: theme.label, sourceUrls: uniqueUrls(theme.sourceUrls) },
        )
        .filter((theme) => hasIndependentSources(theme.sourceUrls, 2))
        .filter((theme) => theme.sourceUrls.every((url) => sourceSet.has(url)));
    return {
      ratings,
      summary: sourceUrls.length >= 1 ? (parsed.summary ?? null) : null,
      positiveThemes: cleanThemes(parsed.positiveThemes),
      negativeThemes: cleanThemes(parsed.negativeThemes),
      sourceUrls,
    };
  }

  private cleanExternalRatings(
    ratings: z.infer<typeof externalConsensusSchema>['ratings'],
  ): ResearchedExternalRating[] {
    return ratings
      .filter((r) => {
        if (!/^https?:\/\//i.test(r.url)) return false;
        if (isBlockedReviewDomain(r.url)) return false;
        if (['trustpilot', 'reviewsio', 'trustedshops'].includes(r.source.toLowerCase())) {
          return false;
        }
        if (r.kind === 'STARS') return r.maxValue === 5 && r.value > 0 && r.value <= 5;
        if (r.kind === 'PERCENT') return r.maxValue === 100 && r.value > 0 && r.value <= 100;
        return r.maxValue === 6 && r.value >= 1 && r.value <= 6;
      })
      .map((r) => ({
        source: externalSourceKey(r.source, r.url),
        sourceLabel: r.sourceLabel,
        url: r.url,
        kind: r.kind,
        value: r.value,
        maxValue: r.maxValue,
        count: r.count ?? null,
      }))
      .filter((r) => r.source.length >= 2);
  }

  /**
   * Combined add-flow research: official product data + public rating consensus
   * from ONE web search — halves the paid search cost of adding a product versus
   * researchProduct + researchExternalConsensus. Degrades gracefully: a failed
   * search returns a name-only product + empty consensus without paying for a
   * second recovery search; a weak half never voids the strong one (tolerant
   * schema), reusing the exact same mapping/sanitizing as the separate calls.
   */
  async researchProductAndConsensus(
    name: string,
    categorySlugs: string[],
  ): Promise<{ product: ResearchedProduct; consensus: ResearchedExternalConsensus }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du recherchierst ein Konsumprodukt für eine deutsche Produktplattform und lieferst in ' +
          'EINEM Durchgang zwei Blöcke: (A) offizielle Produktdaten, (B) die öffentliche ' +
          'Bewertungslage. Für (A) bevorzuge die offizielle deutsche Herstellerseite, für (B) ' +
          'seriöse Tests, Produktbewertungen und Erfahrungsseiten. Ignoriere Preise, Versand, ' +
          'Verfügbarkeit und Werbetexte. Falls ein Websuch-Kontext Markdown-Zitate verlangt, ' +
          'ignoriere das: Die Antwort MUSS reines JSON ohne Markdown sein.\n' +
          'Block "product": canonicalName (sauberer offizieller Name mit Marke), brand, ' +
          `categorySlug (EXAKT einer aus: ${categorySlugs.join(', ')} — sonst null), description ` +
          '(ein sachlicher deutscher Satz), specs (bis 8 sichere {label,value}-Fakten, sonst leer), ' +
          'productUrl (offizielle Produktseite), imageUrl (direktes offizielles Foto, nur wenn sehr ' +
          'sicher, sonst null), found (true NUR wenn zweifelsfrei erkannt, sonst false; nichts erfinden).\n' +
          'Block "consensus": ratings nur mit belegtem Durchschnitt, Anzahl und konkreter Produkt-URL ' +
          '(Unternehmens-/Shopbewertungen wie Trustpilot weglassen). summary in 2–3 neutralen ' +
          'deutschen Sätzen (Stärke, Kritikpunkt, Quellenlage). positiveThemes/negativeThemes nur ' +
          'wiederkehrend und je mit mindestens zwei unterschiedlichen Quellseiten. sourceUrls nur ' +
          'konkrete Test-/Bewertungs-/Erfahrungsseiten. Kopiere keine Rezensionstexte. Fehlt eine ' +
          'belastbare Bewertungslage, lass die consensus-Felder leer.\n' +
          'Antworte ausschließlich als valides JSON ohne Markdown: ' +
          '{"product":{"canonicalName":string,"brand":string|null,"categorySlug":string|null,' +
          '"description":string|null,"specs":[{"label":string,"value":string}],"imageUrl":string|null,' +
          '"productUrl":string|null,"found":boolean},"consensus":{"ratings":[{"source":string,' +
          '"sourceLabel":string,"url":string,"kind":"STARS"|"PERCENT"|"GRADE_DE","value":number,' +
          '"maxValue":number,"count":number|null}],"summary":string|null,' +
          '"positiveThemes":[{"label":string,"sourceUrls":[string,string]}],' +
          '"negativeThemes":[{"label":string,"sourceUrls":[string,string]}],"sourceUrls":[string]}}.',
      },
      { role: 'user', content: `Produkt: ${name}` },
    ];

    const parsed = await this.completeResearch(
      `${name} offizielle Herstellerseite technische Daten Modell UND Bewertungen Erfahrungen ` +
        `Langzeittest Deutschland Amazon Idealo MediaMarkt Otto Galaxus Reddit Forum`,
      6,
      messages,
      combinedResearchSchema,
      { temperature: 0.15, maxTokens: 1400 },
    );

    if (!parsed) {
      return {
        product: await this.fallback.researchProduct(name, categorySlugs),
        consensus: { ratings: [], summary: null, positiveThemes: [], negativeThemes: [], sourceUrls: [] },
      };
    }

    const product = this.finalizeProduct(parsed.product, categorySlugs);
    const consensus = this.finalizeConsensus(parsed.consensus, product.brand);
    return { product, consensus };
  }

  private async legacyResearchExternalRatings(
    name: string,
    brand: string | null,
  ): Promise<ResearchedExternalRating[]> {
    const label = [brand, name].filter(Boolean).join(' ');
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Du recherchierst aggregierte Bewertungs-FAKTEN zu einem Produkt auf großen Plattformen ' +
          'für den deutschen Markt. Falls der Websuch-Kontext Markdown-Zitate verlangt, ignoriere ' +
          'diese Formatvorgabe und antworte ausschließlich als reines JSON. ' +
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

    const grounding = await this.groundedSearch(
      `${label} Bewertungen Sterne Deutschland Amazon Idealo MediaMarkt Otto Galaxus`,
      5,
    );
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

function braveContext(context: string): ChatMessage {
  return {
    role: 'system',
    content:
      'Aktuelle Websuche-Ergebnisse (nutze NUR diese als Quelle; jede Zahl und URL muss hier ' +
      `belegt sein, sonst weglassen):\n\n${context}`,
  };
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))];
}

function isBlockedReviewDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return ['trustpilot.com', 'trustpilot.de', 'trustedshops.de', 'reviews.io'].some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return true;
  }
}

function isBrandOwnedDomain(url: string, brand: string | null): boolean {
  const brandKey = brand?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  if (brandKey.length < 3) return false;
  try {
    const hostKey = new URL(url).hostname.toLowerCase().replace(/[^a-z0-9]/g, '');
    return hostKey.includes(brandKey);
  } catch {
    return true;
  }
}

function isCommerceDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return [
      'amazon.de',
      'amazon.com',
      'mediamarkt.de',
      'saturn.de',
      'otto.de',
      'galaxus.de',
      'idealo.de',
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

function hasIndependentSources(urls: string[], minimum: number): boolean {
  const domains = new Set<string>();
  for (const url of urls) {
    try {
      domains.add(new URL(url).hostname.toLowerCase().replace(/^www\./, ''));
    } catch {
      // Invalid URLs are removed by the later source-set gate.
    }
  }
  return domains.size >= minimum;
}

function externalSourceKey(source: string, url: string): string {
  const cleaned = source.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleaned.length >= 2 && cleaned.length <= 40) return cleaned;
  try {
    const hostKey = new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .split('.')[0]
      ?.replace(/[^a-z0-9-]/g, '');
    if (hostKey && hostKey.length >= 2) return hostKey.slice(0, 40);
  } catch {
    // Fall through to a bounded version of the supplied source name.
  }
  return cleaned.slice(0, 40);
}

/** Trim, drop blanks, dedupe (case-insensitive), cap at 4 — for quick answers. */
function dedupeShort(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 4) break;
  }
  return out;
}

/** Category-aware fallback prompts (question + quick answers) when the model is
    slow or returns too few. Mirrors the generated shape so storage is uniform. */
function fallbackOwnerPrompts(productName: string, categoryName: string | null): GeneratedPrompt[] {
  const category = (categoryName ?? '').toLowerCase();
  const name = productName.trim();

  if (category.includes('waschmaschine')) {
    return [
      { question: 'Wie laut ist sie beim Schleudern?', quickAnswers: ['Leise', 'Okay', 'Zu laut'] },
      {
        question: 'Wie zuverlässig ist sie nach Monaten?',
        quickAnswers: ['Top', 'Okay', 'Probleme'],
      },
      {
        question: 'Wie gut reinigt sie kurze Programme?',
        quickAnswers: ['Sehr gut', 'Okay', 'Schwach'],
      },
    ];
  }

  if (category.includes('saugroboter')) {
    return [
      {
        question: 'Wie gut kommt er mit Teppichen klar?',
        quickAnswers: ['Sehr gut', 'Okay', 'Schwach'],
      },
      { question: 'Findet er zuverlässig zur Station?', quickAnswers: ['Immer', 'Meist', 'Selten'] },
      {
        question: 'Wie oft muss man ihn reinigen?',
        quickAnswers: ['Selten', 'Normal', 'Oft'],
      },
    ];
  }

  if (category.includes('kaffeemaschine')) {
    return [
      { question: 'Wie laut ist Mahlwerk/Pumpe?', quickAnswers: ['Leise', 'Okay', 'Laut'] },
      {
        question: 'Wie oft muss man entkalken/reinigen?',
        quickAnswers: ['Selten', 'Normal', 'Oft'],
      },
      { question: 'Gab es Defekte an der Brüheinheit?', quickAnswers: ['Nein', 'Kleine', 'Ja'] },
    ];
  }

  return [
    { question: `Was nervt im Alltag an ${name}?`.slice(0, 80), quickAnswers: [] },
    {
      question: 'Wie zuverlässig ist es nach Monaten?',
      quickAnswers: ['Top', 'Okay', 'Probleme'],
    },
    {
      question: 'Hält es, was du erwartet hast?',
      quickAnswers: ['Übertrifft', 'Passt', 'Enttäuscht'],
    },
    {
      question: 'Wieder kaufen zum heutigen Preis?',
      quickAnswers: ['Ja', 'Unsicher', 'Nein'],
    },
  ];
}
