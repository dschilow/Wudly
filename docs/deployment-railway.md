# Deployment auf Railway

Wudly läuft als **drei Services** im Railway-Projekt `wudly`:

| Service | Build | Start | Public URL |
| ------- | ----- | ----- | ---------- |
| `wudly-api`  | `apps/api/Dockerfile` | `docker-entrypoint.sh` (migrate + start) | `https://wudly-api-production.up.railway.app` |
| `wudly-web`  | `apps/web/Dockerfile` (Next standalone) | `node apps/web/server.js` | `https://wudly-web-production.up.railway.app` |
| `Postgres`   | Railway-Plugin | – | intern: `postgres-enfg.railway.internal:5432` |

Der Build-Kontext beider Dockerfiles ist der **Repo-Root** (Monorepo). Erzwungen wird der
Dockerfile-Build über die Service-Variable `RAILWAY_DOCKERFILE_PATH`.

---

## Variablen pro Service

### `wudly-api`
| Variable | Wert |
| -------- | ---- |
| `DATABASE_URL` | `${{Postgres-eNfg.DATABASE_URL}}` (Referenz) |
| `JWT_SECRET` | langer Zufallswert (`openssl rand -hex 48`) |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | `https://wudly-web-production.up.railway.app` |
| `COOKIE_SECURE` | `true` |
| `NODE_ENV` | `production` |
| `AI_PROVIDER` | `openrouter` |
| `OPENROUTER_API_KEY` | OpenRouter API-Key |
| `OPENROUTER_MODEL` | `google/gemini-3.1-flash-lite` |
| `OPENROUTER_SITE_URL` | `https://wudly-web-production.up.railway.app` |
| `OPENROUTER_APP_TITLE` | `Wudly` |
| `ICECAT_USERNAME` | optional, Open-Icecat-Account fÃ¼r offizielle EAN-Daten |
| `ICECAT_API_TOKEN` | optional |
| `GOOGLE_CSE_KEY` | optional, Google Programmable Search API-Key |
| `GOOGLE_CSE_ID` | optional, Programmable Search Engine ID |
| `VAPID_PUBLIC_KEY` | optional, Web-Push Public Key |
| `VAPID_PRIVATE_KEY` | optional, Web-Push Private Key |
| `VAPID_SUBJECT` | `mailto:hallo@wudly.app` |
| `RAILWAY_DOCKERFILE_PATH` | `apps/api/Dockerfile` |
| `PORT` | (von Railway gesetzt — der Code liest `process.env.PORT`) |

### `wudly-web`
| Variable | Wert |
| -------- | ---- |
| `NEXT_PUBLIC_API_URL` | `https://wudly-api-production.up.railway.app/api` |
| `NODE_ENV` | `production` |
| `RAILWAY_DOCKERFILE_PATH` | `apps/web/Dockerfile` |

> `NEXT_PUBLIC_API_URL` wird zur **Build-Zeit** in das Client-Bundle gebacken (das Dockerfile nimmt es
> als `ARG`). Nach einer Änderung dieser Variable muss `wudly-web` neu gebaut werden.

---

## Erstmaliges Setup (Railway CLI)

```bash
# Einloggen (öffnet den Browser)
railway login

# Projekt anlegen
railway init --name wudly

# Postgres-Plugin hinzufügen
railway add --database postgres

# Services anlegen (Variablen können direkt mitgegeben werden)
railway add --service wudly-api  --variables "NODE_ENV=production" --variables "JWT_SECRET=..." ...
railway add --service wudly-web  --variables "NODE_ENV=production"

# Domains generieren
railway domain --service wudly-api
railway domain --service wudly-web

# Cross-Service-Variablen setzen
railway variables --service wudly-api --set "CORS_ORIGIN=https://<web-domain>"
railway variables --service wudly-web --set "NEXT_PUBLIC_API_URL=https://<api-domain>/api"
railway variables --service wudly-api --set "RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile"
railway variables --service wudly-web --set "RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile"
```

## Deployen

```bash
railway up --service wudly-api --ci    # Backend (führt beim Start prisma migrate deploy aus)
railway up --service wudly-web --ci    # Frontend
```

Build-Logs live: `railway logs --service <name> --build`.
Laufzeit-Logs: `railway logs --service <name>`.

## Datenbank: Migration & Seed

- **Migrationen** laufen automatisch beim Start des API-Containers
  (`apps/api/docker-entrypoint.sh` → `prisma migrate deploy`).
- **Seed** (einmalig, optional) von lokal gegen die Railway-DB über den **öffentlichen** Proxy —
  ohne Credentials im Klartext anzuzeigen:

```bash
railway run --service "Postgres-eNfg" \
  sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" pnpm --filter @wudly/api prisma:seed'
```

> `railway run` injiziert standardmäßig die **internen** URLs (`*.railway.internal`), die nur innerhalb
> Railways erreichbar sind. Für lokale Einmal-Aktionen (Seed/Inspektion) nutzt man `DATABASE_PUBLIC_URL`.

## Healthcheck

`wudly-api` ist über `GET /api/health` prüfbar; in `apps/api/railway.json` als Healthcheck-Pfad hinterlegt.

## Troubleshooting

- **„No start command detected" / Railpack statt Docker:** `RAILWAY_DOCKERFILE_PATH` auf dem Service setzen.
- **„flag '--mount=type=cache' is missing the cacheKey prefix":** Railways Builder akzeptiert das
  BuildKit-Cache-Mount nicht — es ist aus den Dockerfiles entfernt.
- **API erreichbar, aber DB-Fehler:** prüfen, ob `DATABASE_URL` als `${{Postgres-….DATABASE_URL}}`-Referenz gesetzt ist.
- **CORS-Fehler im Browser:** `CORS_ORIGIN` (api) muss exakt der Web-Domain entsprechen, `COOKIE_SECURE=true` in prod.
