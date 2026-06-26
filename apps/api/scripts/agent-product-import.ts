/* eslint-disable no-console */
/**
 * Chat-agent-researched product import (AI-free at runtime).
 *
 * Unlike `agent-product-curation.ts` — which scrapes pages and guesses — this
 * script trusts a fully-researched JSON file that the *agent* (aktuelles Chat-Agent-Modell) prepared
 * by hand: clean canonical name, brand, category, German description, technical
 * specs, source-backed external ratings and review themes, plus an optional
 * image lead. It then runs the EXACT same production pipeline the app uses when
 * an admin curates a product (`ProductsService.createCurated`):
 *
 *   - duplicate protection (soft-block unless --force-create)
 *   - validated background image hunt (Brave/Google/og:image) when no imageUrl
 *   - external ratings + consensus themes persisted with their source URLs
 *   - owner-insight snapshot regenerated
 *
 * The whole point: do everything the OpenRouter path does, but with the
 * research supplied by the current chat agent so production spends ZERO OpenRouter tokens.
 *
 * Input JSON: an array of objects matching CreateCuratedProductInput
 * (see packages/shared/src/schemas.ts → createCuratedProductSchema), e.g.
 *
 * [
 *   {
 *     "canonicalName": "Roborock S8 MaxV Ultra",
 *     "brand": "Roborock",
 *     "categorySlug": "saugroboter",
 *     "description": "…",
 *     "imageUrl": "https://…/photo.jpg",      // optional lead; validated before storing
 *     "productUrl": "https://global.roborock.com/…",
 *     "ean": "6970995785432",                 // optional
 *     "specs": [{ "label": "Saugkraft", "value": "10.000 Pa" }],
 *     "ratings": [
 *       { "source": "amazon", "sourceLabel": "Amazon", "url": "https://www.amazon.de/…",
 *         "kind": "STARS", "value": 4.5, "maxValue": 5, "count": 1240 }
 *     ],
 *     "consensusSummary": "…",
 *     "positiveThemes": [{ "label": "Sehr starke Saugleistung", "sourceUrls": ["https://…","https://…"] }],
 *     "negativeThemes": [{ "label": "App teils umständlich", "sourceUrls": ["https://…","https://…"] }],
 *     "sourceUrls": ["https://…"]
 *   }
 * ]
 *
 * Usage:
 *   pnpm --filter @wudly/api catalog:import:research -- --file tmp/robot-vacuums.json            (dry run)
 *   pnpm --filter @wudly/api catalog:import:research -- --file tmp/robot-vacuums.json --commit
 *   …--commit --force-create   (bypass duplicate soft-block, e.g. to enrich existing)
 *   …--commit --created-by=USER_ID
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  createCuratedProductSchema,
  type CreateCuratedProductInput,
  type CreateProductResultDto,
} from '@wudly/shared';
import { AppModule } from '../src/app.module';
import { ProductsService } from '../src/products/products.service';

interface CliFlags {
  file: string | null;
  stdin: boolean;
  commit: boolean;
  forceCreate: boolean;
  createdByUserId: string | null;
  limit: number | null;
  help: boolean;
}

loadEnv(resolve(process.cwd(), '.env'));
loadEnv(resolve(process.cwd(), 'apps/api/.env'));

void main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const inputs = collectInputs(flags);
  if (inputs.length === 0) {
    printHelp();
    throw new Error('No products supplied. Use --file or --stdin with a JSON array.');
  }

  // Validate every payload up front with the SAME schema the app uses, so a bad
  // file fails fast and loudly instead of half-importing.
  const payloads: CreateCuratedProductInput[] = inputs.map((raw, index) => {
    const parsed = createCuratedProductSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Product #${index + 1} (${describe(raw)}) failed validation: ${issues}`);
    }
    return parsed.data;
  });

  const limited = flags.limit ? payloads.slice(0, flags.limit) : payloads;
  console.warn(
    `[agent-product-import] mode=${flags.commit ? 'commit' : 'dry-run'} products=${limited.length}`,
  );

  if (!flags.commit) {
    for (const [index, payload] of limited.entries()) {
      console.warn(
        `[${index + 1}/${limited.length}] ${payload.canonicalName}: ` +
          `brand=${payload.brand ?? '—'} category=${payload.categorySlug ?? '—'} ` +
          `specs=${payload.specs.length} ratings=${payload.ratings.length} ` +
          `themes=${payload.positiveThemes.length}+${payload.negativeThemes.length} ` +
          `image=${payload.imageUrl ? 'lead' : 'hunt'}`,
      );
    }
    console.warn('[agent-product-import] dry run — nothing written. Re-run with --commit.');
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const products = app.get(ProductsService);
  let created = 0;
  let duplicates = 0;
  try {
    for (const [index, payload] of limited.entries()) {
      const prefix = `[${index + 1}/${limited.length}] ${payload.canonicalName}`;
      let result: CreateProductResultDto;
      try {
        result = await products.createCurated(
          { ...payload, forceCreate: flags.forceCreate || payload.forceCreate },
          flags.createdByUserId,
        );
      } catch (err) {
        console.warn(`${prefix}: ERROR ${err instanceof Error ? err.message : err}`);
        continue;
      }
      if (result.created) {
        created += 1;
        console.warn(
          `${prefix}: created=${result.product.id} ` +
            `(specs=${payload.specs.length}, ratings=${payload.ratings.length}, ` +
            `themes=${payload.positiveThemes.length + payload.negativeThemes.length})`,
        );
      } else {
        duplicates += 1;
        const names = result.candidates
          .map((candidate) => `${candidate.product.canonicalName} (${candidate.similarity})`)
          .join(', ');
        console.warn(
          `${prefix}: duplicate-candidates=${result.candidates.length} [${names}] — ` +
            `re-run with --force-create to add anyway.`,
        );
      }
    }
  } finally {
    await app.close();
  }
  console.warn(`[agent-product-import] done. created=${created} duplicates=${duplicates}`);
}

function parseArgs(args: string[]): CliFlags {
  const flags: CliFlags = {
    file: null,
    stdin: false,
    commit: false,
    forceCreate: false,
    createdByUserId: null,
    limit: null,
    help: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    const next = () => {
      i += 1;
      if (i >= args.length) throw new Error(`Missing value after ${arg}`);
      return args[i]!;
    };
    if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--commit') flags.commit = true;
    else if (arg === '--dry-run') flags.commit = false;
    else if (arg === '--force-create') flags.forceCreate = true;
    else if (arg === '--stdin') flags.stdin = true;
    else if (arg === '--file' || arg === '-f') flags.file = next();
    else if (arg.startsWith('--file=')) flags.file = arg.slice('--file='.length);
    else if (arg === '--created-by') flags.createdByUserId = next();
    else if (arg.startsWith('--created-by=')) flags.createdByUserId = arg.slice('--created-by='.length);
    else if (arg === '--limit') flags.limit = parsePositiveInt(next(), '--limit');
    else if (arg.startsWith('--limit=')) flags.limit = parsePositiveInt(arg.slice('--limit='.length), '--limit');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return flags;
}

function collectInputs(flags: CliFlags): unknown[] {
  const blocks: unknown[] = [];
  if (flags.file) blocks.push(...parseJsonArray(readFileSync(resolve(flags.file), 'utf8'), flags.file));
  if (flags.stdin) blocks.push(...parseJsonArray(readFileSync(0, 'utf8'), 'stdin'));
  return blocks;
}

function parseJsonArray(raw: string, label: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') return [parsed];
  throw new Error(`${label} must contain a JSON object or array.`);
}

function describe(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'canonicalName' in raw) {
    const name = (raw as { canonicalName?: unknown }).canonicalName;
    if (typeof name === 'string') return name;
  }
  return 'unknown';
}

function printHelp(): void {
  console.log(`Chat-agent-researched product import (AI-free at runtime)

Feed a JSON array of fully-researched products (CreateCuratedProductInput shape)
through the production curated-create pipeline: duplicate protection, validated
image hunt, external ratings + consensus themes, owner-insight snapshot.

Usage:
  pnpm --filter @wudly/api catalog:import:research -- --file tmp/products.json
  pnpm --filter @wudly/api catalog:import:research -- --file tmp/products.json --commit

Flags:
  --file, -f FILE     JSON array (or single object) of products.
  --stdin             Read JSON from stdin.
  --dry-run           Default. Validate + summarise, write nothing.
  --commit            Insert through ProductsService.createCurated().
  --force-create      Bypass duplicate soft-block (use to enrich/replace).
  --created-by=ID     Attribute created products to a user id.
  --limit=N           Process first N entries only.
`);
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function loadEnv(path: string): void {
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const key = match[1]!;
      if (process.env[key] !== undefined) continue;
      let value = match[2]!.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // Missing .env is fine — env may be provided by the shell.
  }
}
