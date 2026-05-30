# Produktkonzept

## Vision

**Wudly** beantwortet die eine Frage, die vor jedem Kauf zählt: **„Würdest du es wieder kaufen?"** —
beantwortet von Menschen, die das Produkt **wirklich besitzen und benutzt haben**.

Klassische Bewertungsportale leiden unter Sterne-Inflation, gekauften Reviews und Ersteindrücken
nach drei Tagen. Wudly setzt dagegen auf:

- **Wiederkauf-Entscheidung** statt 5-Sterne-Skala.
- **Nutzungsdauer als Gewicht** — Langzeiterfahrung zählt mehr als der Auspack-Moment.
- **Regret-Score** — macht Fehlkäufe sichtbar, nicht nur Lob.
- **3-Klick-Erfassung** — niedrigste Hürde, daher mehr echte Datenpunkte.
- **Fragen an echte Besitzer** — gezielte Entscheidungshilfe statt generischer FAQ.

## Zielgruppe

Käufer vor einer Anschaffung (Haushaltsgeräte, Technik, Baby/Kind, Energie, …), die wissen wollen,
ob ein Produkt **auf Dauer** hält, was es verspricht — und Besitzer, die ihre Erfahrung in Sekunden
teilen wollen.

## Kern-Flows

1. **Produkt prüfen** — Suche → Produktseite mit Wiederkauf-/Regret-Score, Stärken, Problemen,
   „das hätte ich gerne vorher gewusst", Zielgruppe, Nutzungsdauer-Verteilung, Fragen.
2. **„Ich besitze es"** — 3 Pflichtschritte (Wiederkauf? · Nutzungsdauer? · Erfahrung in einem Wort?),
   optional „was hätte ich gerne gewusst" + Likes/Dislikes. Danke-Screen.
3. **Besitzer fragen** — freie Frage oder häufige Vorlage; Antworten + „Hilfreich".
4. **Top & Flop** — Entdeckung & Viralität: beste Wiederkäufe, größte Fehlkäufe, meist diskutiert, je Kategorie.

## Designprinzipien

- **Mobile-first**, app-artig (BottomNav, große Tap-Targets, Kartenlayout, viel Weißraum).
- **Keine langen Formulare.** „Später ergänzen" statt Pflichtfelder. Kein EAN/Modellnummer-Zwang.
- **Progressive Enhancement:** erst speichern, später verbessern. Produkte dürfen unvollständig sein.
- **Vertrauenswürdig & neutral** — kein Werbe-/Affiliate-Look. Klare Scores, ehrliche Negativsignale.
- **Visuelles Feedback** bei jeder Aktion (Toasts, Animationen).

## Datenqualität & Anti-Duplikate

Gleiche Produkte sollen nicht chaotisch mehrfach entstehen. Beim Anlegen wird der Name normalisiert,
ähnliche Produkte werden gesucht und als „Meinst du dieses Produkt?" angeboten. Grenzfälle landen als
**Merge-Kandidat** im Admin-Bereich. Varianten sind im Datenmodell vorbereitet, im MVP-UI aber bewusst
auf Produktebene gehalten.

## Bewusst NICHT im MVP

- Kein Scraping von Amazon/TikTok/Instagram/Reddit. Wudly basiert auf **eigenen** Nutzererfahrungen.
- Keine Garantie-/Rückgabefristen-Verwaltung, keine vollständigen Datenblätter.
- Kein komplexes Variantenmanagement, kein Payment, kein echtes Affiliate, keine Native App.

Die Architektur **blockiert keinen** dieser Punkte — sie sind später ergänzbar.

## Roadmap-Ideen

- Echte KI: Erfahrungs-Texte zu Aspekten normalisieren, Produktkandidaten extrahieren,
  Insight-Zusammenfassungen (über das bestehende `AiService`-Interface, Provider austauschbar).
- Besseres Matching (pg_trgm/pgvector), Varianten-UX, OAuth/Magic-Link.
- B2B-Dashboard für Hersteller (aggregierte, anonymisierte Wiederkauf-/Regret-Insights).
- Gamification (Badges sind vorbereitet), Recall-Loops für Langzeiterfahrungen.
