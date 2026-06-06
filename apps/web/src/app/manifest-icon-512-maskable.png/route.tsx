import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/brand-icon';

export const runtime = 'nodejs';

/** 512×512 maskable icon — full-bleed gradient with the glyph in the safe zone. */
export function GET() {
  const size = 512;
  return new ImageResponse(BrandIcon({ size, fullBleed: true, glyphScale: 0.42 }), {
    width: size,
    height: size,
  });
}
