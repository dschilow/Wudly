/**
 * AI service contract (provider-agnostic).
 *
 * The backend's AiModule implements this with a DummyAiService for the MVP and,
 * later, real adapters (OpenAI / Gemini / Anthropic / local). Defining the
 * interface in `@wudly/shared` keeps business logic free of any provider import.
 */

import type { AspectSentiment } from './enums';

export interface ProductInput {
  rawName: string;
  brandHint?: string;
  categoryHint?: string;
}

export interface ProductCandidate {
  canonicalName: string;
  brand?: string;
  categorySlug?: string;
  confidence: number;
}

export interface NormalizedExperience {
  positiveAspects: Array<{ key: string; label: string; sentiment: AspectSentiment }>;
  negativeAspects: Array<{ key: string; label: string; sentiment: AspectSentiment }>;
  summary?: string;
}

export interface ProductInsightSummary {
  productId: string;
  headline: string;
  strengths: string[];
  weaknesses: string[];
  suitedFor: string[];
  notSuitedFor: string[];
}

export interface AiService {
  summarizeProductInsights(productId: string): Promise<ProductInsightSummary>;
  extractProductCandidate(input: ProductInput): Promise<ProductCandidate>;
  normalizeExperienceText(text: string): Promise<NormalizedExperience>;
}

/** DI token string for the AiService binding in the backend. */
export const AI_SERVICE = 'AI_SERVICE';
