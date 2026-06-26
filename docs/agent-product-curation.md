# Agent Product Curation

Purpose: let a coding agent research and optionally insert real catalog products without using OpenRouter or any paid LLM research path.

> **Empfohlener Weg für „Produkte aus dem Chat anlegen": Agent-recherchierter
> Import** — siehe `AGENTS.md` → „Produkte aus dem Chat anlegen". Dort recherchiert
> der Agent (aktuelles Chat-Agent-Modell) selbst (Specs, Beschreibung, Bewertungen mit Quellen, Themen)
> und schiebt das Ergebnis als JSON durch dieselbe Produktions-Pipeline
> (`createCurated`) via `apps/api/scripts/agent-product-import.ts`
> (`pnpm --filter @wudly/api catalog:import:research`). Beispiel-JSON:
> `tmp/robot-vacuums.json`. Das liefert App-Qualität ohne OpenRouter-Tokens.
>
> Das unten beschriebene Scraping-Verfahren (`agent-product-curation.ts`) ist der
> **Fallback** für Massen-Befüllung — es scrapt Quellseiten automatisch, liefert
> aber oft schwächere Daten (niedrige Scores, EAN-Treffer können Zubehör statt
> Produkt sein).

## Entry Points

- Service: `apps/api/src/products/product-agent-curation.service.ts`
- CLI: `apps/api/scripts/agent-product-curation.ts`
- Package scripts:
  - `pnpm --filter @wudly/api catalog:agent:research -- --query "Sony WH-1000XM5"`
  - `pnpm --filter @wudly/api catalog:agent:research -- --file tmp/products.txt`
  - `pnpm --filter @wudly/api catalog:agent:import -- --file tmp/products.json`

`catalog:agent:research` is the safe default. It writes reports only. `catalog:agent:import` adds `--commit` and can create products.

## Safety Rules

- The CLI never writes products unless `--commit` is present.
- Drafts below `--min-score` are skipped during commit unless `--allow-low-score` is present.
- Duplicate candidates are soft-blocked by `ProductsService.createCurated()` unless `--force-create` is present.
- Do a dry run first, inspect `tmp/agent-product-curation/agent-product-curation.md`, then commit.
- Do not use OpenRouter for bulk catalog filling unless the user explicitly asks for an AI-based run.

## Data Sources

The agent curation service uses only AI-free sources:

- Existing Wudly catalog matching for duplicates.
- EAN/GTIN draft data through the existing product lookup chain.
- Brave web search when `BRAVE_SEARCH_KEY` is configured.
- Public source pages, parsed for schema.org JSON-LD Product data.
- Page meta tags and Open Graph images.
- HTML tables / definition lists for technical specs.
- Aggregate ratings from JSON-LD or conservative rating-page text extraction.
- Pro/con list sections from public review pages, stored as source-backed themes.

No OpenRouter client is called by `ProductAgentCurationService` or `agent-product-curation.ts`.

## Input Formats

Text file, one product per line:

```text
Sony WH-1000XM5
Apple AirPods Pro 2 USB-C
Roborock S8 MaxV Ultra
```

JSON array with optional hints:

```json
[
  {
    "query": "Sony WH-1000XM5",
    "brand": "Sony",
    "categorySlug": "",
    "ean": "",
    "productUrl": ""
  }
]
```

Supported fields: `query`, `brand`, `categorySlug`, `ean`, `productUrl`, `imageUrl`.

## Output Files

Default directory: `tmp/agent-product-curation`.

- `agent-product-curation.md`: human review table.
- `agent-product-curation.json`: full research evidence, payloads, duplicate matches and commit results.
- `agent-product-payloads.jsonl`: one `CreateCuratedProductInput` payload per line.

## Useful Commands

Dry run 100 products from a text file:

```bash
pnpm --filter @wudly/api catalog:agent:research -- --file tmp/products.txt --limit=100
```

Commit only after review:

```bash
pnpm --filter @wudly/api catalog:agent:import -- --file tmp/products.txt --limit=100
```

Commit while attributing products to an admin user:

```bash
pnpm --filter @wudly/api catalog:agent:import -- --file tmp/products.txt --created-by=USER_ID
```

Resolve duplicate soft-blocks only after reviewing candidates:

```bash
pnpm --filter @wudly/api catalog:agent:import -- --file tmp/products.txt --force-create
```

## Required Environment

Minimum for DB-backed dry runs and commits:

- `DATABASE_URL`
- `JWT_SECRET`

Recommended for useful research:

- `BRAVE_SEARCH_KEY`
- `ICECAT_USERNAME` / `ICECAT_API_TOKEN` for better EAN data.
- `GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID`, `BING_IMAGE_KEY`, or `BRAVE_SEARCH_KEY` for image discovery.

`OPENROUTER_API_KEY` may exist in the environment, but this workflow does not call it.