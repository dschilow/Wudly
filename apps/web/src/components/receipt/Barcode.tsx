import { cn } from '@/lib/utils';

/**
 * Decorative receipt barcode — deterministic stripes derived from a seed string
 * (same product, same barcode). Pure ornament that ties the receipt language
 * back to Wudly's scan-first flow. Inherits `currentColor`.
 */
export function Barcode({ seed, className }: { seed: string; className?: string }) {
  // FNV-1a hash → tiny LCG for stable pseudo-random stripe widths.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = (h >>> 0) || 7;
  const next = () => {
    state = (Math.imul(state, 48271) >>> 0) % 2147483647;
    return state / 2147483647;
  };

  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 98) {
    const w = 0.7 + next() * 2.2;
    bars.push({ x, w });
    x += w + 0.8 + next() * 1.8;
  }

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={cn('h-6 w-full', className)}
      aria-hidden
    >
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y="0" width={bar.w} height="24" fill="currentColor" />
      ))}
    </svg>
  );
}
