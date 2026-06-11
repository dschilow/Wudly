'use client';

import { useMemo, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { computeScores, type ExperienceDto } from '@wudly/shared';
import { scoreColor } from '@/lib/utils';

type Point = readonly [number, number];

/** Catmull-Rom → cubic-Bézier smoothing for an organic, Apple-style sparkline. */
function smoothPath(pts: Point[]): string {
  const head = pts[0];
  if (!head) return '';
  if (pts.length === 1) return `M ${r(head[0])} ${r(head[1])}`;
  let d = `M ${r(head[0])} ${r(head[1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * "Score-Verlauf" — how a product's rebuy score evolved as real owners reported
 * over time. Each point is the canonical `computeScores` over the experiences up
 * to that date, so the curve agrees with the hero ring. The line draws itself in
 * on scroll (normalized via SVG pathLength, so it's resolution-independent).
 */
export function ScoreTrend({ experiences }: { experiences: ExperienceDto[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  const points = useMemo(() => {
    const sorted = [...experiences]
      .filter((e) => e.isPublic)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const score = computeScores(sorted.slice(0, i + 1)).rebuyScore;
      if (score !== null) out.push(score);
    }
    return out;
  }, [experiences]);

  if (points.length < 3) return null;

  const W = 100;
  const H = 40;
  const padY = 5;
  const min = Math.max(0, Math.min(...points) - 6);
  const max = Math.min(100, Math.max(...points) + 6);
  const span = Math.max(1, max - min);

  const xy: Point[] = points.map((score, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = padY + (1 - (score - min) / span) * (H - padY * 2);
    return [x, y];
  });

  const line = smoothPath(xy);
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  const current = points[points.length - 1]!;
  const first = points[0]!;
  const delta = current - first;
  const color = scoreColor(current);
  const last = xy[xy.length - 1]!;
  const dotLeft = `${last[0]}%`;
  const dotTop = `${(last[1] / H) * 100}%`;

  return (
    <div ref={ref}>
      <div className="relative h-24 w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={area}
            fill="url(#trend-fill)"
            style={{
              opacity: inView ? 1 : 0,
              transition: 'opacity 0.7s ease 0.25s',
            }}
          />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={inView ? 0 : 1}
            style={{ transition: 'stroke-dashoffset 1.1s var(--ease-ios)' }}
          />
        </svg>
        {/* End-of-line dot with a soft "live" pulse halo. */}
        {!reduced && (
          <motion.span
            aria-hidden
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: dotLeft, top: dotTop, backgroundColor: color }}
            initial={{ opacity: 0 }}
            animate={
              inView
                ? { opacity: [0, 0.45, 0], scale: [1, 2.6, 1] }
                : undefined
            }
            transition={{ delay: 1.1, duration: 2.4, repeat: Infinity, repeatDelay: 1.2 }}
          />
        )}
        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
          style={{ left: dotLeft, top: dotTop, backgroundColor: color, opacity: inView ? 1 : 0, transition: 'opacity 0.3s ease 1s' }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[0.8125rem]">
        <span className="text-muted-foreground">Erste Wertungen</span>
        <span className="font-medium" style={{ color }}>
          {delta === 0
            ? 'stabil'
            : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} Punkte`}{' '}
          <span className="text-muted-foreground">· jetzt {current}%</span>
        </span>
      </div>
    </div>
  );
}
