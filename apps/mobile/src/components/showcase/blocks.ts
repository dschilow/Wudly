/**
 * Type-safe accessors over the loosely-typed ShowcaseBlock `content` JSON.
 * Ported from apps/web so the app renders showcases identically and defensively.
 */

export function str(content: Record<string, unknown>, key: string): string | null {
  const v = content[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

export function num(content: Record<string, unknown>, key: string): number | null {
  const v = content[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function strArray(content: Record<string, unknown>, key: string): string[] {
  const v = content[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export interface TitledItem {
  title: string;
  text?: string;
}

export function titledItems(content: Record<string, unknown>, key: string): TitledItem[] {
  const v = content[key];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({
      title: typeof x.title === 'string' ? x.title : '',
      text: typeof x.text === 'string' ? x.text : undefined,
    }))
    .filter((x) => x.title.length > 0);
}

export interface QaItem {
  q: string;
  a: string;
}

export function qaItems(content: Record<string, unknown>, key: string): QaItem[] {
  const v = content[key];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({
      q: typeof x.q === 'string' ? x.q : '',
      a: typeof x.a === 'string' ? x.a : '',
    }))
    .filter((x) => x.q.length > 0 && x.a.length > 0);
}

export interface SpecItem {
  label: string;
  value: string;
}

export function specItems(content: Record<string, unknown>, key: string): SpecItem[] {
  const v = content[key];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({
      label: typeof x.label === 'string' ? x.label : '',
      value: typeof x.value === 'string' ? x.value : '',
    }))
    .filter((x) => x.label.length > 0);
}
