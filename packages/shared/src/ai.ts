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

/** AI estimate for the pre-purchase regret check when there's no catalog data. */
export interface RegretAssessment {
  /** Estimated % who would buy again (0..100), or null if the model won't guess. */
  rebuyProbability: number | null;
  topConcern: string | null;
  summary: string;
}

/* ------------------------------------------------------------------ *
 * Model playground (admin benchmarking tool)
 *
 * Lets an admin send a free-form prompt to a specific model and compare the
 * cloud model (Gemini Flash Lite via OpenRouter) against the self-hosted Gemma
 * variants on Railway — measuring latency, token usage and answer quality.
 * ------------------------------------------------------------------ */

export type AiPlaygroundTargetId = 'openrouter' | 'gemma-4b' | 'gemma-2b';

export interface AiPlaygroundTarget {
  id: AiPlaygroundTargetId;
  /** Short human label, e.g. "Gemini Flash Lite (Cloud)". */
  label: string;
  provider: 'openrouter' | 'ollama';
  model: string;
  /** Where requests go: "openrouter.ai" or the Ollama host. */
  endpoint: string;
  /** False when a required credential/URL is missing. */
  configured: boolean;
  /** Paid cloud model vs self-hosted compute. */
  kind: 'cloud' | 'self-hosted';
  hint?: string;
}

export interface AiPlaygroundMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiPlaygroundChatRequest {
  targetId: AiPlaygroundTargetId;
  messages: AiPlaygroundMessage[];
  /** Sampling temperature 0..2 (default 0.7). */
  temperature?: number;
  /** Max output tokens (default 800). */
  maxTokens?: number;
}

export interface AiPlaygroundUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiPlaygroundReply {
  targetId: AiPlaygroundTargetId;
  provider: 'openrouter' | 'ollama';
  model: string;
  ok: boolean;
  text: string;
  error?: string;
  /** End-to-end wall-clock latency in ms (includes any cold start). */
  latencyMs: number;
  usage?: AiPlaygroundUsage;
  /** Generation throughput (completion tokens / sec) when available. */
  tokensPerSecond?: number;
}

/** Live web research result used to auto-create a product the catalog lacks. */
export interface ResearchedProduct {
  canonicalName: string;
  brand: string | null;
  /** Chosen from the provided slug list, or null if none fits. */
  categorySlug: string | null;
  description: string | null;
  /** A few key technical facts the model is confident about (model, specs…). */
  specs?: Array<{ label: string; value: string }>;
  /** Official product image URL the model found, when confident (else null). */
  imageUrl?: string | null;
  /** Official product PAGE url (manufacturer/retailer) — its og:image is a far
      more reliable photo source than model-guessed direct image URLs. */
  productUrl?: string | null;
  /** True when the model is confident this is a real, identifiable product. */
  found: boolean;
}

/** A concrete real-world product the AI believes the user is searching for. */
export interface SuggestedProductCandidate {
  name: string;
  brand: string | null;
  /** EAN/GTIN only when the model is confident — never guessed. */
  ean: string | null;
}

/** An aggregated rating FACT researched from another platform (avg + count + link). */
export interface ResearchedExternalRating {
  /** Stable machine key, e.g. "amazon". */
  source: string;
  /** Display name, e.g. "Amazon". */
  sourceLabel: string;
  /** Link to the concrete product page on the source platform. */
  url: string;
  kind: 'STARS' | 'PERCENT' | 'GRADE_DE';
  value: number;
  maxValue: number;
  count: number | null;
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
  /**
   * Estimate a pre-purchase regret signal for a product Wudly has no own data on
   * yet. Returns null probability when the model has nothing meaningful to say.
   */
  assessRegret(productName: string, category?: string | null): Promise<RegretAssessment>;
  /**
   * Research a product by name using live web access, to auto-create it when it's
   * missing from the catalog. `categorySlugs` are the valid slugs to choose from.
   * Returns `found: false` when nothing trustworthy could be established.
   */
  researchProduct(name: string, categorySlugs: string[]): Promise<ResearchedProduct>;
  /**
   * Name up to 3 real, concrete products the user most likely means by a free-text
   * search query (used when catalog + market DBs come up empty). Empty when unsure.
   */
  suggestProducts(query: string): Promise<SuggestedProductCandidate[]>;
  /**
   * Research aggregated rating FACTS (average + count + product-page link) for a
   * product on major platforms. Facts only — never review texts. Empty when unsure.
   */
  researchExternalRatings(name: string, brand: string | null): Promise<ResearchedExternalRating[]>;
}

/** DI token string for the AiService binding in the backend. */
export const AI_SERVICE = 'AI_SERVICE';
