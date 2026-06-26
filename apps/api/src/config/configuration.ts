import { z } from 'zod';

/**
 * Environment validation. The app refuses to boot with an invalid config, which
 * surfaces deployment mistakes immediately instead of at the first request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  AI_PROVIDER: z.enum(['dummy', 'openrouter', 'ollama', 'openai', 'gemini', 'anthropic']).default('dummy'),
  // OpenRouter (used when AI_PROVIDER=openrouter). Key is optional so the app
  // still boots without it and transparently falls back to the deterministic AI.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('google/gemini-3.1-flash-lite'),
  OPENROUTER_SITE_URL: z.string().optional(),
  OPENROUTER_APP_TITLE: z.string().default('Wudly'),
  OPENROUTER_WEB_SEARCH_ENGINE: z.enum(['auto', 'exa', 'parallel', 'perplexity']).default('perplexity'),
  OPENROUTER_WEB_SEARCH_MAX_RESULTS: z.coerce.number().int().min(1).max(10).default(5),
  OPENROUTER_WEB_SEARCH_EXCLUDE_DOMAINS: z
    .string()
    .default('youtube.com,ebay.com,ebay.de,allegro.pl,trustpilot.com')
    .transform((value) => value.split(',').map((domain) => domain.trim()).filter(Boolean)),
  PRODUCT_RESEARCH_SEARCH_PROVIDER: z.enum(['brave', 'openrouter']).default('openrouter'),
  // Background refresh of external product ratings/themes using self-hosted Gemma.
  // Requires BRAVE_SEARCH_KEY because Ollama/Gemma cannot browse by itself.
  PRODUCT_RESEARCH_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  PRODUCT_RESEARCH_WORKER_TARGETS: z
    .string()
    .default('gemma-4b,gemma-2b')
    .transform((value) => {
      const allowed = new Set(['gemma-4b', 'gemma-2b']);
      const targets = value
        .split(',')
        .map((target) => target.trim())
        .filter((target) => allowed.has(target));
      return targets.length > 0 ? [...new Set(targets)] : ['gemma-4b', 'gemma-2b'];
    }),
  PRODUCT_RESEARCH_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(25).default(2),
  PRODUCT_RESEARCH_WORKER_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(10080).default(360),
  PRODUCT_RESEARCH_WORKER_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PRODUCT_RESEARCH_WORKER_PRELOAD: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  PRODUCT_RESEARCH_WORKER_PRELOAD_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(30000)
    .max(600000)
    .default(240000),
  // Ollama-compatible local model service. Used when AI_PROVIDER=ollama.
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma4:e4b'),
  // Second self-hosted Gemma (smaller 2B/E2B variant), used by the admin model
  // playground to benchmark it against the 4B model and the cloud model. When
  // OLLAMA_2B_BASE_URL is unset, the playground reuses OLLAMA_BASE_URL.
  OLLAMA_2B_BASE_URL: z.string().url().optional(),
  OLLAMA_2B_MODEL: z.string().default('gemma4:e2b'),
  // Web Push (VAPID). Optional so the app boots without them; push is simply
  // disabled until all three are set. Generate with `npx web-push generate-vapid-keys`.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:hallo@wudly.app'),
  // Open Icecat (official manufacturer product data/images by GTIN). Register a
  // free account at icecat.biz; without ICECAT_USERNAME the lookup is skipped
  // and the EAN chain continues with the other free databases.
  ICECAT_USERNAME: z.string().optional(),
  ICECAT_API_TOKEN: z.string().optional(),
  // Google Programmable Search (image mode) — the most reliable product-photo
  // source for products no EAN database covers. 100 queries/day free:
  // console.cloud.google.com → enable "Custom Search API" + create API key;
  // programmablesearchengine.google.com → engine ("Search entire web", image
  // search ON) → copy its cx id. Optional: without both, this step is skipped.
  GOOGLE_CSE_KEY: z.string().optional(),
  GOOGLE_CSE_ID: z.string().optional(),
  BING_IMAGE_KEY: z.string().optional(),
  // Brave Image Search — official, keyed image API with a free tier (2,000
  // queries/month, 1 req/sec). The most reliable free product-photo source:
  // unlike the DuckDuckGo scrape it is a documented endpoint that won't rot.
  // Get a key at api-dashboard.search.brave.com (free "Data for Search" plan).
  // Optional: without it the image hunt falls back to DuckDuckGo.
  BRAVE_SEARCH_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Parse CORS_ORIGIN (comma-separated) into an array for Nest's CORS config. */
export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Resolve the *effective* AI provider from the raw environment.
 *
 * Crucially, this auto-enables OpenRouter when an OPENROUTER_API_KEY is present
 * but AI_PROVIDER was never set — the #1 "I set the key but AI doesn't work"
 * gotcha (the zod default is "dummy"). An explicit AI_PROVIDER always wins.
 */
export function resolveAiProvider(env: {
  AI_PROVIDER?: string;
  OPENROUTER_API_KEY?: string;
}): 'openrouter' | 'ollama' | 'dummy' {
  const explicit = env.AI_PROVIDER?.trim();
  const hasKey = Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0);
  if (explicit === 'openrouter') return 'openrouter';
  if (explicit === 'ollama') return 'ollama';
  if (!explicit && hasKey) return 'openrouter';
  return 'dummy';
}
