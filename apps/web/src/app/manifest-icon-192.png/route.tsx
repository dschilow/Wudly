import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/brand-icon';

export const runtime = 'nodejs';

/** 192×192 "any"-purpose PWA icon (rounded squircle on transparent). */
export function GET() {
  const size = 192;
  return new ImageResponse(BrandIcon({ size, fullBleed: false, glyphScale: 0.56 }) as any, {
    width: size,
    height: size,
  });
}
