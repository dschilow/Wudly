# WUDLY.md — Projekt-Briefing für jede neue Session

> Dieses Dokument ist die **Single Source of Truth** für den Stand der App. Lies es zuerst,
> wenn du (Mensch oder KI-Agent) eine neue Session zu Wudly beginnst.

---

## 1. Was ist Wudly?

**Wudly** ist eine Plattform für **echte Besitzermeinungen nach echter Nutzung**.
Die zentrale Frage zu jedem Produkt: **„Würdest du es wieder kaufen?"**

Claim: **„Würdest du es wieder kaufen?"** · Unterzeile: **„Echte Besitzer. Echte Nutzung. Bessere Käufe."**

Es ist **bewusst keine** klassische Sterne-Bewertungsplattform und **kein** Garantie-/Rückgabe-/
Datenblatt-Manager. Der Fokus liegt auf:

- **Wiederkauf-Score** (würden Besitzer es wieder kaufen?)
- **Regret-Score** (Fehlkauf-Quote)
- **3-Klick-Erfahrungen** (kein langes Formular, keine EAN/Modellnummer nötig)
- **Fragen an echte Besitzer**
- strukturierte, vergleichbare, auswertbare Erfahrungen

---

## 2. Live-Deployment (Railway)

Projekt **`wudly`** auf Railway (Workspace „dschilow's Projects"), 3 Services:

| Service        | Beschreibung                       | URL |
| -------------- | ---------------------------------- | --- |
| `wudly-web`    | Next.js Frontend (Standalone)      | https://wudly-web-production.up.railway.app |
| `wudly-api`    | NestJS Backend (Prefix `/api`)     | https://wudly-api-production.up.railway.app/api |
| `Postgres`     | Railway-managed PostgreSQL         | intern: `postgres-enfg.railway.internal` |

- Health: `GET /api/health` → `{"status":"ok","db":"up"}`
- Deploy erfolgt per **Railway CLI** (`railway up --service <name> --ci`). CLI ist auf der
  Dev-Maschine eingeloggt (`d.schilow@gmx.net`). **Kein** GitHub-Repo nötig (direct upload).
- Builds nutzen die **Dockerfiles** (erzwungen via Service-Variable `RAILWAY_DOCKERFILE_PATH`).
- Cross-Service-Variablen sind gesetzt:
  - api: `DATABASE_URL=${{Postgres-eNfg.DATABASE_URL}}`, `CORS_ORIGIN=<web-url>`, `JWT_SECRET`, `COOKIE_SECURE=true`, `NODE_ENV=production`, `AI_PROVIDER=dummy`
  - web: `NEXT_PUBLIC_API_URL=<api-url>/api`

**Demo-Login (geseedet):** `admin@wudly.app` / `admin12345` (Admin) · Demo-User: `<handle>@demo.wudly.app` / `wudly12345`.

### Re-Deploy

```bash
railway up --service wudly-api --ci    # Backend
railway up --service wudly-web --ci    # Frontend
```

### Produktions-DB seeden (ohne Credentials zu zeigen)

```bash
railway run --service "Postgres-eNfg" sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" pnpm --filter @wudly/api prisma:seed'
```

---

## 3. Architektur & Stack

Monorepo (**pnpm workspaces**), TypeScript überall.

```
apps/
  api/   NestJS 10 + Prisma 6 + PostgreSQL  (REST, Prefix /api)
  web/   Next.js 15 (App Router) + React 19 + Tailwind v4  (mobile-first)
packages/
  shared/  Enums, Zod-Schemas, DTOs, Scoring/Insights/Normalize (pure, getestet)
  config/  geteilte tsconfig + ESLint flat configs
```

- **Auth:** Credentials (E-Mail+Passwort) → JWT in **HttpOnly-Cookie** (auch via Bearer-Header).
- **Validierung:** Zod (Schemas in `@wudly/shared`, im Backend via `ZodValidationPipe`).
- **`@wudly/shared` wird als CommonJS gebaut**, damit es sowohl Nest (CJS) als auch Next nutzen kann.
- **Wichtig:** Die Enums in `packages/shared/src/enums.ts` müssen mit
  `apps/api/prisma/schema.prisma` synchron bleiben.

### Backend-Module
`Auth, Users, Categories, Products, ProductMatching, Insights, Experiences, Questions, Ownership, Rankings, Admin, Health, Ai`.
Controller = nur HTTP. Services = Use Cases. Reine Logik (Scoring/Matching/Insights) liegt in `@wudly/shared`.

### Scoring (duration-gewichtet, in `@wudly/shared`)
Gewichte nach Nutzungsdauer: `<1 Woche=0.5`, `1–4 Wochen=0.7`, `1–6 Monate=1.0`, `6–12 Monate=1.3`, `>1 Jahr=1.5`.
Rebuy = gewichteter Mittelwert (YES=1, UNSURE=0.5, NO=0) ×100. Regret = gewichteter NO-Anteil, ×1.25 bei Mood REGRET/DEFECTIVE.

---

## 4. Lokale Entwicklung

```bash
# 1. Abhängigkeiten (öffentliche npm-Registry ist via projekt-.npmrc erzwungen)
pnpm install

# 2. Lokale Postgres (Docker) — Host-Port 5433
pnpm docker:db:up

# 3. Schema + Seed
pnpm db:migrate      # bzw. db:migrate:deploy in prod
pnpm db:seed

# 4. Dev-Server (in zwei Terminals oder via turbo)
pnpm --filter @wudly/api dev      # http://localhost:4000/api
pnpm --filter @wudly/web dev      # http://localhost:3000

# Tests / Checks
pnpm test         # Vitest (shared: 27 Tests, api: 9 Integrationstests)
pnpm typecheck
pnpm lint
```

`.env`-Vorlagen: `apps/api/.env.example`, `apps/web/.env.example`, Root `.env.example`.

> **Registry-Hinweis:** Die globale `~/.npmrc` des Nutzers zeigt auf eine Firmen-Registry
> (Beckhoff Azure DevOps), die öffentliche Pakete nicht liefert. Das Projekt-`.npmrc`
> überschreibt das auf `registry=https://registry.npmjs.org/`. **Nicht entfernen.**

---

## 5. Stand & nächste sinnvolle Schritte

**Fertig (MVP, live):** Auth, Produktsuche+Matching (Dedupe/„Meinst du…?"), 3-Klick-Erfahrungsflow,
Wiederkauf-/Regret-Score + Snapshots, Fragen & Antworten (+Hilfreich), Top&Flop-Rankings (inkl. Kategorie),
Profil, Admin-Merge-Kandidaten, AI-Stub (`DummyAiService` hinter `AiService`-Interface), Dockerized, auf Railway live.

**Bewusst nicht im MVP:** Amazon/TikTok/Instagram/Reddit-Scraping, Garantie-/Rückgabelogik, volle
Datenblätter, komplexes Variantenmanagement, Payment, echtes Affiliate, Native App.
Die Architektur blockiert keinen dieser Punkte.

**Mögliche nächste Schritte:** echte KI-Provider (OpenAI/Gemini/Anthropic) hinter `AI_SERVICE` einhängen,
Insight-Snapshots in Queue/Worker auslagern, pg_trgm/pgvector fürs Matching, OAuth/Magic-Link,
B2B-Dashboard, GitHub→Railway-Auto-Deploy, E2E-Tests (Playwright), Redis fürs Rate-Limiting.

Details: siehe `docs/architecture.md`, `docs/api.md`, `docs/deployment-railway.md`, `docs/product-concept.md`.
