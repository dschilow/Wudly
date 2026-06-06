import type { ReactElement } from 'react';

/**
 * The Wudly app mark, rendered as a Satori-compatible element for `next/og`
 * ImageResponse so we can generate crisp PNG install icons at any size with no
 * binary image dependency. It draws only shapes (no text), so no font is needed.
 *
 * - `fullBleed` fills the whole canvas with the brand gradient (apple-touch-icon
 *   and maskable icons, which must not have transparent corners).
 * - otherwise it draws a rounded squircle on a transparent background ("any").
 */
const GRADIENT = 'linear-gradient(135deg, #2b6bff 0%, #3f7bff 45%, #6a5cff 100%)';

export function BrandIcon({
  size,
  fullBleed = false,
  glyphScale = 0.56,
}: {
  size: number;
  fullBleed?: boolean;
  glyphScale?: number;
}): ReactElement {
  const radius = fullBleed ? 0 : Math.round(size * 0.22);
  const glyph = Math.round(size * glyphScale);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: fullBleed ? GRADIENT : 'transparent',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
          background: fullBleed ? 'transparent' : GRADIENT,
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 10a7 7 0 1 1 1.2 4"
            stroke="white"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4.5 5.5V10H9"
            stroke="white"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
