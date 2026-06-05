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

/**
 * Result of recognizing a product from a photo (camera scan, KI fallback when no
 * barcode is found). The model returns only these fields as strict JSON.
 */
export interface IdentifiedProduct {
  brand: string | null;
  product: string | null;
  category: string | null;
  /** Model self-reported confidence, 0..1. 0 means "not recognized". */
  confidence: number;
}

export interface AiService {
  summarizeProductInsights(productId: string): Promise<ProductInsightSummary>;
  extractProductCandidate(input: ProductInput): Promise<ProductCandidate>;
  normalizeExperienceText(text: string): Promise<NormalizedExperience>;
  /**
   * Suggest a handful of sharp, product-specific questions a prospective buyer
   * might want answered by real owners. Returns short German question strings.
   */
  suggestQuestions(productId: string): Promise<string[]>;
  /**
   * Recognize a product from a photo when no barcode could be read. `imageDataUrl`
   * is a `data:image/...;base64,…` URL captured client-side. Implementations must
   * return strict JSON and fall back to confidence 0 on any failure.
   */
  identifyProductFromImage(imageDataUrl: string): Promise<IdentifiedProduct>;
}

/** DI token string for the AiService binding in the backend. */
export const AI_SERVICE = 'AI_SERVICE';
