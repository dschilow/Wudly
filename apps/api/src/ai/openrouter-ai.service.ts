import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  type AiService,
  type ProductInput,
  type ProductCandidate,
  type NormalizedExperience,
  type ProductInsightSummary,
  AspectSentiment,
  guessBrand,
  EXPERIENCE_MOOD_LABEL,
  USAGE_DURATION_LABEL,
  WOULD_BUY_AGAIN_LABEL,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DummyAiService } from './dummy-ai.service';
import { OpenRouterClient, parseJsonObject, type ChatMessage } from './openrouter.client';

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
    private readonly client: OpenRouterClient,
    private readonly fallback: DummyAiService,
    private readonly prisma: PrismaService,
  ) {}

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
}
