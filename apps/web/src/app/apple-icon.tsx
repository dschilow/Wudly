import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/brand-icon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Apple touch icon — full-bleed gradient (iOS applies its own rounding/mask). */
export default function AppleIcon() {
  return new ImageResponse(BrandIcon({ size: 180, fullBleed: true, glyphScale: 0.5 }), {
    ...size,
  });
}
