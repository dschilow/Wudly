/**
 * Renders a 1200×630 social share card (OG image) for a product, featuring the
 * Wudly claim, the product name, and the big Wiederkauf-Score with a ring. Pure
 * string SVG (no deps, no Edge runtime) — consistent with the product preview.
 */

type ProductShareSource = {
  canonicalName: string;
  brand: string | null;
  category: { name: string } | null;
  rebuyScore: number | null;
  experienceCount: number;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Wrap a long title onto up to two lines for the card. */
function wrapTitle(title: string, maxPerLine = 22): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === 2) break;
  }
  if (current && lines.length < 2) lines.push(current);
  // Truncate if there was more.
  if (lines.length === 2 && lines.join(' ').length < title.length) {
    lines[1] = `${lines[1]!.slice(0, maxPerLine - 1).trimEnd()}…`;
  }
  return lines.slice(0, 2);
}

function scoreColor(score: number | null): string {
  if (score === null) return '#94a3b8';
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

export function renderProductShareSvg(product: ProductShareSource): string {
  const score = product.rebuyScore;
  const ringColor = scoreColor(score);
  const titleLines = wrapTitle(escapeXml(product.canonicalName));
  const meta = escapeXml(
    [product.brand, product.category?.name].filter(Boolean).join(' · ') || 'Produkt',
  );
  const scoreText = score === null ? '–' : String(score);

  // Score ring geometry.
  const cx = 960;
  const cy = 315;
  const r = 150;
  const circumference = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const dash = circumference * pct;
  const gap = circumference - dash;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="90" y="${250 + i * 78}" font-size="64" font-weight="800" letter-spacing="-0.02em" fill="#0f172a">${line}</text>`,
    )
    .join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${titleLines.join(' ')}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="0" y="0" width="1200" height="10" fill="#4f46e5" />

  <!-- Brand -->
  <text x="90" y="110" font-size="34" font-weight="800" letter-spacing="-0.01em" fill="#4f46e5">Wudly</text>
  <text x="90" y="155" font-size="26" font-weight="600" fill="#64748b">Würdest du es wieder kaufen?</text>

  <!-- Product -->
  ${titleSvg}
  <text x="90" y="${250 + titleLines.length * 78 + 18}" font-size="30" font-weight="600" fill="#64748b">${meta}</text>
  <text x="90" y="540" font-size="26" font-weight="600" fill="#94a3b8">${product.experienceCount} echte Besitzer-Erfahrung${product.experienceCount === 1 ? '' : 'en'}</text>

  <!-- Score ring -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="26" />
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ringColor}" stroke-width="26"
    stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
    transform="rotate(-90 ${cx} ${cy})" />
  <text x="${cx}" y="${cy - 6}" text-anchor="middle" dominant-baseline="middle" font-size="128" font-weight="800" fill="#0f172a">${scoreText}</text>
  <text x="${cx}" y="${cy + 78}" text-anchor="middle" font-size="30" font-weight="700" fill="#64748b">WIEDERKAUF</text>
</svg>`;
}
