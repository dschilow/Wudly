'use client';

import { motion } from 'motion/react';

/**
 * Per-route entrance — a quick, restrained cross-fade on every navigation so
 * moving through Wudly feels like one fluid surface rather than hard page swaps.
 *
 * Opacity-only on purpose: a `transform` here would become the containing block
 * for the product page's `position: fixed` action bar and break it. The subtle
 * vertical rise stays a per-section CSS concern (`animate-rise`/`animate-stagger`).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
