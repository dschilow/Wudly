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
  - api: `DATABASE_URL=${{Postgres-eNfg.DATABASE_URL}}`, `CORS_ORIGIN=<web-url>`, `JWT_SECRET`, `COOKIE_SECURE=true`, `NODE_ENV=production`, `AI_PROVIDER=openrouter`, `OPENROUTER_MODEL=google/gemini-3.1-flash-lite`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_TITLE=Wudly`
  - web: `NEXT_PUBLIC_API_URL=<api-url>/api`

### ⚠️ KI aktivieren (einziger offener manueller Schritt)

Die KI (OpenRouter / Gemini Flash 3.1 Lite) ist vollständig integriert, aber sie braucht den
**`OPENROUTER_API_KEY`** als Variable auf `wudly-api`. Ohne Key fällt alles automatisch auf die
deterministische Logik zurück (App bleibt voll funktionsfähig). Key setzen:

```bash
railway variables --service wudly-api --set "OPENROUTER_API_KEY=<dein-openrouter-key>"
# danach neu deployen (oder Railway re-deployt automatisch beim Var-Change):
railway up --service wudly-api --ci
```

Der Key liegt z. B. im Curio/Ideen-Railway-Projekt. (Hinweis: `railway run` injiziert ENV in dieser
Agent-Umgebung nicht in Subprozesse, daher konnte der Agent den Key nicht automatisch übertragen.)

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

### KI (OpenRouter / Gemini Flash 3.1 Lite)
`AiModule` stellt `AI_SERVICE` bereit; per `AI_PROVIDER` wird `OpenRouterAiService` (real) oder
`DummyAiService` (deterministisch) gewählt. **Alle KI-Ausgaben werden mit Zod validiert** und fallen
bei Fehler/fehlendem Key auf die Dummy-Logik zurück. Genutzt an 3 Stellen:
1. **Produkt-Insight-Summary** — `ProductInsightsService` generiert (im Hintergrund, fire-and-forget)
   eine Headline + „geeignet/ungeeignet"; persistiert auf `ProductInsightSnapshot.aiHeadline/aiSuitedFor/aiNotSuitedFor`,
   angezeigt als `AiInsightCard` auf der Produktseite.
2. **Freitext → Aspekte** — beim Anlegen einer Erfahrung mit Freitext extrahiert die KI Pro/Contra.
3. **Produktanlage** — Marke + Kategorie werden ergänzt, wenn der Nutzer sie leer lässt.

Client: `apps/api/src/ai/openrouter.client.ts` (Modell-Fallback, JSON-Mode, `reasoning: exclude`) —
gleiche Pattern wie das Curio-Projekt des Nutzers.

### Design (Frontend)
„Clean & Premium": Tailwind-v4-`@theme` (warm-neutrale Fläche, ein Indigo-Akzent, semantische Score-Farben),
**lucide-react**-Icons (keine Emojis mehr in der UI-Chrome), **motion** für dezente Animationen
(Score-Count-up via `ScoreRing`), gestaffelte Schatten/Radii für Tiefe. Reduced-motion wird respektiert.
Kernkomponenten: `LogoMark/LogoWord`, `ScoreRing`, `ProductCard`, `AiInsightCard`, `AspectList`,
`OptionGrid`, `AuthGate`, `Button/Card/Pill`, States, `Toast`.

> **Build-Hinweis:** Das `typecheck`-Script nutzt einen separaten `--tsBuildInfoFile`
> (`node_modules/.cache/tsc-typecheck.tsbuildinfo`), damit der `--noEmit`-Lauf nicht den
> Incremental-State von `nest build` vergiftet (sonst emittiert der Build nichts).

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

**Neu (2026-06-08) — Wudly Showcase (MVP-Kern):** Zweiter, klar getrennter Bereich für
professionelle Hersteller-/Creator-Inhalte. Produktregel umgesetzt: **Showcase-Inhalte fließen
NIE in Score oder Rankings** — die bleiben rein aus Signal-Daten.
- **Datenmodell** (Migration `20260608120000_add_showcase`): `ProfessionalProfile` (1:1 zu User,
  type CREATOR/INFLUENCER/BRAND/MERCHANT/TESTER, slug, paidPartnerships), `ProductShowcase`
  (productId+profileId, status DRAFT/PUBLISHED/ARCHIVED, `disclosureType`), `ShowcaseBlock`
  (type-spezifisches JSON `content`, sortOrder), `ProductTemplate` (kategoriebasiert, blocks JSON).
  Enums + Labels in `@wudly/shared` (`DISCLOSURE_META` = Werbekennzeichnungs-Metadaten).
- **Backend** `ShowcaseModule` (ein Modul: Profiles + Showcases + Blocks + Templates). Endpoints:
  `GET/POST/PATCH /profiles*`, `GET /products/:id/showcases`, `GET/POST/PATCH /showcases*`,
  `/showcases/:id/publish`, Block-CRUD + `reorder-blocks`, `GET /templates*`. Owner-Checks im Service.
- **Frontend**: `DisclosureBadge` (Pflicht-Transparenz, commercial→Akzent, frei/affiliate→Amber),
  `ShowcaseRenderer` (rendert alle Blocktypen), `ShowcaseCard` (Teaser). Neue Seiten
  `/creator/[slug]` (Profil) und `/showcases/[id]` (beide `robots: noindex`). Auf der Produktseite
  eigene **„Wudly Showcase"-Sektion** unter dem Signal, visuell getrennt.
- **Seed** (`seed-showcase.ts`, in Haupt-Seed eingehängt): 12 Kategorie-Templates, 3 Profile
  (INFLUENCER/BRAND/TESTER), 3 publizierte Demo-Showcases mit Blöcken. Login der Creator-Accounts:
  `<handle>@creators.wudly.app / wudly12345`.
- **Creator-Self-Service / Studio (2026-06-08, Teil 2)**: kompletter UI-Pfad zum Anlegen/Bearbeiten,
  unter `/studio` (Einstieg via „Creator-Studio"-Link in `/me`):
  - `/studio` — Hub: Onboarding-CTA (kein Profil) bzw. Profil-Status + eigene Showcases (Status-/
    Disclosure-Badges). Backend dafür neu: `GET /me/showcases` (alle eigenen, inkl. DRAFT).
  - `/studio/profil` — Profil anlegen/bearbeiten (Typ nur bei Anlage, Name, Bio, Website, Logo,
    Social-Links, „bezahlte Kooperationen"-Selbsterklärung), Verifizierung anfragen.
  - `/studio/neu` — Showcase erstellen: Produktsuche, Pflicht-Transparenzwahl (WUDLY_NATIVE
    ausgeschlossen), optional Kategorie-Vorlage → legt DRAFT an.
  - `/studio/showcases/[id]` — Block-Editor: 14 Blocktypen hinzufügen, typisierte Felder
    (Chips/Titel-Listen/FAQ/Specs/…), per Pfeil sortieren, löschen, Live-Vorschau, publish/verbergen.
  - Komponenten: `showcase/block-fields.ts` (Feld-Schema je Typ, im Gleichschritt mit dem Renderer),
    `showcase/BlockFormFields.tsx` (generisches Formular). builds/typecheck/lint grün.
- **Status**: builds/typecheck/lint/shared-Tests grün. Migration + Seed liefen in prod
  (Tabellen live, 12 Templates/3 Profile/3 Demo-Showcases via `seed-showcase-only.ts`). **Noch offen
  (bewusst, „danach"):** KI-Showcase-Generator, Creator-Listen, Kampagnen, Analytics,
  Produktseiten-Tab-Struktur.

**Neu (2026-06-03):**
- **In-App-Benachrichtigungen / Q&A-Loop** — neues `Notification`-Modell (Migration `20260603130000_add_notifications`,
  muss in prod per `prisma migrate deploy` laufen). Frage zu eigenem Produkt → alle Besitzer werden benachrichtigt;
  beantwortete Frage → Fragesteller; „Hilfreich" → Antwortgeber. Glocke im Header mit Badge (`/me/inbox`),
  „Fragen zu deinen Produkten"-Inbox mit Inline-Antwort. Endpoints unter `GET/PATCH /me/notifications*`.
  `NotificationsModule` ist `@Global` (kein Import-Zyklus mit Questions).
- **Produktbilder** — die bereits vorhandenen generierten Preview-SVGs werden jetzt überall als Thumbnail genutzt
  (neuer Endpoint `GET /products/:id/image`); Fallback-Helper `productThumbUrl` im Web. Keine grauen Boxen mehr.
- **KI-Frage-Vorschläge** — `AiService.suggestQuestions(productId)` (real: produktspezifisch via OpenRouter,
  Dummy: kuratierte `COMMON_QUESTIONS`). Endpoint `GET /products/:id/question-suggestions`, genutzt im Ask-Flow.
- **Share-Card / OG-Image** — `GET /products/:id/share.svg` (1200×630, Wiederkauf-Score), als OG/Twitter-Image
  in `generateMetadata` der Produktseite + `ShareButton` (Web Share API / Clipboard-Fallback).
- **Produktvergleich** — `/compare?ids=a,b[,c]` (Frontend-only, nutzt `GET /products/:id`), Suche/Auswahl,
  Side-by-side von Scores/Stärken/Schwächen mit „BEST"-Markierung. Einstieg über die Charts-Seite.
- **Fix:** ESLint-Flat-Config der Web-App registriert jetzt `@next/next`- und `react-hooks`-Plugins
  (vorher brach `pnpm lint` mit „rule not found"). Plus latente strict-mode-Fixes in `product-preview-svg.ts`.

**Bewusst nicht im MVP:** Amazon/TikTok/Instagram/Reddit-Scraping, Garantie-/Rückgabelogik, volle
Datenblätter, komplexes Variantenmanagement, Payment, echtes Affiliate, Native App.
Die Architektur blockiert keinen dieser Punkte.

**Mögliche nächste Schritte:** echte KI-Provider (OpenAI/Gemini/Anthropic) hinter `AI_SERVICE` einhängen,
Insight-Snapshots in Queue/Worker auslagern, pg_trgm/pgvector fürs Matching, OAuth/Magic-Link,
B2B-Dashboard, GitHub→Railway-Auto-Deploy, E2E-Tests (Playwright), Redis fürs Rate-Limiting.

Details: siehe `docs/architecture.md`, `docs/api.md`, `docs/deployment-railway.md`, `docs/product-concept.md`.
