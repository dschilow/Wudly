import { Injectable } from '@nestjs/common';
import {
  type AiService,
  type ProductInput,
  type ProductCandidate,
  type NormalizedExperience,
  type ProductInsightSummary,
  normalizeProductName,
  guessBrand,
  AspectSentiment,
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
    // The real summary is computed deterministically in ProductInsightsService;
    // this stub returns an empty scaffold so the contract is satisfiable.
    return {
      productId,
      headline: 'Zusammenfassung folgt, sobald genügend Erfahrungen vorliegen.',
      strengths: [],
      weaknesses: [],
      suitedFor: [],
      notSuitedFor: [],
    };
  }
}
