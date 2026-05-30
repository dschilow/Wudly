# Wudly

> **Würdest du es wieder kaufen?** — Echte Besitzer. Echte Nutzung. Bessere Käufe.

Wudly ist eine Plattform für echte Besitzermeinungen **nach echter Nutzung**. Statt Sterne-Inflation
zeigt Wudly **Wiederkauf-Score**, **Regret-Score**, häufige Stärken & Probleme, Langzeit­erfahrungen
und **Fragen an echte Besitzer** — erfassbar in **3 Klicks**, ganz ohne EAN oder Modellnummer.

**Live:** [wudly-web-production.up.railway.app](https://wudly-web-production.up.railway.app)

---

## Stack

| Bereich      | Technologie |
| ------------ | ----------- |
| Monorepo     | pnpm workspaces + Turborepo |
| Sprache      | TypeScript (überall) |
| Frontend     | Next.js 15 (App Router), React 19, Tailwind CSS v4 — mobile-first |
| Backend      | NestJS 10 (REST, Prefix `/api`) |
| Datenbank    | PostgreSQL + Prisma 6 |
| Validierung  | Zod (geteilt zwischen Front- und Backend) |
| Auth         | Credentials + JWT (HttpOnly-Cookie) |
| Tests        | Vitest (Unit + Integration) |
| Deployment   | Railway (Docker), 3 Services: web · api · postgres |

```
apps/
  web/    Next.js Frontend
  api/    NestJS Backend (+ Prisma schema, migrations, seed)
packages/
  shared/ Enums, Zod-Schemas, DTOs, Scoring/Insights/Normalize (pure, getestet)
  config/ geteilte tsconfig + ESLint
docs/     Architektur, API, Deployment, Produktkonzept
```

> Vollständiges Projekt-Briefing (Live-URLs, Login, Re-Deploy, nächste Schritte): **[`WUDLY.md`](./WUDLY.md)**

---

## Schnellstart (lokal)

**Voraussetzungen:** Node ≥ 20, pnpm ≥ 9 (`corepack enable`), Docker.

```bash
# 1. Abhängigkeiten installieren
pnpm install

# 2. Lokale PostgreSQL starten (Docker, Host-Port 5433)
pnpm docker:db:up

# 3. ENV-Dateien anlegen
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Datenbank migrieren + mit Demo-Daten befüllen
pnpm db:migrate
pnpm db:seed

# 5. Dev-Server starten
pnpm --filter @wudly/api dev      # http://localhost:4000/api
pnpm --filter @wudly/web dev      # http://localhost:3000
```

**Demo-Login:** `admin@wudly.app` / `admin12345` (Admin) · weitere Demo-User: `<name>@demo.wudly.app` / `wudly12345`

---

## Nützliche Befehle

| Befehl | Wirkung |
| ------ | ------- |
| `pnpm dev` | alle Apps im Dev-Modus (Turbo) |
| `pnpm build` | alles bauen |
| `pnpm test` | Vitest (shared + api) |
| `pnpm typecheck` | TypeScript-Check über alle Pakete |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Prisma-Migration (dev) |
| `pnpm db:seed` | Demo-Daten einspielen |
| `pnpm db:studio` | Prisma Studio |
| `pnpm docker:db:up` / `:down` | lokale Postgres starten/stoppen |

---

## Umgebungsvariablen

Siehe `apps/api/.env.example`, `apps/web/.env.example` und das Root-`.env.example`.

**Backend (`apps/api`):** `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`,
`COOKIE_SECURE`, `NODE_ENV`, `PORT`, `AI_PROVIDER`.

**Frontend (`apps/web`):** `NEXT_PUBLIC_API_URL` (inkl. `/api`).

Keine Secrets im Code. Das Backend validiert seine ENV beim Start (Zod) und verweigert sonst den Boot.

---

## Docker

```bash
# Images lokal bauen (Build-Kontext = Repo-Root)
docker build -f apps/api/Dockerfile -t wudly-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/api -t wudly-web .
```

Beide Dockerfiles sind Multi-Stage und monorepo-aware. Der API-Container führt beim Start
automatisch `prisma migrate deploy` aus (siehe `apps/api/docker-entrypoint.sh`).

---

## Deployment (Railway)

Drei Services im Projekt `wudly`: `wudly-web`, `wudly-api`, `Postgres`.
Deploy per Railway CLI:

```bash
railway up --service wudly-api --ci
railway up --service wudly-web --ci
```

Vollständige Anleitung inkl. Variablen und Domains: **[`docs/deployment-railway.md`](./docs/deployment-railway.md)**.

---

## Lizenz

Privates Projekt. Alle Rechte vorbehalten.
