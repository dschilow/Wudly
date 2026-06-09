/**
 * German pluralization helpers — used to kill broken strings like "Erfahrung en"
 * and to keep counts grammatical everywhere ("1 Erfahrung", "3 Erfahrungen").
 */
export function plural(count: number, one: string, many: string): string {
  return Math.abs(count) === 1 ? one : many;
}

/** "{n} Erfahrung(en)" with the count baked in. */
export function pluralCount(count: number, one: string, many: string): string {
  return `${count} ${plural(count, one, many)}`;
}

/** Owners label, grammatical: "1 Besitzer" / "5 Besitzer" (already invariant). */
export function ownersLabel(count: number): string {
  return `${count} Besitzer`;
}
