# API-Referenz

Base-URL: `<host>/api` (z. B. `https://wudly-api-production.up.railway.app/api`).
Alle Bodies/Antworten sind JSON. Schreibende Endpunkte erfordern Auth (JWT als HttpOnly-Cookie
`wudly_token` **oder** `Authorization: Bearer <token>`). Validierung via Zod; Fehler kommen als
einheitliches Envelope:

```json
{ "statusCode": 400, "error": "Validation Failed", "message": ["password: Mindestens 8 Zeichen"],
  "path": "/api/auth/register", "timestamp": "2026-05-30T06:00:00.000Z" }
```

## Auth

| Methode | Pfad | Auth | Beschreibung |
| ------- | ---- | ---- | ------------ |
| POST | `/auth/register` | – | `{ email, password, displayName? }` → setzt Cookie, gibt `{ user, accessToken }` |
| POST | `/auth/login` | – | `{ email, password }` → setzt Cookie, gibt `{ user, accessToken }` |
| POST | `/auth/logout` | – | löscht das Cookie |
| GET  | `/auth/me` | ✅ | aktueller Benutzer |

## Kategorien

| Methode | Pfad | Beschreibung |
| ------- | ---- | ------------ |
| GET | `/categories` | alle Kategorien |
| GET | `/categories/aspects` | Aspekt-Vokabular je Kategorie-Slug (für den Erfahrungsflow) |

## Produkte

| Methode | Pfad | Auth | Beschreibung |
| ------- | ---- | ---- | ------------ |
| GET | `/products?take&skip` | – | paginierte Liste aktiver Produkte |
| GET | `/products/search?q=&take=` | – | Namenssuche (normalisiert + Similarity-Ranking) |
| GET | `/products/:id` | – | Produktdetail inkl. Insights |
| GET | `/products/:id/insights` | – | nur die Insights (Scores, Aspekte, Nutzungsdauer, Zielgruppe) |
| GET | `/products/:id/experiences` | – | öffentliche Erfahrungen |
| GET | `/products/:id/questions` | – | Fragen + Antworten |
| POST | `/products` | ✅ | Produkt anlegen/vorschlagen. Bei Duplikatverdacht **kein** Create, sondern Kandidaten |
| PATCH | `/products/:id` | ✅ | Produkt aktualisieren |

**`POST /products` Antwort** ist eine Union:
```json
// angelegt:
{ "created": true, "product": { ...ProductDetail } }
// Duplikatverdacht ("Meinst du…?"):
{ "created": false, "reason": "possible_duplicates",
  "candidates": [ { "product": { ...ProductSummary }, "similarity": 0.75 } ] }
```
`{ "canonicalName": "...", "categorySlug?": "...", "brand?": "...", "forceCreate?": true }` — `forceCreate`
überspringt den Soft-Block.

## Ownership

| Methode | Pfad | Auth | Beschreibung |
| ------- | ---- | ---- | ------------ |
| POST | `/ownerships` | ✅ | `{ productId, variantId? }` — Besitz erklären (idempotent) |
| GET | `/me/ownerships` | ✅ | meine Produkte |

## Erfahrungen

| Methode | Pfad | Auth | Beschreibung |
| ------- | ---- | ---- | ------------ |
| POST | `/products/:id/experiences` | ✅ | Erfahrung anlegen → Snapshot wird neu berechnet |
| GET | `/me/experiences` | ✅ | meine Erfahrungen (inkl. privater) |

**Body:** `{ wouldBuyAgain: YES|NO|UNSURE, usageDuration: LESS_THAN_WEEK|ONE_TO_FOUR_WEEKS|ONE_TO_SIX_MONTHS|SIX_TO_TWELVE_MONTHS|MORE_THAN_YEAR, experienceMood: TOP_BUY|GOOD_DAILY_USE|OKAY|ANNOYING|DEFECTIVE|REGRET|SURPRISINGLY_GOOD, wishKnownText?, freeText?, isPublic, positiveAspects?: string[], negativeAspects?: string[], variantId? }`

## Fragen & Antworten

| Methode | Pfad | Auth | Beschreibung |
| ------- | ---- | ---- | ------------ |
| POST | `/products/:id/questions` | ✅ | `{ questionText }` |
| POST | `/questions/:id/answers` | ✅ | `{ answerText, quickAnswer? }` (YES/NO/MOSTLY/DEPENDS/UNSURE) |
| PATCH | `/answers/:id/helpful` | ✅ | Hilfreich-Zähler +1 |

## Rankings

| Methode | Pfad | Beschreibung |
| ------- | ---- | ------------ |
| GET | `/rankings/top-rebuy?take&minExperiences` | höchster Wiederkauf-Score |
| GET | `/rankings/top-regret?take&minExperiences` | höchster Regret-Score |
| GET | `/rankings/most-discussed?take&minExperiences` | meiste Erfahrungen |
| GET | `/rankings/category/:categorySlug?take&minExperiences` | Top nach Kategorie (Rebuy) |

## Profil

| Methode | Pfad | Auth | Beschreibung |
| ------- | ---- | ---- | ------------ |
| GET | `/me/profile` | ✅ | Kennzahlen (Produkte, Erfahrungen, Antworten, erhaltene Hilfreich-Stimmen) |

## Admin (Rolle ADMIN)

| Methode | Pfad | Beschreibung |
| ------- | ---- | ------------ |
| GET | `/admin/merge-candidates` | offene Merge-Kandidaten |
| POST | `/admin/merge-candidates/:id/merge` | Produkte zusammenführen (Daten von B → A, Alias, Snapshot neu) |
| POST | `/admin/merge-candidates/:id/reject` | Kandidat ablehnen |

## Health

| Methode | Pfad | Beschreibung |
| ------- | ---- | ------------ |
| GET | `/health` | `{ status, db, timestamp }` — für Railway-Healthcheck |

## Beispiel (cURL)

```bash
BASE=https://wudly-api-production.up.railway.app/api

# Login (Cookie speichern)
curl -s -c jar.txt -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@wudly.app","password":"admin12345"}'

# Erfahrung anlegen (ein Produkt-id aus der Suche nehmen)
PID=$(curl -s "$BASE/products/search?q=macbook" | grep -o '"id":"[^"]*"' | head -1 | sed 's/.*:"//;s/"//')
curl -s -b jar.txt -X POST "$BASE/products/$PID/experiences" -H "Content-Type: application/json" \
  -d '{"wouldBuyAgain":"YES","usageDuration":"MORE_THAN_YEAR","experienceMood":"TOP_BUY","isPublic":true}'
```
