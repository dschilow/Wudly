/* eslint-disable no-console */
import 'reflect-metadata';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { CreateProductResultDto } from '@wudly/shared';
import { AppModule } from '../src/app.module';
import {
  ProductAgentCurationService,
  type AgentProductCurationDraft,
  type AgentProductSeed,
} from '../src/products/product-agent-curation.service';

interface CliFlags {
  queries: string[];
  file: string | null;
  stdin: boolean;
  commit: boolean;
  forceCreate: boolean;
  allowLowScore: boolean;
  createdByUserId: string | null;
  outDir: string;
  limit: number | null;
  minScore: number;
  sourceLimit: number;
  help: boolean;
}

interface RunRow {
  seed: AgentProductSeed;
  draft: AgentProductCurationDraft;
  committed: boolean;
  skipped: string | null;
  result: CreateProductResultDto | null;
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

  const seeds = collectSeeds(flags);
  if (seeds.length === 0) {
    printHelp();
    throw new Error('No products supplied. Use --query, --file or --stdin.');
  }

  const limitedSeeds = flags.limit ? seeds.slice(0, flags.limit) : seeds;
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const service = app.get(ProductAgentCurationService);
  const rows: RunRow[] = [];

  try {
    console.warn(
      `[agent-product-curation] mode=${flags.commit ? 'commit' : 'dry-run'} products=${limitedSeeds.length}`,
    );
    for (let index = 0; index < limitedSeeds.length; index += 1) {
      const seed = limitedSeeds[index]!;
      const draft = await service.research(seed, {
        minQualityScore: flags.minScore,
        sourceLimit: flags.sourceLimit,
      });
      const prefix = `[${index + 1}/${limitedSeeds.length}] ${seed.query}`;
      console.warn(
        `${prefix}: score=${draft.quality.score} ready=${draft.quality.ready ? 'yes' : 'no'} ` +
          `ratings=${draft.payload.ratings.length} specs=${draft.payload.specs.length} ` +
          `sources=${draft.quality.fetchedSourceCount}/${draft.quality.sourceCount}`,
      );

      let skipped: string | null = null;
      let result: CreateProductResultDto | null = null;
      let committed = false;
      if (flags.commit) {
        if (!draft.quality.ready && !flags.allowLowScore) {
          skipped = `quality-below-${flags.minScore}`;
        } else {
          result = await service.commit(draft, {
            createdByUserId: flags.createdByUserId,
            forceCreate: flags.forceCreate,
          });
          committed = result.created;
          console.warn(
            `${prefix}: ${result.created ? `created=${result.product.id}` : `duplicate-candidates=${result.candidates.length}`}`,
          );
        }
      }

      rows.push({ seed, draft, committed, skipped, result });
    }
  } finally {
    await app.close();
  }

  writeReports(rows, flags);
  const created = rows.filter((row) => row.committed).length;
  const ready = rows.filter((row) => row.draft.quality.ready).length;
  console.warn(
    `[agent-product-curation] wrote reports to ${flags.outDir}; ready=${ready}/${rows.length}; created=${created}`,
  );
}

function parseArgs(args: string[]): CliFlags {
  const flags: CliFlags = {
    queries: [],
    file: null,
    stdin: false,
    commit: false,
    forceCreate: false,
    allowLowScore: false,
    createdByUserId: null,
    outDir: 'tmp/agent-product-curation',
    limit: null,
    minScore: 70,
    sourceLimit: 10,
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
    else if (arg === '--allow-low-score') flags.allowLowScore = true;
    else if (arg === '--stdin') flags.stdin = true;
    else if (arg === '--query' || arg === '-q') flags.queries.push(next());
    else if (arg.startsWith('--query=')) flags.queries.push(arg.slice('--query='.length));
    else if (arg === '--file' || arg === '-f') flags.file = next();
    else if (arg.startsWith('--file=')) flags.file = arg.slice('--file='.length);
    else if (arg === '--created-by') flags.createdByUserId = next();
    else if (arg.startsWith('--created-by=')) flags.createdByUserId = arg.slice('--created-by='.length);
    else if (arg === '--out') flags.outDir = next();
    else if (arg.startsWith('--out=')) flags.outDir = arg.slice('--out='.length);
    else if (arg === '--limit') flags.limit = parsePositiveInt(next(), '--limit');
    else if (arg.startsWith('--limit=')) flags.limit = parsePositiveInt(arg.slice('--limit='.length), '--limit');
    else if (arg === '--min-score') flags.minScore = parsePositiveInt(next(), '--min-score');
    else if (arg.startsWith('--min-score=')) flags.minScore = parsePositiveInt(arg.slice('--min-score='.length), '--min-score');
    else if (arg === '--source-limit') flags.sourceLimit = parsePositiveInt(next(), '--source-limit');
    else if (arg.startsWith('--source-limit=')) flags.sourceLimit = parsePositiveInt(arg.slice('--source-limit='.length), '--source-limit');
    else flags.queries.push(arg);
  }
  return flags;
}

function collectSeeds(flags: CliFlags): AgentProductSeed[] {
  const seeds: AgentProductSeed[] = [];
  for (const query of flags.queries) seeds.push({ query });
  if (flags.file) seeds.push(...parseSeedText(readFileSync(resolve(flags.file), 'utf8'), flags.file));
  if (flags.stdin) seeds.push(...parseSeedText(readFileSync(0, 'utf8'), 'stdin'));
  return seeds
    .map((seed) => ({ ...seed, query: seed.query.trim() }))
    .filter((seed) => seed.query.length >= 2);
}

function parseSeedText(raw: string, label: string): AgentProductSeed[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) throw new Error(`${label} must contain a JSON array.`);
    return parsed.map((entry) => {
      if (typeof entry === 'string') return { query: entry };
      if (entry && typeof entry === 'object') {
        const row = entry as Record<string, unknown>;
        if (typeof row.query !== 'string') throw new Error(`${label}: every object needs query.`);
        return {
          query: row.query,
          brand: typeof row.brand === 'string' ? row.brand : null,
          categorySlug: typeof row.categorySlug === 'string' ? row.categorySlug : null,
          ean: typeof row.ean === 'string' ? row.ean : null,
          productUrl: typeof row.productUrl === 'string' ? row.productUrl : null,
          imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
        };
      }
      throw new Error(`${label}: entries must be strings or objects.`);
    });
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((query) => ({ query }));
}

function writeReports(rows: RunRow[], flags: CliFlags): void {
  const outDir = resolve(flags.outDir);
  mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    mode: flags.commit ? 'commit' : 'dry-run',
    options: {
      minScore: flags.minScore,
      sourceLimit: flags.sourceLimit,
      forceCreate: flags.forceCreate,
      allowLowScore: flags.allowLowScore,
    },
    products: rows.map(toJsonRow),
  };
  writeFileSync(resolve(outDir, 'agent-product-curation.json'), JSON.stringify(report, null, 2));
  writeFileSync(resolve(outDir, 'agent-product-payloads.jsonl'), rows.map((row) => JSON.stringify(row.draft.payload)).join('\n'));
  writeFileSync(resolve(outDir, 'agent-product-curation.md'), toMarkdown(rows, flags));
}

function toJsonRow(row: RunRow) {
  return {
    seed: row.seed,
    quality: row.draft.quality,
    payload: row.draft.payload,
    catalogMatches: row.draft.catalogMatches.map((product) => ({
      id: product.id,
      canonicalName: product.canonicalName,
      brand: product.brand,
    })),
    sourceEvidence: row.draft.sourceEvidence.map((source) => ({
      url: source.url,
      title: source.title,
      fetched: source.fetched,
      error: source.error,
      specs: source.specs.length,
      ratings: source.ratings.length,
      positiveThemes: source.positiveThemes.length,
      negativeThemes: source.negativeThemes.length,
    })),
    committed: row.committed,
    skipped: row.skipped,
    result: row.result,
  };
}

function toMarkdown(rows: RunRow[], flags: CliFlags): string {
  const ready = rows.filter((row) => row.draft.quality.ready).length;
  const created = rows.filter((row) => row.committed).length;
  const lines = [
    '# Agent Product Curation Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${flags.commit ? 'commit' : 'dry-run'}`,
    `Ready: ${ready}/${rows.length}`,
    `Created: ${created}/${rows.length}`,
    '',
    '| # | Query | Score | Ready | Ratings | Specs | Sources | Product | Result |',
    '|---:|---|---:|---|---:|---:|---:|---|---|',
  ];
  rows.forEach((row, index) => {
    const result = row.result
      ? row.result.created
        ? `created ${row.result.product.id}`
        : `${row.result.candidates.length} duplicate candidates`
      : row.skipped || '-';
    lines.push(
      `| ${index + 1} | ${escapeMd(row.seed.query)} | ${row.draft.quality.score} | ${row.draft.quality.ready ? 'yes' : 'no'} | ` +
        `${row.draft.payload.ratings.length} | ${row.draft.payload.specs.length} | ${row.draft.quality.fetchedSourceCount}/${row.draft.quality.sourceCount} | ` +
        `${escapeMd(row.draft.payload.canonicalName)} | ${escapeMd(result)} |`,
    );
  });
  lines.push('', '## Commands', '');
  lines.push('Dry run does not write products. Use `--commit` only after reviewing this report.');
  return lines.join('\n');
}

function printHelp(): void {
  console.log(`Agent product curation (AI-free)

Usage:
  pnpm --filter @wudly/api catalog:agent:research -- --query "Sony WH-1000XM5"
  pnpm --filter @wudly/api catalog:agent:research -- --file tmp/products.txt
  pnpm --filter @wudly/api catalog:agent:import -- --file tmp/products.json

Inputs:
  --query, -q             One product query. Can be repeated.
  --file, -f              Text file (one query per line) or JSON array.
  --stdin                 Read text/JSON from stdin.

Safety:
  --dry-run               Default. Research and write reports only.
  --commit                Insert ready products through ProductsService.createCurated().
  --force-create          Bypass duplicate soft-blocks during commit.
  --allow-low-score       Commit drafts below --min-score. Avoid unless reviewed.
  --min-score=70          Readiness threshold.

Options:
  --source-limit=10       Max pages fetched per product.
  --limit=N               Process first N inputs.
  --created-by=USER_ID    Attribute created products to an admin user.
  --out=DIR               Report directory. Default: tmp/agent-product-curation.
`);
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function escapeMd(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}