'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';

/**
 * A number that counts up the first time it scrolls into view.
 *
 * Server-renders the real value (SEO / no-JS keeps the fact), then ticks from 0
 * once visible. Respects prefers-reduced-motion. Wrap in a `tnum` context so
 * digits don't shift surrounding layout while counting.
 */
export function AnimatedNumber({
  value,
  duration = 1,
  delay = 0,
  className,
}: {
  value: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!inView || reduced || value === 0) return;
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduced, value, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
