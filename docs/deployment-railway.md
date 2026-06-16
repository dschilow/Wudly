# Deployment auf Railway

Wudly laeuft als regulaere Services im Railway-Projekt `wudly`. Optional kommen
separate Gemma-Test-Services dazu:

| Service | Build | Start | Public URL |
| ------- | ----- | ----- | ---------- |
| `wudly-api` | `apps/api/Dockerfile` | `docker-entrypoint.sh` (migrate + start) | `https://wudly-api-production.up.railway.app` |
| `wudly-web` | `apps/web/Dockerfile` (Next standalone) | `node apps/web/server.js` | `https://wudly-web-production.up.railway.app` |
| `wudly-gemma` | `apps/gemma/Dockerfile` (Ollama) | `start-ollama.sh` | intern: Ollama API, Gemma 4 E4B |
| `wudly-gemma-e2b` | `apps/gemma/Dockerfile` (Ollama) | `start-ollama.sh` | intern: Ollama API, Gemma 4 E2B |
| `Postgres` | Railway-Plugin | - | intern: `postgres-enfg.railway.internal:5432` |

Der Build-Kontext der Dockerfiles ist der Repo-Root (Monorepo). Erzwungen wird
der Dockerfile-Build ueber die Service-Variable `RAILWAY_DOCKERFILE_PATH`.

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
| `PORT` | von Railway gesetzt |
| `AI_PROVIDER` | `openrouter` oder fuer Gemma-Test `ollama` |
| `OPENROUTER_API_KEY` | OpenRouter API-Key, nur bei `AI_PROVIDER=openrouter` |
| `OPENROUTER_MODEL` | `google/gemini-3.1-flash-lite` |
| `OPENROUTER_SITE_URL` | `https://wudly-web-production.up.railway.app` |
| `OPENROUTER_APP_TITLE` | `Wudly` |
| `OLLAMA_BASE_URL` | nur bei Gemma-Test: `http://wudly-gemma.railway.internal:11434` oder `http://wudly-gemma-e2b.railway.internal:11434` |
| `OLLAMA_MODEL` | nur bei Gemma-Test: `gemma4:e4b` oder `gemma4:e2b` |
| `OLLAMA_2B_BASE_URL` | nur fuer `/ki-test`-Playground: `http://wudly-gemma-e2b.railway.internal:11434` |
| `OLLAMA_2B_MODEL` | nur fuer `/ki-test`-Playground: `gemma4:e2b` |
| `ICECAT_USERNAME` | optional, Open-Icecat-Account |
| `ICECAT_API_TOKEN` | optional |
| `GOOGLE_CSE_KEY` / `GOOGLE_CSE_ID` | optional, Google Programmable Search |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | optional, Web Push |
| `RAILWAY_DOCKERFILE_PATH` | `apps/api/Dockerfile` |

### `wudly-web`

| Variable | Wert |
| -------- | ---- |
| `NEXT_PUBLIC_API_URL` | `https://<api-domain>/api` |
| `NODE_ENV` | `production` |
| `RAILWAY_DOCKERFILE_PATH` | `apps/web/Dockerfile` |

`NEXT_PUBLIC_API_URL` wird zur Build-Zeit in das Client-Bundle gebacken. Nach
einer Aenderung dieser Variable muss `wudly-web` neu gebaut werden.

### `wudly-gemma` (optional, Gemma 4 E4B Test)

| Variable | Wert |
| -------- | ---- |
| `GEMMA_MODEL` | `gemma4:e4b` |
| `OLLAMA_KEEP_ALIVE` | `30m` |
| `PORT` | `11434` |
| `RAILWAY_DOCKERFILE_PATH` | `apps/gemma/Dockerfile` |

Empfohlen: Railway Volume auf `/root/.ollama` mounten, sonst wird `gemma4:e4b`
bei jedem frischen Deploy neu geladen. Das Ollama-Modell ist ca. 9.6 GB gross;
plane fuer den Service mindestens grob 12-16 GB RAM ein, je nach Context/Last.

### `wudly-gemma-e2b` (optional, Gemma 4 E2B Test)

| Variable | Wert |
| -------- | ---- |
| `GEMMA_MODEL` | `gemma4:e2b` |
| `OLLAMA_KEEP_ALIVE` | `30m` |
| `PORT` | `11434` |
| `RAILWAY_DOCKERFILE_PATH` | `apps/gemma/Dockerfile` |

Empfohlen: eigene Railway Volume auf `/root/.ollama` mounten. So koennen E4B
und E2B parallel laufen und ihre Modellgewichte getrennt cachen.

---

## Erstmaliges Setup (Railway CLI)

```bash
railway login
railway init --name wudly
railway add --database postgres

railway add --service wudly-api --variables "NODE_ENV=production" --variables "JWT_SECRET=..."
railway add --service wudly-web --variables "NODE_ENV=production"
railway add --service wudly-gemma --variables "GEMMA_MODEL=gemma4:e4b" --variables "PORT=11434"
railway add --service wudly-gemma-e2b --variables "GEMMA_MODEL=gemma4:e2b" --variables "PORT=11434"

railway domain --service wudly-api
railway domain --service wudly-web

railway variables --service wudly-api --set "CORS_ORIGIN=https://<web-domain>"
railway variables --service wudly-web --set "NEXT_PUBLIC_API_URL=https://<api-domain>/api"
railway variables --service wudly-api --set "RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile"
railway variables --service wudly-web --set "RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile"
railway variables --service wudly-gemma --set "RAILWAY_DOCKERFILE_PATH=apps/gemma/Dockerfile"
railway variables --service wudly-gemma-e2b --set "RAILWAY_DOCKERFILE_PATH=apps/gemma/Dockerfile"
```

## Gemma 4 E4B und E2B testen

1. Gewuenschtes Modell-Service deployen:

```bash
railway up --service wudly-gemma --ci
railway up --service wudly-gemma-e2b --ci
```

2. `wudly-api` temporaer auf E4B umstellen:

```bash
railway variables --service wudly-api --set "AI_PROVIDER=ollama"
railway variables --service wudly-api --set "OLLAMA_MODEL=gemma4:e4b"
railway variables --service wudly-api --set "OLLAMA_BASE_URL=http://wudly-gemma.railway.internal:11434"
railway up --service wudly-api --ci
```

Oder temporaer auf E2B:

```bash
railway variables --service wudly-api --set "AI_PROVIDER=ollama"
railway variables --service wudly-api --set "OLLAMA_MODEL=gemma4:e2b"
railway variables --service wudly-api --set "OLLAMA_BASE_URL=http://wudly-gemma-e2b.railway.internal:11434"
railway up --service wudly-api --ci
```

3. Live pruefen:

```bash
curl "https://<api-domain>/api/health/ai?test=1"
```

Wichtig: Der Ollama-Pfad hat keine Websuche. Wudly-Funktionen, die `online: true`
nutzen (`researchProduct`, `suggestProducts`, `researchExternalRatings`), fallen
automatisch auf den Dummy-/Fallback-Pfad zurueck. Fuer den Vergleich mit Gemini
sind vor allem Produktnormalisierung, Erfahrungstext-Normalisierung, Fragevorschlaege
und AI-Zusammenfassungen aussagekraeftig.

## Admin-Playground `/ki-test`

Die Seite `/ki-test` (nur fuer ADMIN sichtbar) ruft alle drei Modelle direkt auf
(OpenRouter Flash Lite, Gemma 4B, Gemma 2B) und misst Latenz, Tokens und tok/s.
Sie ist **unabhaengig** von `AI_PROVIDER` — `AI_PROVIDER=openrouter` kann fuer die
App aktiv bleiben. Auf `wudly-api` setzen, damit alle drei Ziele funktionieren:

```bash
railway variables --service wudly-api --set "OPENROUTER_API_KEY=..."
railway variables --service wudly-api --set "OLLAMA_BASE_URL=http://wudly-gemma.railway.internal:11434"
railway variables --service wudly-api --set "OLLAMA_MODEL=gemma4:e4b"
railway variables --service wudly-api --set "OLLAMA_2B_BASE_URL=http://wudly-gemma-e2b.railway.internal:11434"
railway variables --service wudly-api --set "OLLAMA_2B_MODEL=gemma4:e2b"
```

## Fehlersuche: Gemma antwortet nicht / Timeout

Laeuft Flash Lite, aber Gemma 4B/2B laufen in eine Zeitueberschreitung, ist fast
immer das **IPv6-Binding** schuld. Railways Private Network (`*.railway.internal`)
ist **IPv6-only** — Ollama muss auf `[::]` lauschen, nicht auf `0.0.0.0`. Das
uebernimmt `apps/gemma/start-ollama.sh` (`OLLAMA_HOST=[::]:${PORT}`); nach einem
Deploy mit dieser Aenderung muessen `wudly-gemma` **und** `wudly-gemma-e2b` neu
gebaut werden.

Weitere Checks:

- `OLLAMA_BASE_URL`/`OLLAMA_2B_BASE_URL` zeigen auf den richtigen Service und Port `11434` (= `PORT` der Gemma-Services).
- Beide Gemma-Services laufen im **selben Projekt/Environment** wie `wudly-api` (sonst kein Private Network).
- Erster Aufruf nach Deploy/Leerlauf ist langsam (CPU Cold Start, bis ~1-3 Min); danach haelt `OLLAMA_KEEP_ALIVE=30m` das Modell warm.
- Logs: `railway logs --service wudly-gemma` — die Zeile `Ollama is serving ... on [::]:11434` bestaetigt das IPv6-Binding.

## Deployen

```bash
railway up --service wudly-api --ci
railway up --service wudly-web --ci
railway up --service wudly-gemma --ci
railway up --service wudly-gemma-e2b --ci
```

Build-Logs live: `railway logs --service <name> --build`.
Laufzeit-Logs: `railway logs --service <name>`.

## Datenbank: Migration & Seed

Migrationen laufen automatisch beim Start des API-Containers
(`apps/api/docker-entrypoint.sh` -> `prisma migrate deploy`).

Seed einmalig, optional, von lokal gegen die Railway-DB ueber den oeffentlichen
Proxy:

```bash
railway run --service "Postgres-eNfg" \
  sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" pnpm --filter @wudly/api prisma:seed'
```

`railway run` injiziert standardmaessig interne URLs (`*.railway.internal`), die
nur innerhalb Railways erreichbar sind. Fuer lokale Einmal-Aktionen nutzt man
`DATABASE_PUBLIC_URL`.

## Healthcheck

`wudly-api` ist ueber `GET /api/health` pruefbar.
Der AI-Status ist ueber `GET /api/health/ai` sichtbar; mit `?test=1` wird ein
Live-Probe gegen OpenRouter oder Ollama ausgefuehrt.

## Troubleshooting

- "No start command detected" / Railpack statt Docker: `RAILWAY_DOCKERFILE_PATH` auf dem Service setzen.
- API erreichbar, aber DB-Fehler: pruefen, ob `DATABASE_URL` als `${{Postgres-....DATABASE_URL}}`-Referenz gesetzt ist.
- CORS-Fehler im Browser: `CORS_ORIGIN` muss exakt der Web-Domain entsprechen, `COOKIE_SECURE=true` in Produktion.
- Gemma-Services starten langsam: erster Start laedt das jeweilige Modell; ein Volume auf `/root/.ollama` vermeidet erneute Downloads.
- `GET /api/health/ai?test=1` kann bei Ollama lange blockieren, weil es das Modell wirklich laedt. Fuer UI-kritische Pfade lieber konkrete Endpunkte mit eigenem Timeout testen.
