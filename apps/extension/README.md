# Wudly Signal — Browser-Extension

Zeigt das Wudly-Urteil (Wiederkauf-Quote, Netz-Konsens) direkt auf Produktseiten
unterstützter Shops und meldet unbekannte Produkte anonym an die
Sighting-Pipeline der API (`POST /sightings`), die den Katalog nachfragegetrieben
und kostenbegrenzt aufbaut.

## Entwicklung

```bash
pnpm install
pnpm --filter @wudly/extension build     # einmalig → dist/
pnpm --filter @wudly/extension dev       # watch-Modus
```

Laden in Chrome/Edge: `chrome://extensions` → „Entwicklermodus" →
„Entpackte Erweiterung laden" → Ordner `apps/extension/dist` wählen.

Gegen die lokale API testen: Extension-Optionen öffnen („Für Entwickler") und
als API-URL `http://localhost:4000/api` eintragen.

## Architektur

- **Adapter** ([src/adapters/](src/adapters/)): JSON-LD (`schema.org/Product`)
  ist der primäre, redesign-feste Weg — er deckt MediaMarkt, Saturn, Otto,
  Kaufland, Cyberport, Alternate, Galaxus ab. Amazon liefert kein Produkt-JSON-LD
  und hat als einziger Shop einen DOM-Adapter (ASIN aus der URL).
- **Background-Worker** ([src/background.ts](src/background.ts)): einziger Ort
  mit Netzwerkzugriff; cached Ergebnisse pro Session, setzt das Toolbar-Badge
  (✓ bekannt, + in Aufnahme).
- **Overlay** ([src/overlay.ts](src/overlay.ts)): Shadow-DOM-Insel unten rechts;
  Pill → aufklappbare Verdict-Karte. Ein Klick zählt serverseitig als
  „engage" (starkes Nachfrage-Signal, zieht bezahlte Anreicherung vor).

## Troubleshooting: „Es wird nichts angezeigt"

1. **DevTools-Konsole der Shopseite** öffnen (F12): das Content-Script loggt
   `[Wudly Signal] detected …` (Produkt erkannt) und `resolution …` (API-Antwort).
   - Kein `detected`-Log → Adapter hat kein Produkt gefunden (kein/unerwartetes
     JSON-LD). Die Erkennung wiederholt sich bis ~13 s nach Seitenladen (SPAs).
   - `resolution null` → API nicht erreichbar **oder der `/sightings`-Endpoint
     ist dort noch nicht deployt** (die Extension bleibt dann bewusst stumm).
2. Nach Code-Änderungen: `pnpm --filter @wudly/extension build` und in
   `chrome://extensions` **neu laden** (↻) — sonst läuft das alte Bundle.
3. Shop-Eigenheiten: MediaMarkt verpackt das Produkt als `BuyAction` →
   `ProductGroup` (wird unterstützt); `hasVariant` (andere Größen) wird bewusst
   ignoriert, damit nie die falsche Variante gemeldet wird.

## Privatsphäre (bewusste Entscheidungen)

- Keine Nutzer-, Installations- oder Session-Kennungen — weder im Payload noch
  als Header. Der Server speichert Nachfrage, nicht Personen.
- URLs werden ohne Query/Fragment (Tracking-Parameter) übertragen; bei Amazon
  nur der kanonische `/dp/<ASIN>`-Pfad.
- Übertragen wird ausschließlich auf erkannten **Produktseiten** der im
  Manifest gelisteten Shops — nie Browsing-Verlauf.
- Schalter „Unbekannte Produkte melden" aus → reine anonyme GET-Lookups
  (`/sightings/resolve`), es wird nichts aufgezeichnet.
