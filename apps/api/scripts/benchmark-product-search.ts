/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { BraveSearchService } from '../src/ai/brave-search.service';
import {
  OpenRouterClient,
  parseJsonObject,
  type ChatMessage,
  type JsonCompletionResult,
} from '../src/ai/openrouter.client';

type Engine = 'brave' | 'perplexity';

const productSchema = z.object({
  canonicalName: z.string().trim().min(1),
  brand: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).optional().default([]),
  productUrl: z.string().url().nullable().optional(),
  found: z.coerce.boolean().default(false),
});

const cases = [
  { query: 'Apple AirPods Pro 2 USB-C', brand: 'Apple', terms: ['airpods', 'pro', '2'] },
  { query: 'Sony WH-1000XM5', brand: 'Sony', terms: ['wh-1000xm5'] },
  { query: 'Dyson V15 Detect Absolute', brand: 'Dyson', terms: ['v15', 'detect'] },
  { query: 'Bosch Serie 6 WGG244Z40 Waschmaschine', brand: 'Bosch', terms: ['wgg244z40'] },
  { query: 'Samsung Galaxy S24 Ultra 256GB', brand: 'Samsung', terms: ['s24', 'ultra'] },
  { query: 'Nintendo Switch OLED weiss', brand: 'Nintendo', terms: ['switch', 'oled'] },
  { query: 'Philips OneBlade Pro 360 QP6652/61', brand: 'Philips', terms: ['qp6652'] },
  { query: 'DeLonghi Magnifica Evo ECAM290.81.TB', brand: 'DeLonghi', terms: ['ecam290.81'] },
  { query: 'Garmin fenix 7 Pro Solar 47 mm', brand: 'Garmin', terms: ['fenix', '7', 'pro', 'solar'] },
  { query: 'Roborock S8 MaxV Ultra', brand: 'Roborock', terms: ['s8', 'maxv', 'ultra'] },
  { query: 'Miele Complete C3 Cat & Dog Flex', brand: 'Miele', terms: ['complete', 'c3', 'cat', 'dog'] },
  { query: 'ASUS ROG Ally X RC72LA', brand: 'ASUS', terms: ['rog', 'ally', 'x', 'rc72la'] },
  { query: 'Logitech MX Master 3S', brand: 'Logitech', terms: ['mx', 'master', '3s'] },
  { query: 'Kaercher K5 Power Control Home', brand: 'Kaercher', terms: ['k5', 'power', 'control'] },
  { query: 'Braun Series 9 Pro+ 9577cc', brand: 'Braun', terms: ['series', '9', '9577cc'] },
  { query: 'Ninja Foodi Dual Zone AF400EU', brand: 'Ninja', terms: ['af400eu'] },
  { query: 'Oral-B iO 10 Cosmic Black', brand: 'Oral-B', terms: ['io', '10'] },
  { query: 'Canon EOS R6 Mark II', brand: 'Canon', terms: ['eos', 'r6', 'mark', 'ii'] },
  { query: 'LG OLED evo C4 55 Zoll OLED55C47LA', brand: 'LG', terms: ['c4', 'oled55c47la'] },
  { query: 'Siemens EQ.6 plus s700 TE657503DE', brand: 'Siemens', terms: ['eq6', 's700', 'te657503de'] },
] as const;

interface BenchmarkRow {
  engine: Engine;
  query: string;
  ok: boolean;
  brandCorrect: boolean;
  nameCorrect: boolean;
  hasProductUrl: boolean;
  specs: number;
  citations: number;
  latencyMs: number;
  tokens: number;
  costUsd: number;
  error?: string;
}

loadEnv(resolve(process.cwd(), '.env'));
loadEnv(resolve(process.cwd(), 'apps/api/.env'));

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const braveKey = process.env.BRAVE_SEARCH_KEY?.trim();
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required.');

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] ?? cases.length), 1), cases.length);
const selectedCases = cases.slice(0, limit);
const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-3.1-flash-lite';
const sharedOptions = {
  apiKey,
  model,
  siteUrl: process.env.OPENROUTER_SITE_URL || 'https://wudly.app',
  appTitle: 'Wudly Search Benchmark',
  webSearchMaxResults: 8,
} as const;
const perplexityClient = new OpenRouterClient({ ...sharedOptions, webSearchEngine: 'perplexity' });
const offlineClient = new OpenRouterClient(sharedOptions);
const brave = new BraveSearchService(braveKey || null);

void main();

async function main(): Promise<void> {
  const rows: BenchmarkRow[] = [];
  for (const testCase of selectedCases) {
    if (braveKey) rows.push(await runBrave(testCase));
    rows.push(await runPerplexity(testCase));
  }

  console.table(rows.map((row) => ({
    engine: row.engine,
    query: row.query,
    ok: row.ok,
    score: Number(row.brandCorrect) + Number(row.nameCorrect) + Number(row.hasProductUrl),
    specs: row.specs,
    citations: row.citations,
    latencyMs: row.latencyMs,
    tokens: row.tokens,
    costUsd: row.costUsd.toFixed(5),
    error: row.error ?? '',
  })));

  for (const engine of ['brave', 'perplexity'] as const) {
    const engineRows = rows.filter((row) => row.engine === engine);
    if (!engineRows.length) continue;
    console.log(`\n${engine.toUpperCase()}`);
    console.log({
      cases: engineRows.length,
      validJsonRate: ratio(engineRows.filter((row) => row.ok).length, engineRows.length),
      brandAccuracy: ratio(engineRows.filter((row) => row.brandCorrect).length, engineRows.length),
      nameAccuracy: ratio(engineRows.filter((row) => row.nameCorrect).length, engineRows.length),
      productUrlRate: ratio(engineRows.filter((row) => row.hasProductUrl).length, engineRows.length),
      avgSpecs: average(engineRows.map((row) => row.specs)),
      avgLatencyMs: average(engineRows.map((row) => row.latencyMs)),
      totalCostUsd: sum(engineRows.map((row) => row.costUsd)),
    });
  }

  if (!braveKey) console.warn('\nBRAVE_SEARCH_KEY is missing: only Perplexity was executed.');
}

async function runBrave(testCase: (typeof cases)[number]): Promise<BenchmarkRow> {
  const started = performance.now();
  const context = await brave.context(`${testCase.query} Produkt Test technische Daten`, 8);
  if (!context) return failedRow('brave', testCase.query, started, 'Brave returned no context');
  const result = await offlineClient.completeJsonDetailed(
    [groundingMessage(context), ...researchMessages(testCase.query)],
    completionOptions(false),
  );
  return scoreResult('brave', testCase, result, started);
}

async function runPerplexity(testCase: (typeof cases)[number]): Promise<BenchmarkRow> {
  const started = performance.now();
  const result = await perplexityClient.completeJsonDetailed(
    researchMessages(testCase.query),
    completionOptions(true),
  );
  return scoreResult('perplexity', testCase, result, started);
}

function researchMessages(query: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'Du recherchierst ein Konsumprodukt im Web und lieferst strukturierte, faktische Daten. ' +
        'Findest du das Produkt nicht zweifelsfrei, setze found=false und erfinde nichts. ' +
        'canonicalName ist der offizielle Produktname mit Marke. description ist ein sachlicher ' +
        'deutscher Satz. specs enthaelt bis zu 8 sichere technische Fakten als label/value-Paare. ' +
        'productUrl ist bevorzugt die offizielle Herstellerseite. Antworte nur als valides JSON: ' +
        '{"canonicalName":string,"brand":string|null,"description":string|null,' +
        '"specs":[{"label":string,"value":string}],"productUrl":string|null,"found":boolean}.',
    },
    { role: 'user', content: `Produkt: ${query}` },
  ];
}

function groundingMessage(context: string): ChatMessage {
  return {
    role: 'system',
    content: 'Aktuelle Websuche-Ergebnisse (nutze NUR diese als Quelle):\n\n' + context,
  };
}

function completionOptions(online: boolean) {
  return { temperature: 0.2, maxTokens: 600, online, timeoutMs: 45_000 };
}

function scoreResult(
  engine: Engine,
  testCase: (typeof cases)[number],
  result: JsonCompletionResult,
  started: number,
): BenchmarkRow {
  const parsed = productSchema.safeParse(parseJsonObject(result.content ?? null));
  if (!result.ok || !parsed.success) {
    return failedRow(engine, testCase.query, started, result.error ?? 'invalid JSON');
  }
  const normalizedName = normalize(parsed.data.canonicalName);
  const reportedCost = result.usage?.costUsd;
  const costUsd = reportedCost ?? estimateModelCost(result) + 0.005;
  return {
    engine,
    query: testCase.query,
    ok: true,
    brandCorrect: normalize(parsed.data.brand ?? '') === normalize(testCase.brand),
    nameCorrect: testCase.terms.every((term) => normalizedName.includes(normalize(term))),
    hasProductUrl: Boolean(parsed.data.productUrl),
    specs: parsed.data.specs.length,
    citations: result.citations.length,
    latencyMs: Math.round(performance.now() - started),
    tokens: result.usage?.totalTokens ?? 0,
    costUsd: engine === 'brave' && reportedCost !== undefined ? reportedCost + 0.005 : costUsd,
  };
}

function failedRow(engine: Engine, query: string, started: number, error: string): BenchmarkRow {
  return {
    engine,
    query,
    ok: false,
    brandCorrect: false,
    nameCorrect: false,
    hasProductUrl: false,
    specs: 0,
    citations: 0,
    latencyMs: Math.round(performance.now() - started),
    tokens: 0,
    costUsd: 0,
    error,
  };
}

function estimateModelCost(result: JsonCompletionResult): number {
  return (((result.usage?.promptTokens ?? 0) * 0.25) + ((result.usage?.completionTokens ?? 0) * 1.5)) / 1_000_000;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('de-DE').replace(/[^a-z0-9]+/g, '');
}

function ratio(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(1)}%`;
}

function average(values: number[]): number {
  return Math.round((sum(values) / values.length) * 100) / 100;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function loadEnv(path: string): void {
  try {
    for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Optional file; ambient environment variables are also supported.
  }
}
