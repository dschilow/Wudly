/**
 * Editor field definitions per ShowcaseBlock type.
 *
 * The block `content` is free-form JSON; the renderer (ShowcaseRenderer) reads a
 * specific set of keys per type. This module declares those keys as editable
 * fields so the studio editor can render a typed form for any block — and the
 * two stay in lockstep with the renderer's accessors (`blocks.ts`).
 */
import type { ShowcaseBlockType } from '@wudly/shared';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'url'
  | 'number'
  | 'stringList'
  | 'titledList'
  | 'qaList'
  | 'specList';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hint?: string;
}

export interface BlockTypeMeta {
  label: string;
  description: string;
  fields: FieldDef[];
}

/**
 * Block types the editor exposes. GALLERY / CHART / VIDEO / DOWNLOADS are
 * intentionally omitted — the renderer skips them, so we don't offer them yet.
 */
export const EDITABLE_BLOCKS: Partial<Record<ShowcaseBlockType, BlockTypeMeta>> = {
  HERO: {
    label: 'Hero',
    description: 'Großer Titelblock am Anfang.',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', placeholder: 'z. B. LANGZEITTEST' },
      { key: 'headline', label: 'Überschrift', kind: 'text', placeholder: 'Hauptüberschrift' },
      { key: 'subline', label: 'Unterzeile', kind: 'textarea', placeholder: 'Kurze Einleitung' },
    ],
  },
  PROMISE: {
    label: 'Produktversprechen',
    description: 'Liste von Versprechen / Kernnutzen.',
    fields: [{ key: 'items', label: 'Punkte', kind: 'stringList', placeholder: 'Versprechen' }],
  },
  AUDIENCE: {
    label: 'Zielgruppe',
    description: 'Für wen das Produkt gedacht ist.',
    fields: [{ key: 'items', label: 'Zielgruppen', kind: 'stringList', placeholder: 'z. B. Familien' }],
  },
  FEATURE_CARDS: {
    label: 'Feature-Karten',
    description: 'Features mit Titel und Beschreibung.',
    fields: [{ key: 'cards', label: 'Karten', kind: 'titledList' }],
  },
  USE_CASES: {
    label: 'Anwendungsfälle',
    description: 'Szenarien mit Titel und Erklärung.',
    fields: [{ key: 'items', label: 'Anwendungsfälle', kind: 'titledList' }],
  },
  PROBLEM_SOLUTION: {
    label: 'Problem & Lösung',
    description: 'Ein Problem und die dazugehörige Lösung.',
    fields: [
      { key: 'problem', label: 'Problem', kind: 'textarea', placeholder: 'Welches Problem?' },
      { key: 'solution', label: 'Lösung', kind: 'textarea', placeholder: 'Wie wird es gelöst?' },
    ],
  },
  COMPARISON: {
    label: 'Vergleichskriterien',
    description: 'Kriterien, an denen man das Produkt messen sollte.',
    fields: [
      { key: 'criteria', label: 'Kriterien', kind: 'stringList', placeholder: 'z. B. Saugkraft' },
      { key: 'note', label: 'Hinweis', kind: 'textarea' },
    ],
  },
  TECH_SPECS: {
    label: 'Technische Daten',
    description: 'Bezeichnung-Wert-Paare.',
    fields: [{ key: 'specs', label: 'Daten', kind: 'specList' }],
  },
  FAQ: {
    label: 'FAQ',
    description: 'Frage-Antwort-Paare.',
    fields: [{ key: 'items', label: 'Fragen', kind: 'qaList' }],
  },
  CREATOR_VERDICT: {
    label: 'Creator-Fazit',
    description: 'Dein persönliches Fazit mit Bewertung.',
    fields: [
      { key: 'verdict', label: 'Fazit (kurz)', kind: 'text', placeholder: 'Kurzfazit' },
      { key: 'rating', label: 'Sterne (0–5)', kind: 'number', hint: 'Optional, 0 blendet aus.' },
      { key: 'text', label: 'Begründung', kind: 'textarea' },
    ],
  },
  BRAND_STATEMENT: {
    label: 'Hersteller-Statement',
    description: 'Offizielle Aussage des Herstellers.',
    fields: [{ key: 'text', label: 'Statement', kind: 'textarea' }],
  },
  BUY_LINK: {
    label: 'Kauf-Button',
    description: 'Verlinkt zum Shop (als sponsored markiert).',
    fields: [
      { key: 'label', label: 'Button-Text', kind: 'text', placeholder: 'Zum Shop' },
      { key: 'url', label: 'URL', kind: 'url', placeholder: 'https://…' },
    ],
  },
  CTA: {
    label: 'Call-to-Action',
    description: 'Sekundärer Button mit Link.',
    fields: [
      { key: 'label', label: 'Button-Text', kind: 'text' },
      { key: 'url', label: 'URL', kind: 'url', placeholder: 'https://…' },
    ],
  },
  AFFILIATE_NOTE: {
    label: 'Affiliate-Hinweis',
    description: 'Hinweis auf Provisions-Links.',
    fields: [
      {
        key: 'text',
        label: 'Hinweistext',
        kind: 'textarea',
        placeholder: 'Diese Seite enthält Affiliate-Links.',
      },
    ],
  },
};

export const EDITABLE_BLOCK_TYPES = Object.keys(EDITABLE_BLOCKS) as ShowcaseBlockType[];

export function blockMeta(type: ShowcaseBlockType): BlockTypeMeta | null {
  return EDITABLE_BLOCKS[type] ?? null;
}
