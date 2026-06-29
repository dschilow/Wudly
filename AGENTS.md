# Agent Notes

## Produkte aus dem Chat anlegen (empfohlen: Agent-recherchierter Import)

Wenn der Nutzer im Chat sagt „füge Produkt X hinzu" oder „lege die Top-3 von
Kategorie Y an", soll das Ergebnis **genauso vollständig** sein wie beim Anlegen
über die App (Specs, deutsche Beschreibung, Produktbild, externe Bewertungen mit
Quellen, positive/negative Erfahrungsthemen). Die App nutzt dafür OpenRouter
(Perplexity/Gemini). **Um Tokens zu sparen, übernimmt der Agent (aktuelles Chat-Agent-Modell) die
Recherche selbst** und schiebt das Ergebnis durch dieselbe Produktions-Pipeline.

### Pipeline der App (was nachgebaut wird)

Beim App-Import ruft `OpenRouterAiService` nacheinander:
1. `suggestProducts(query)` → echte Modellnamen + ggf. EAN
2. `researchProduct(name)` → Name, Marke, Kategorie, Specs, Beschreibung, Bild-/Produktseiten-Lead
3. `researchExternalConsensus(name, brand)` → Bewertungen, positive/negative Themen, Zusammenfassung, Quellen

Danach: validierter Bild-Hunt, EAN-Identifier, externe Ratings/Consensus
gespeichert, Owner-Insight-Snapshot. **All das macht `createCurated` weiterhin** —
nur die drei KI-Recherche-Schritte ersetzt das aktuelle Chat-Agent-Modell durch eigene Websuche.

### Ablauf

1. **Recherchieren (aktuelles Chat-Agent-Modell):** Pro Produkt selbst per Websuche herausfinden:
   - sauberer kanonischer Name + Marke + `categorySlug` (s. Liste unten)
   - deutsche, sachliche Beschreibung (kein Marketing)
   - bis ~8 zentrale technische Specs als `{label, value}`
   - echte externe Bewertungen mit **konkreter Quell-URL** (z. B. testberichte.de
     Note als `GRADE_DE` 0,5–6; Amazon-Sterne als `STARS` 0–5; Prozent als `PERCENT`)
   - 1–3 positive und 1–3 negative Erfahrungsthemen, jedes mit **≥2 Quell-URLs**
   - `productUrl` (offizielle Herstellerseite bevorzugt)
   - Bild: **keine** `imageUrl` raten — leer lassen, dann holt der validierte
     Hunt (Brave/Google/DuckDuckGo) automatisch ein echtes Foto. Nur setzen, wenn
     die URL nachweislich ein direktes Produktfoto ist.
2. **JSON schreiben:** Array im Schema `CreateCuratedProductInput`
   (`packages/shared/src/schemas.ts` → `createCuratedProductSchema`).
   Vorlage/Beispiel: `tmp/robot-vacuums.json`.
3. **Dry-Run (validiert, schreibt nichts):**
   ```bash
   pnpm --filter @wudly/api catalog:import:research -- --file tmp/<datei>.json
   ```
4. **Importieren:**
   ```bash
   pnpm --filter @wudly/api catalog:import:research -- --file tmp/<datei>.json --commit
   ```
   - Duplikate werden weich geblockt → mit `--force-create` erzwingen (nur wenn
     gewollt, z. B. zum Anreichern eines bestehenden Eintrags).
   - Existiert bereits ein **falscher** Eintrag (z. B. ein Akku statt des Roboters),
     erst den alten löschen (Nutzer fragen!), dann sauber neu importieren.

- Script: `apps/api/scripts/agent-product-import.ts`
- Pfad ist relativ zu `apps/api/` → Datei nach `apps/api/tmp/` legen (oder dort erzeugen).

### CategorySlugs (Prod, Stand 2026-06)

`akku-staubsauger`, `e-bike`, `kaffeevollautomat`, `kindersitz`, `laptop`,
`matratze`, `pv-speicher`, `saugroboter`, `smartphone`, `waermepumpe`,
`waschmaschine`. Aktuelle Liste: `SELECT slug FROM "Category"`.

### Direkt in die Prod-DB (Railway) importieren

Die App-DB ist eine eigene Railway-Postgres-Instanz (**nicht** die mit der
`DATABASE_PUBLIC_URL` aus dem Postgres-Default-Service — das ist eine leere DB).
Die richtige public URL kommt aus dem Service, dessen Passwort mit der
`DATABASE_URL` von `wudly-api` übereinstimmt (Service `Postgres-eNfg`):

```powershell
railway link --project wudly
# public URL des RICHTIGEN Postgres holen (Passwort muss zu wudly-api passen):
railway variables --service "Postgres-eNfg" --json | Select-String "DATABASE_PUBLIC_URL"

$env:DATABASE_URL = "postgresql://postgres:<pw>@switchback.proxy.rlwy.net:<port>/railway"
$env:JWT_SECRET = "prod-script-placeholder-not-used-xx"   # >=16 Zeichen, wird vom Script nicht genutzt
pnpm --filter @wudly/api catalog:import:research -- --file tmp/<datei>.json --commit
```

Hinweis: über die public Proxy-Verbindung kann ein Schritt mal kurz die DB-Verbindung
verlieren (z. B. der Insights-Snapshot). Das Produkt selbst wird trotzdem korrekt
angelegt; einfach mit dem Inspect-Vorgehen prüfen und ggf. den Eintrag erneut importieren.

---

## AI-Free Product Curation (Scraping-Fallback)

Älterer Pfad: scrapt Quellseiten automatisch statt Recherche des aktuellen Chat-Agent-Modells. Liefert
schwächere Daten (oft niedrige Scores, EAN-Treffer können Zubehör statt Produkt
sein). Nur nutzen, wenn der Agent-recherchierte Import oben nicht passt.

- Doku: `docs/agent-product-curation.md`
- Service: `apps/api/src/products/product-agent-curation.service.ts`
- CLI: `apps/api/scripts/agent-product-curation.ts`
- Dry run: `pnpm --filter @wudly/api catalog:agent:research -- --file tmp/products.txt`
- Commit: `pnpm --filter @wudly/api catalog:agent:import -- --file tmp/products.txt`

Default-Sicherheit überall: Dry-Run zuerst, keine Schreibvorgänge ohne `--commit`,
keine OpenRouter-Aufrufe in diesem Katalog-Workflow.

### tsx + NestJS DI (wichtig)

Beide Skripte booten den NestJS-Context über `tsx` (esbuild). esbuild emittiert
**kein** `emitDecoratorMetadata`, daher kann NestJS Konstruktor-Typen nicht
auflösen → jeder DI-Parameter in den Services braucht ein explizites
`@Inject(Token)`. Ist bereits flächendeckend gesetzt; bei neuen Services daran denken.
