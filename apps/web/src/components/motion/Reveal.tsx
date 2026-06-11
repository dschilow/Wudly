'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Scroll-triggered entrance for server-rendered sections: a soft iOS-style
 * rise + fade the first time the block enters the viewport. Transform-based,
 * so anything relying on `position: fixed` must stay outside this wrapper.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  amount = 0.2,
  className,
}: {
  children: ReactNode;
  /** Seconds before the entrance starts (for choreographed sequences). */
  delay?: number;
  /** Rise distance in px. */
  y?: number;
  /** Portion of the element that must be visible before it animates. */
  amount?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ type: 'spring', stiffness: 320, damping: 34, delay }}
    >
      {children}
    </motion.div>
  );
}
