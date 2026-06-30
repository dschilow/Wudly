import { Injectable } from '@nestjs/common';
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
  type GeneratedPrompt,
  normalizeProductName,
  guessBrand,
  AspectSentiment,
  COMMON_QUESTIONS,
} from '@wudly/shared';

/**
 * Deterministic, dependency-free Ai implementation for the MVP.
 *
 * It produces plausible, rule-based output so the rest of the system can depend
 * on the {@link AiService} contract today. Swapping in a real provider later
 * means only changing the binding in {@link AiModule} — no call-site changes.
 */
@Injectable()
export class DummyAiService implements AiService {
  async extractProductCandidate(input: ProductInput): Promise<ProductCandidate> {
    const canonicalName = input.rawName.trim();
    const brand = input.brandHint ?? guessBrand(canonicalName);
    return {
      canonicalName,
      brand,
      categorySlug: input.categoryHint,
      // High-ish confidence when we recognized a brand, lower otherwise.
      confidence: brand ? 0.7 : 0.4,
    };
  }

  async normalizeExperienceText(text: string): Promise<NormalizedExperience> {
    // Extremely naive keyword extraction — just enough to be useful in the MVP.
    const lower = normalizeProductName(text);
    const positive: NormalizedExperience['positiveAspects'] = [];
    const negative: NormalizedExperience['negativeAspects'] = [];

    const positiveHints = ['gut', 'top', 'leise', 'stark', 'schnell', 'empfehlen'];
    const negativeHints = ['laut', 'defekt', 'kaputt', 'langsam', 'teuer', 'nervt'];

    for (const hint of positiveHints) {
      if (lower.includes(hint)) {
        positive.push({ key: hint, label: hint, sentiment: AspectSentiment.POSITIVE });
      }
    }
    for (const hint of negativeHints) {
      if (lower.includes(hint)) {
        negative.push({ key: hint, label: hint, sentiment: AspectSentiment.NEGATIVE });
      }
    }

    return {
      positiveAspects: positive,
      negativeAspects: negative,
      summary: text.length > 140 ? `${text.slice(0, 137)}…` : text,
    };
  }

  async summarizeProductInsights(productId: string): Promise<ProductInsightSummary> {
    // The dummy provider has no real model, so it returns an EMPTY headline. The
    // insights service treats an empty headline as "no AI summary" and keeps using
    // the deterministic rule-based audience hints instead of persisting a placeholder.
    return {
      productId,
      headline: '',
      strengths: [],
      weaknesses: [],
      suitedFor: [],
      notSuitedFor: [],
    };
  }

  async generateProductPrompts(_productId: string): Promise<GeneratedPrompt[]> {
    // No model → curated common questions as open prompts (no quick answers).
    return [...COMMON_QUESTIONS].slice(0, 5).map((question) => ({ question, quickAnswers: [] }));
  }

  async identifyProductFromImage(_imageDataUrl: string): Promise<IdentifiedProduct> {
    // No vision model in the deterministic provider — signal "not recognized" so the
    // client falls back to manual search instead of inventing a product.
    return { brand: null, product: null, category: null, confidence: 0 };
  }

  async assessRegret(_productName: string, _category?: string | null): Promise<RegretAssessment> {
    // No model → no estimate; caller falls back to an honest "no data" message.
    return { rebuyProbability: null, topConcern: null, summary: '' };
  }

  async researchProduct(name: string, _categorySlugs: string[]): Promise<ResearchedProduct> {
    // No web access — just clean the name; caller still creates the product.
    const canonicalName = name.trim();
    return {
      canonicalName,
      brand: guessBrand(canonicalName) ?? null,
      categorySlug: null,
      description: null,
      found: false,
    };
  }

  async suggestProducts(_query: string): Promise<SuggestedProductCandidate[]> {
    // No model → no candidates; the search UI falls back to manual create.
    return [];
  }

  async researchExternalConsensus(
    _name: string,
    _brand: string | null,
  ): Promise<ResearchedExternalConsensus> {
    // No web access → never invent rating facts.
    return { ratings: [], summary: null, positiveThemes: [], negativeThemes: [], sourceUrls: [] };
  }
}
