# @wudly/mobile

Die Wudly Android- (und iOS-) App. **Expo / React Native + Expo Router**, im selben
Monorepo wie Web und API. Teilt sich die Typen und Domain-Helfer aus
[`@wudly/shared`](../../packages/shared), damit App und Website exakt dasselbe
Backend-Contract und dieselbe „Verdict"-Designsprache sprechen.

## Was drin ist

| Bereich | Datei | Inhalt |
| --- | --- | --- |
| Check / Suche | [`app/(tabs)/index.tsx`](app/(tabs)/index.tsx) | Live-Suche (Katalog + Markt-Vorschläge), „Frisch im Katalog", Tiefensuche |
| Barcode-Scan | [`app/scan.tsx`](app/scan.tsx) | `expo-camera`, EAN → `resolveEan` → Produkt oder Auto-Anlage |
| Produkt-Detail | [`app/product/[id].tsx`](app/product/[id].tsx) | Verdict-Banner + Score-Ring, Insights, Aspekte, „Bewertungen anderswo", Specs, Erfahrungen |
| Rankings | [`app/(tabs)/rankings.tsx`](app/(tabs)/rankings.tsx) | Top Käufe / Fehlkäufe / Meist diskutiert |
| Ich / Auth | [`app/(tabs)/me.tsx`](app/(tabs)/me.tsx), [`app/login.tsx`](app/login.tsx) | Login/Registrierung, „Meine Produkte" |
| API-Client | [`src/lib/api.ts`](src/lib/api.ts) | Getyptes Mirror von `apps/web/src/lib/api.ts` |
| Theme | [`src/theme/`](src/theme) | Verdict-Farben (Light/Dark), Score-Ring, `rebuyVerdict` |

Die App zeigt auf die **deployte Prod-API**:
`https://wudly-api-production.up.railway.app/api`
(konfiguriert in [`app.json`](app.json) → `expo.extra.apiUrl`, gelesen in
[`src/lib/config.ts`](src/lib/config.ts)).

## Entwicklung

> ⚠️ **Diese Schritte sind erprobt** und umgehen drei Stolpersteine dieses
> Setups (Beckhoff-npm-Registry, Emulator↔Metro-Verbindung, JDK-Version). Bitte
> genau so ausführen.

### Variante A: Nativer Build auf Android-Emulator (empfohlen, am robustesten)

Expo Go macht in diesem Netzwerk Probleme (mehrere virtuelle Interfaces →
falsche Metro-IP). Der native Build auf dem Emulator ist zuverlässig.

```bash
# 1) Emulator starten (einmalig Name prüfen mit: emulator -list-avds)
"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd Pixel_9

# 2) In apps/mobile bauen + installieren. Wichtig:
#    - JAVA_HOME auf Android Studios JDK (21) — das globale Java 11 ist zu alt.
#    - npm-Registry auf npmjs zwingen — die globale .npmrc zeigt auf den
#      Beckhoff-Feed, der Expos Template-Downloads als HTML beantwortet
#      ("Unexpected token '<'"). pnpm nutzt das Projekt-.npmrc, expo prebuild NICHT.
cd apps/mobile
export JAVA_HOME="C:\\Program Files\\Android\\Android Studio\\jbr"
export PATH="$JAVA_HOME/bin:$PATH"
export npm_config_registry="https://registry.npmjs.org/"
npx expo run:android        # KEIN --device <name> (Matching schlägt auf Windows fehl)

# 3) Emulator <-> Metro verbinden, damit die App das JS-Bundle lädt:
adb reverse tcp:8081 tcp:8081
```

Beim ersten Mal dauert der Gradle-Build ~20 Min. Danach reicht `npx expo start`
(+ `adb reverse tcp:8081 tcp:8081`) und in der App „RR" zum Reload — ohne
Neu-Bauen.

### Variante B: Expo Go (nur wenn das Netzwerk mitspielt)

```bash
pnpm install
pnpm --filter @wudly/mobile dev -- --tunnel    # --tunnel umgeht die IP-Probleme
```

QR mit Expo Go scannen. Ohne `--tunnel` rät Expo bei mehreren Netzwerk-
Interfaces oft die falsche IP → „etwas ist schiefgelaufen". `--tunnel` braucht
`@expo/ngrok` (ist als devDependency drin).

> Kamera/Barcode funktioniert nur auf echtem Gerät oder Emulator mit Kamera,
> nicht im Web-Preview.

Typecheck:

```bash
pnpm --filter @wudly/mobile typecheck
```

## Android-Build (APK / AAB) via EAS

1. Einmalig: `npm i -g eas-cli` und `eas login`.
2. Projekt verknüpfen: `eas init` (legt die `projectId` an).
3. Build:

```bash
# Installierbare APK zum Testen / Sideloading
pnpm --filter @wudly/mobile build:apk      # eas build -p android --profile preview

# Play-Store-Bundle (.aab)
pnpm --filter @wudly/mobile build:aab      # eas build -p android --profile production
```

Build-Profile stehen in [`eas.json`](eas.json). Lokaler Build ohne EAS-Cloud:
`npx expo prebuild && cd android && ./gradlew assembleRelease`.

## Funktionsumfang

Die Nutzer-Flows der Webapp sind nachgebaut:

- **Check / Suche** (`app/(tabs)/index.tsx`) — Live-Suche, Markt-Vorschläge, Frisch im Katalog
- **Scan** (`app/scan.tsx`) — Barcode **und** Foto-Erkennung (`identify` → `fromPhoto`)
- **Produkt-Detail** (`app/product/[id]/index.tsx`) — Verdict, Insights, Aspekte,
  „Bewertungen anderswo", Specs, Erfahrungen, **Fragen & Antworten**, ähnliche Produkte
- **Erfahrung teilen** (`app/product/[id]/own.tsx`) — 4-Schritt-Wizard (`experiences.create`)
- **Frage stellen** (`app/product/[id]/ask.tsx`) — Composer mit KI-Vorschlägen (`questions.create`)
- **Rankings** (`app/(tabs)/rankings.tsx`) — Top Käufe / Fehlkäufe / Meist diskutiert
- **Mitteilungen / Inbox** (`app/(tabs)/inbox.tsx`) — meine Fragen, Fragen an mich, Aktivität
- **Vergleich** (`app/compare.tsx`) — bis zu 3 Produkte nebeneinander
- **Kategorie-Übersicht** (`app/category/[slug].tsx`) — Ø-Wiederkauf, Top, Flops, blinder Fleck
- **Showcase / Creator** (`app/showcases/[id].tsx`, `app/creator/[slug].tsx`) —
  vollständiger Block-Renderer + Disclosure-Badges; Teaser auf der Produktseite
- **Besitz melden** — „Nur zu meinen Produkten" auf der Produktseite (`ownership.create`)
- **Ich + Auth** (`app/(tabs)/me.tsx`, `app/login.tsx`) — Login, „Meine Produkte"

### Noch offen

- **Push-Benachrichtigungen**: Das Backend nutzt **Web-Push (VAPID)** —
  `endpoint` + `p256dh`/`auth`-Keys, ein Browser-Format. Native Apps brauchen
  Expo-Push/FCM-Tokens. Das erfordert einen **neuen Backend-Endpoint**
  (`/push/expo-subscribe`) + FCM-Versand serverseitig; bewusst **nicht**
  client-seitig vorgetäuscht. Die Inbox aktualisiert per Pull-to-Refresh / Fokus.
- **Showcase-Editor / Studio** (Creator-Self-Service zum Erstellen) — die App
  zeigt Showcases, erstellt sie aber nicht (wie im Web ein separater Studio-Bereich).

Beides hängt am getypten [`src/lib/api.ts`](src/lib/api.ts).

## ⚠️ Assets

`assets/*.png` sind aktuell **einfarbige 1024×1024-Platzhalter** (grünes Icon,
dunkler Splash), generiert von [`scripts/gen-assets.js`](scripts/gen-assets.js).
Echte 1×1-PNGs hatten Expos Icon-Pipeline (jimp) zum Absturz gebracht
(„Crc error … Jimp.parseBitmap"). Vor einem Store-Release durch echte
Marken-Grafiken ersetzen (Icon, Adaptive-Icon-Foreground, Splash).
