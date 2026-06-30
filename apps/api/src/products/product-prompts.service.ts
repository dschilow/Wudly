import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AI_SERVICE,
  type AiService,
  type ProductPromptDto,
  type ProductPromptAnswerStatDto,
  type PromptResponseInput,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';

const MAX_PROMPTS = 6;
const MAX_QUICK_ANSWERS = 8;

/** Coerce a JSON `quickAnswers` column back into a string array. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/** Trim, drop blanks, dedupe (case-insensitive). */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

const msg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * The product-specific question pool. Generated ONCE per product (AI), stored,
 * then reused everywhere: the owner answers prompts fast in the "Ich besitze es"
 * wizard, a buyer picks them as ask-suggestions, and the product page shows the
 * aggregated owner answers. Strictly product knowledge — never the Wudly Signal.
 */
@Injectable()
export class ProductPromptsService {
  private readonly logger = new Logger(ProductPromptsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AI_SERVICE) private readonly ai: AiService,
  ) {}

  /**
   * The pool with aggregated owner answers, most-answered first. Lazily generates
   * + stores the pool on first access for products that never had one (so older
   * catalog entries get a pool the moment someone opens them).
   */
  async listForProduct(productId: string): Promise<ProductPromptDto[]> {
    await this.ensureForProduct(productId);
    const prompts = await this.prisma.productPrompt.findMany({
      where: { productId, status: 'ACTIVE' },
      orderBy: [{ responseCount: 'desc' }, { sortOrder: 'asc' }],
    });
    if (prompts.length === 0) return [];

    const grouped = await this.prisma.productPromptResponse.groupBy({
      by: ['promptId', 'answerLabel'],
      where: { promptId: { in: prompts.map((p) => p.id) } },
      _count: { _all: true },
    });
    const statsByPrompt = new Map<string, ProductPromptAnswerStatDto[]>();
    for (const row of grouped) {
      const list = statsByPrompt.get(row.promptId) ?? [];
      list.push({ label: row.answerLabel, count: row._count._all });
      statsByPrompt.set(row.promptId, list);
    }
    for (const list of statsByPrompt.values()) list.sort((a, b) => b.count - a.count);

    return prompts.map((p) => ({
      id: p.id,
      questionText: p.questionText,
      quickAnswers: asStringArray(p.quickAnswers),
      source: p.source,
      responseCount: p.responseCount,
      answerStats: statsByPrompt.get(p.id) ?? [],
    }));
  }

  /** Fire-and-forget pool generation right after a product is created. */
  generateInBackground(productId: string): void {
    void this.ensureForProduct(productId).catch((err) =>
      this.logger.warn(`Prompt generation failed for ${productId}: ${msg(err)}`),
    );
  }

  /**
   * One-time generation guarded by `promptsGeneratedAt`. Idempotent and race-safe:
   * the AI runs first (it has deterministic fallbacks, so it practically never
   * returns empty), then an atomic conditional update claims the product so two
   * concurrent callers can never double-insert the pool.
   */
  async ensureForProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, promptsGeneratedAt: true, status: true },
    });
    if (!product || product.promptsGeneratedAt) return;
    if (product.status === 'HIDDEN' || product.status === 'MERGED') return;

    let generated;
    try {
      generated = await this.ai.generateProductPrompts(productId);
    } catch (err) {
      this.logger.warn(`generateProductPrompts failed for ${productId}: ${msg(err)}`);
      return;
    }
    const clean = generated
      .map((g) => ({
        question: g.question.trim(),
        quickAnswers: dedupe(g.quickAnswers).slice(0, 4),
      }))
      .filter((g) => g.question.length >= 4)
      .slice(0, MAX_PROMPTS);
    // Don't burn the gate on an empty result — let a later call try again.
    if (clean.length === 0) return;

    // Claim atomically: only the caller that flips the null gate inserts the pool.
    const claim = await this.prisma.product.updateMany({
      where: { id: productId, promptsGeneratedAt: null },
      data: { promptsGeneratedAt: new Date() },
    });
    if (claim.count === 0) return;

    await this.prisma.productPrompt.createMany({
      data: clean.map((g, i) => ({
        productId,
        questionText: g.question,
        quickAnswers: g.quickAnswers as unknown as Prisma.InputJsonValue,
        source: 'ai',
        sortOrder: i,
      })),
    });
    this.logger.log(`Generated ${clean.length} prompts for ${productId}`);
  }

  /**
   * Persist owner answers to the prompt pool, captured in the "Ich besitze es"
   * wizard. Deduped per (prompt, user); a typed-in custom answer is also appended
   * to the prompt's quick answers so the pool learns over time. Bumps
   * `responseCount` for genuinely new answers. Best-effort — never fatal.
   */
  async recordResponses(
    productId: string,
    userId: string,
    experienceReportId: string | null,
    responses: PromptResponseInput[],
  ): Promise<void> {
    if (responses.length === 0) return;
    // Only accept responses to real ACTIVE prompts of THIS product.
    const prompts = await this.prisma.productPrompt.findMany({
      where: { productId, status: 'ACTIVE', id: { in: responses.map((r) => r.promptId) } },
    });
    const byId = new Map(prompts.map((p) => [p.id, p]));

    for (const r of responses) {
      const prompt = byId.get(r.promptId);
      if (!prompt) continue;
      const label = r.answerLabel.trim().slice(0, 120);
      if (!label) continue;
      try {
        const existing = await this.prisma.productPromptResponse.findUnique({
          where: { promptId_userId: { promptId: r.promptId, userId } },
          select: { id: true },
        });
        await this.prisma.productPromptResponse.upsert({
          where: { promptId_userId: { promptId: r.promptId, userId } },
          create: {
            promptId: r.promptId,
            productId,
            userId,
            experienceReportId,
            answerLabel: label,
            isCustom: r.isCustom ?? false,
          },
          update: { answerLabel: label, isCustom: r.isCustom ?? false, experienceReportId },
        });
        // Only count truly new answers (re-answering just updates the label).
        if (!existing) {
          await this.prisma.productPrompt.update({
            where: { id: r.promptId },
            data: { responseCount: { increment: 1 } },
          });
        }
        // The pool learns: a novel custom answer becomes a future quick answer.
        if (r.isCustom) {
          const current = asStringArray(prompt.quickAnswers);
          const known = current.some((a) => a.toLowerCase() === label.toLowerCase());
          if (!known && current.length < MAX_QUICK_ANSWERS) {
            await this.prisma.productPrompt.update({
              where: { id: r.promptId },
              data: { quickAnswers: [...current, label] as unknown as Prisma.InputJsonValue },
            });
          }
        }
      } catch (err) {
        this.logger.warn(`recordResponse failed for prompt ${r.promptId}: ${msg(err)}`);
      }
    }
  }
}
