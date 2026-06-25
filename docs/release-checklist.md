# Wudly — Release-Checkliste

Stand: 2026-06-25. Was vor dem öffentlichen Launch erledigt sein muss, gegliedert
nach Blocker / Soll / Strategie. Code-Fixes dieser Runde sind unten unter
„Erledigt" gelistet.

---

## 🔴 Harte Blocker (Launch ohne diese ist riskant)

### 1. Produktions-Daten bereinigen (synthetische Seed-Produkte)
Die Prod-DB enthält synthetische Produkte mit IDs `runtime_seed_product_*`
(„Apple Phone One 82G", „Miele Care Max 71H", „Xiaomi Phone Air …"). Sie tragen
**erfundene Aggregat-Zahlen ohne echte Bewertungs-Rows** — Suche/Liste zeigen
„6 von 6 würden wieder kaufen", die Detailseite zeigt 0. Für eine App, deren
Versprechen „echte, keine Fake-Bewertungen" ist, ein Vertrauens-Killer.

**Vorgehen (in dieser Reihenfolge):**
```bash
# 1. Trockenlauf — zeigt nur an, was gelöscht würde
SEED_USE_PUBLIC_DATABASE_URL=true DATABASE_PUBLIC_URL=<prod-public-url> \
  pnpm --filter @wudly/api cleanup:seed

# 2. Wirklich löschen (alle Kind-Rows cascaden mit)
SEED_USE_PUBLIC_DATABASE_URL=true DATABASE_PUBLIC_URL=<prod-public-url> \
  pnpm --filter @wudly/api cleanup:seed -- --apply

# 3. Alle Snapshots aus echten Rows neu berechnen → Liste & Detail stimmen überein
SEED_USE_PUBLIC_DATABASE_URL=true DATABASE_PUBLIC_URL=<prod-public-url> \
  pnpm --filter @wudly/api resync:snapshots
```
> Vor Schritt 2 ein DB-Backup/Snapshot in Railway anlegen.

### 2. Passwort-Reset fehlt
Es gibt nur `register / login / logout / me`. Wer das Passwort vergisst, ist
dauerhaft ausgesperrt — bei einem Account-pflichtigen Beitrags-Flow inakzeptabel.
Benötigt: „Passwort vergessen"-Flow (Token + E-Mail-Versand). Setzt E-Mail-Infra
voraus (Resend/Postmark o. Ä.). **Noch nicht gebaut — bitte freigeben.**

### 3. Rechtsseiten (DE-Pflicht)
Kein Impressum, keine Datenschutzerklärung, keine AGB. Für eine öffentliche,
kommerzielle Web-App in Deutschland gesetzlich vorgeschrieben (§5 DDG,
DSGVO Art. 13) — Launch ohne diese = Abmahnrisiko. Routen `/impressum`,
`/datenschutz` (+ Footer-Links) müssen vor Launch live sein. Inhalt braucht echte
Firmen-/Kontaktdaten — **kann ich auf Zuruf gerüstet anlegen, sobald die Angaben da sind.**

---

## 🟠 Soll (Qualität / Vertrauen)

- **Cold-Start-Aha-Moment:** Aktuell sagt jedes Produkt „Zu früh / Noch offen",
  Entdecken ist leer. Ein Erstbesucher erlebt nie eine belastbare Zahl. Lösung:
  10–20 reale Hero-Produkte über die Schwelle (`EARLY_SIGNAL_MIN_EXPERIENCES = 20`)
  bringen — mit **echten** Bewertungen (Beta-Tester/Bekannte), nicht synthetisch.
- **Social-/Magic-Link-Login** erwägen (Google/Apple) — E-Mail+Passwort ist für
  Consumer spürbare Reibung.
- **`@types/react`-Versions-Skew** im Monorepo: `tsc --noEmit` lokal (Windows)
  wirft ~80 `TS2786/2322`-Fehler aus doppelten `@types/react`. Der Linux-Docker-Build
  dedupet sauber (Live-Deploy läuft), aber `next build` ignoriert Typfehler **nicht** —
  Skew vor Release dedupen (pnpm overrides auf eine `@types/react`-Version), sonst
  kann ein echter Typfehler unbemerkt den Deploy brechen.

---

## ✅ In dieser Runde erledigt (Code, typecheck/lint-sauber)

| Fix | Datei |
| --- | --- |
| „100 %"-Score neben „Zu wenige Bewertungen" unterdrückt (Early-Signal-Gate) | `apps/web/src/app/check/CheckClient.tsx` |
| Login-Wand beim Bewerten entfernt — Wizard zuerst, Login erst beim Speichern, Draft überlebt den Login-Umweg und sendet automatisch ab | `apps/web/src/app/products/[id]/own/OwnExperienceFlow.tsx` |
| „Danke"-Screen: personalisiert + Retention-CTAs (weiteres Produkt, Kaufprofil) | `OwnExperienceFlow.tsx` |
| Gleicher Neutral-Aspekt nicht mehr gleichzeitig in „gefällt" und „nervt" wählbar | `OwnExperienceFlow.tsx` |
| `/register` → Redirect auf `/login?mode=register` (kein 404 mehr) | `apps/web/src/app/register/page.tsx`, `login/LoginClient.tsx` |
| Entdecken: kein doppelter Empty-State (Liste **und** „Noch keine Tendenz") | `apps/web/src/app/rankings/RankingsClient.tsx` |
| DB-Tooling: `cleanup:seed` (Dry-run by default) + `resync:snapshots` | `apps/api/prisma/cleanup-seed.ts`, `resync-snapshots.ts` |

---

## Deploy-Reihenfolge

1. Code-Fixes mergen & deployen (Web + API).
2. Prod-DB-Backup anlegen.
3. `cleanup:seed --apply` → `resync:snapshots` (siehe Blocker 1).
4. Rechtsseiten + Passwort-Reset live (Blocker 2 & 3).
5. Hero-Produkte mit echten Bewertungen seeden (Soll: Cold-Start).
6. Smoke-Test: Suche realer Produktnamen, Bewerten als neuer User, Entdecken, Mobile.
