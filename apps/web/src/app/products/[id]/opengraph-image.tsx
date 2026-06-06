import { ImageResponse } from 'next/og';
import { api } from '@/lib/api';
import { rebuyVerdict } from '@/lib/verdict';

export const runtime = 'nodejs';
export const alt = 'Wudly — Würdest du es wieder kaufen?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Satori needs real font data for text (no system fonts). Fetch once, cache in
// module scope. woff (not woff2) — Satori doesn't read woff2.
let fontCache: ArrayBuffer | null = null;
async function interBold(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff',
  );
  if (!res.ok) throw new Error(`font ${res.status}`);
  fontCache = await res.arrayBuffer();
  return fontCache;
}

function ringColor(score: number | null): string {
  if (score === null) return '#a0a0a8';
  if (score >= 75) return '#2f9f56';
  if (score >= 50) return '#c9892b';
  return '#d84a3a';
}

/**
 * Social share image (1200×630 PNG) — the signature score ring + verdict, so a
 * shared Wudly link looks like a real product card everywhere. Crisp PNG instead
 * of an SVG (which many platforms refuse to render). Any failure falls back to a
 * plain branded card so the route never 500s and an og:image always exists.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [product, font] = await Promise.all([
      api.products.get(id, { next: { revalidate: 300 } }),
      interBold(),
    ]);
    const score = product.insights.rebuyScore;
    const verdict = rebuyVerdict(score);
    const color = ringColor(score);
    const R = 150;
    const CIRC = 2 * Math.PI * R;
    const dash = CIRC * ((score ?? 0) / 100);

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 72px',
            background: '#FBFBFD',
            color: '#0a0a0c',
            fontFamily: 'Inter',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg,#2b6bff,#6a5cff)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 10a7 7 0 1 1 1.2 4"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.5 5.5V10H9"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ fontSize: 30, color: '#6c6c72' }}>Wudly</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 48,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
              {product.brand ? (
                <div style={{ fontSize: 30, color: '#6c6c72', marginBottom: 10 }}>
                  {product.brand}
                </div>
              ) : null}
              <div style={{ fontSize: 62, lineHeight: 1.05, letterSpacing: -1.5 }}>
                {product.canonicalName}
              </div>
              <div style={{ fontSize: 34, color, marginTop: 26 }}>{verdict.label}</div>
            </div>

            <div
              style={{
                position: 'relative',
                width: 360,
                height: 360,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', transform: 'rotate(-90deg)' }}>
                <svg width="360" height="360" viewBox="0 0 360 360">
                  <circle cx="180" cy="180" r={R} fill="none" stroke="#e9e9ee" strokeWidth="34" />
                  {score !== null ? (
                    <circle
                      cx="180"
                      cy="180"
                      r={R}
                      fill="none"
                      stroke={color}
                      strokeWidth="34"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${CIRC}`}
                    />
                  ) : null}
                </svg>
              </div>
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'baseline',
                  color,
                }}
              >
                <span style={{ fontSize: 112 }}>{score === null ? '–' : score}</span>
                {score !== null ? <span style={{ fontSize: 46 }}>%</span> : null}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 27, color: '#6c6c72' }}>
            Würdest du es wieder kaufen? · Echte Besitzer. Echte Nutzung.
          </div>
        </div>
      ),
      { ...size, fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }] },
    );
  } catch (err) {
    console.error('[opengraph-image] generation failed:', err);
    // Branded fallback that needs neither product data nor a font.
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            background: 'linear-gradient(135deg,#2b6bff,#6a5cff)',
          }}
        />
      ),
      size,
    );
  }
}
