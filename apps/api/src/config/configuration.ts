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
  AI_PROVIDER: z.enum(['dummy', 'openrouter', 'openai', 'gemini', 'anthropic']).default('dummy'),
  // OpenRouter (used when AI_PROVIDER=openrouter). Key is optional so the app
  // still boots without it and transparently falls back to the deterministic AI.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('google/gemini-3.1-flash-lite'),
  OPENROUTER_SITE_URL: z.string().optional(),
  OPENROUTER_APP_TITLE: z.string().default('Wudly'),
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
}): 'openrouter' | 'dummy' {
  const explicit = env.AI_PROVIDER?.trim();
  const hasKey = Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0);
  if (explicit === 'openrouter') return 'openrouter';
  if (!explicit && hasKey) return 'openrouter';
  return 'dummy';
}
