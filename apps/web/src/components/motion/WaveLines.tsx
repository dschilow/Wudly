'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Abstract, slowly drifting wave lines — Wudly's ambient signature for hero
 * panels. Three layered sine strokes at different speeds and amplitudes drift
 * horizontally on pure transforms (60fps-cheap), fading out toward the edges.
 *
 * Renders absolutely positioned: give the parent `relative overflow-hidden`.
 * Color comes from `currentColor`, so set a text color on the wrapper.
 */
export function WaveLines({
  className,
  opacity = 0.1,
}: {
  className?: string;
  /** Overall strength of the lines (kept low — this is atmosphere, not décor). */
  opacity?: number;
}) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[:]/g, '');
  const fadeId = `wave-fade-${uid}`;

  // One seamless tile is 480 wide; each path draws two tiles so a -480px drift
  // loops perfectly.
  const layers = [
    { y: 30, amplitude: 12, cycles: 2, width: 1.6, duration: 26, dir: -480 },
    { y: 58, amplitude: 18, cycles: 3, width: 1.2, duration: 38, dir: -480 },
    { y: 86, amplitude: 10, cycles: 4, width: 1, duration: 52, dir: 480 },
  ];

  return (
    <svg
      aria-hidden
      className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'}
      viewBox="0 0 480 120"
      preserveAspectRatio="none"
      style={{ opacity }}
    >
      <defs>
        <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.2" stopColor="currentColor" stopOpacity="1" />
          <stop offset="0.8" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {layers.map((layer, i) => (
        <motion.path
          key={i}
          d={wavePath(480, layer.y, layer.amplitude, layer.cycles)}
          fill="none"
          stroke={`url(#${fadeId})`}
          strokeWidth={layer.width}
          strokeLinecap="round"
          initial={false}
          animate={reduced ? undefined : { x: layer.dir > 0 ? [-480, 0] : [0, -480] }}
          transition={{ duration: layer.duration, ease: 'linear', repeat: Infinity }}
          style={{ x: layer.dir > 0 ? -480 : 0 }}
        />
      ))}
    </svg>
  );
}

/** Smooth sine-like stroke spanning two tiles of `tile` px for seamless drift. */
function wavePath(tile: number, y: number, amplitude: number, cycles: number): string {
  const seg = tile / cycles / 2; // half wavelength
  let d = `M 0 ${y}`;
  const halves = cycles * 2 * 2; // two tiles
  for (let i = 0; i < halves; i++) {
    const a = i % 2 === 0 ? -amplitude : amplitude;
    d += ` c ${r(seg / 3)} ${a}, ${r(seg / 1.5)} ${a}, ${r(seg)} 0`;
  }
  return d;
}

const r = (n: number) => Math.round(n * 100) / 100;
