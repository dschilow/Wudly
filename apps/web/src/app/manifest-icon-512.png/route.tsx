import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/brand-icon';

export const runtime = 'nodejs';

/** 512×512 "any"-purpose PWA icon (rounded squircle on transparent). */
export function GET() {
  const size = 512;
  return new ImageResponse(BrandIcon({ size, fullBleed: false, glyphScale: 0.56 }), {
    width: size,
    height: size,
  });
}
