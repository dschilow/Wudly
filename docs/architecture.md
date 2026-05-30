# Architektur

## Überblick

Wudly ist ein **pnpm-Monorepo** mit klar getrenntem Frontend und Backend, die unabhängig als
Container deploybar sind. Gemeinsame Verträge (Typen, Validierung, reine Domänenlogik) liegen in
einem geteilten Paket, damit Client und Server nie auseinanderdriften.

```
┌─────────────┐      REST /api      ┌──────────────┐      Prisma      ┌────────────┐
│  apps/web   │ ──────────────────▶ │   apps/api   │ ───────────────▶ │ PostgreSQL │
│  Next.js 15 │ ◀────────────────── │   NestJS 10  │ ◀─────────────── │            │
└─────────────┘   JSON DTOs/Zod     └──────────────┘                  └────────────┘
        │                                   │
        └───────────── @wudly/shared ───────┘   (Enums, Zod-Schemas, DTOs, Scoring, Insights, Normalize)
```

## Pakete

### `packages/shared`
Das Herzstück der Typsicherheit. Enthält **nur pures TypeScript** (kein I/O):
- `enums.ts` — Domänen-Enums (müssen mit `schema.prisma` synchron sein).
- `schemas.ts` — Zod-Schemas für alle Request-Bodies/Queries → daraus abgeleitete Input-Typen.
- `dto.ts` — Response-DTO-Shapes (handgeschrieben, entkoppelt von Prisma-Typen).
- `scoring.ts` — Wiederkauf-/Regret-/Unsure-Score (duration-gewichtet). **Unit-getestet.**
- `insights.ts` — Aggregation eines `ProductInsightSnapshot` (Aspekte zählen, „wish known", Zielgruppe).
- `normalize.ts` — Produktnamen-Normalisierung + Token-Similarity fürs Matching. **Unit-getestet.**
- `labels.ts` — deutsche Labels/Emojis/Optionen für die Flows.
- `ai.ts` — `AiService`-Interface (provider-agnostisch).

Wird als **CommonJS** gebaut, damit es sowohl von NestJS (CJS) als auch Next.js konsumiert werden kann.

### `packages/config`
Geteilte `tsconfig`-Presets (base/nest/next/library) und ESLint-Flat-Configs.

## Backend (`apps/api`)

Modulare NestJS-Architektur. **Schichten:**
- **Controller** — nur HTTP (Routing, Validierung via `ZodValidationPipe`, Guards). Keine Businesslogik.
- **Services** — Use Cases / Orchestrierung.
- **Prisma** — Datenzugriff (über `PrismaService`, global bereitgestellt).
- **Pure Logik** — in `@wudly/shared` (Scoring, Insights, Normalize), damit testbar und geteilt.

**Modul-Graph (azyklisch):** `Insights` und `ProductMatching` sind eigenständige Module.
`Experiences`/`Ownership`/`Admin` → importieren `Insights` (Snapshot-Neuberechnung).
`Products` → importiert `Insights`, `ProductMatching`, `Experiences`, `Questions` (für verschachtelte
Read-Routen wie `/products/:id/experiences`). Dadurch hängen Experiences/Questions **nicht** von Products ab.

**Querschnitt:**
- `HttpExceptionFilter` — einheitliches Fehler-Envelope (`ApiErrorDto`), mappt Prisma-Fehler (P2002→409, P2025→404, …).
- `RateLimitGuard` — In-Memory Fixed-Window (per Decorator `@RateLimit`), vorbereitet für Redis.
- `JwtAuthGuard` / `OptionalAuthGuard` / `RolesGuard` — Auth & Rollen.
- Security: `helmet`, CORS (credentials), HttpOnly-Cookie, ENV-Validierung beim Boot.

### Scoring-Logik

| Nutzungsdauer        | Gewicht |
| -------------------- | ------- |
| < 1 Woche            | 0.5 |
| 1–4 Wochen           | 0.7 |
| 1–6 Monate           | 1.0 |
| 6–12 Monate          | 1.3 |
| > 1 Jahr             | 1.5 |

- **Rebuy-Score** = Σ(rebuyValue × Gewicht) / Σ(Gewicht) × 100, mit YES=1.0, UNSURE=0.5, NO=0.0.
- **Regret-Score** = Σ(Gewicht der NO-Antworten, ×1.25 bei Mood REGRET/DEFECTIVE) / Σ(Gewicht) × 100 (cap 100).
- Ohne Erfahrungen sind die Scores `null` (UI zeigt Empty State statt irreführender 0).

### Produktmatching

1. Namen normalisieren (lowercase, Umlaute falten, Sonderzeichen weg, Whitespace kollabieren).
2. DB-Vorfilter via `ILIKE`/`contains` auf den distinktivsten Tokens.
3. In-Memory-Re-Ranking via Jaccard-Token-Similarity.

Schwellen: ≥ 0.85 = starkes Duplikat (Create wird soft-geblockt → „Meinst du…?"), ≥ 0.5 = Kandidat.
Beim erzwungenen Anlegen wird ein `AdminMergeCandidate` protokolliert. Später erweiterbar auf
`pg_trgm`/`pgvector`, ohne die Service-Signatur zu ändern.

### Insight-Snapshots

Nach jeder neuen Erfahrung wird der `ProductInsightSnapshot` **synchron** neu berechnet
(`ProductInsightsService.regenerate`). Die reine Aggregation liegt in `@wudly/shared`. Später leicht
in eine Queue/Worker auslagerbar — nur der Aufrufort ändert sich.

### KI

`AiModule` stellt `AI_SERVICE` (Token) bereit; im MVP `DummyAiService` (deterministisch, regelbasiert).
Echte Provider (OpenAI/Gemini/Anthropic/lokal) werden per Adapter über `AI_PROVIDER` eingehängt —
Businesslogik importiert nie einen Provider direkt.

## Frontend (`apps/web`)

Next.js App Router, **mobile-first**. `AppShell` = sticky `MobileHeader` + zentrierte Content-Spalte
+ fixe `BottomNavigation`. Server Components holen Daten (SSR/ISR mit `revalidate`); interaktive Flows
(Experience-Flow, Q&A, Auth) sind Client Components.

- **API-Client** (`lib/api-client.ts` + `lib/api.ts`): typisierter Fetch-Wrapper, sendet Cookies
  (`credentials: include`), wirft `ApiError` mit geparstem Envelope. Funktioniert server- und clientseitig.
- **Auth** (`lib/auth-context.tsx`): Client-Context, hydratisiert via `/auth/me`. Token kommt als
  HttpOnly-Cookie vom Backend.
- **Design-System**: Tailwind v4 `@theme` (Navy/Slate-Basis; Emerald=positiv, Rose=Regret, Amber=unsicher).
  Komponenten: `ScoreRing`, `ProductCard`, `AspectList`, `UsageDurationChart`, `ExperienceCard`,
  `QuestionCard`, `OptionGrid`, States (Empty/Loading/Error), `Toast`.

## Datenmodell (Prisma)

Kernentitäten: `User`, `Product` (+`ProductVariant`, `ProductIdentifier`, `ProductSource`, `ProductAlias`),
`Category` (+`CategoryAspect`), `Ownership`, `ExperienceReport` (+`ExperienceAspect`), `ProductQuestion`,
`ProductAnswer`, `ProductInsightSnapshot`, `Badge`/`UserBadge`, `AdminMergeCandidate`.
Enums spiegeln `@wudly/shared`. Varianten sind vorbereitet (Tabelle existiert, `variantId` optional),
im MVP-UI aber bewusst einfach gehalten.
