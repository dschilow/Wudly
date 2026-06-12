'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface ProductTab {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/**
 * Editorial tab bar for the product page — mono uppercase labels over a thin
 * rule, an ink underline that glides between tabs, and directional content
 * slides. Tabs keep scroll paths short: Übersicht / Stimmen / Fragen instead
 * of one endless page.
 */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const [dir, setDir] = useState(1);

  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!activeTab) return null;

  const select = (key: string) => {
    if (key === active) return;
    const from = tabs.findIndex((t) => t.key === active);
    const to = tabs.findIndex((t) => t.key === key);
    setDir(to > from ? 1 : -1);
    navigator.vibrate?.(5);
    setActive(key);
  };

  const selectRelative = (delta: number) => {
    const idx = tabs.findIndex((t) => t.key === activeTab.key);
    const next = tabs[idx + delta];
    if (next) select(next.key);
  };

  return (
    <div>
      <div className="hairline sticky top-[3rem] z-20 -mx-5 bg-canvas/92 px-5 backdrop-blur-xl">
        <div role="tablist" className="flex gap-6">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => select(tab.key)}
                className={cn(
                  'relative flex items-baseline gap-1.5 pb-2.5 pt-3 transition-colors duration-200',
                  isActive ? 'text-label' : 'text-muted-foreground active:opacity-60',
                )}
              >
                <span className="mono-data text-[0.75rem] font-semibold uppercase tracking-[0.16em]">
                  {tab.label}
                </span>
                {typeof tab.count === 'number' && (
                  <span
                    className={cn(
                      'mono-data text-[0.6875rem]',
                      isActive ? 'text-accent' : 'text-faint',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="product-tab-ink"
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={activeTab.key}
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d * 32, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d * -32, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          /* Horizontal swipe switches tabs — vertical scrolling stays free. */
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -64 || info.velocity.x < -500) selectRelative(1);
            else if (info.offset.x > 64 || info.velocity.x > 500) selectRelative(-1);
          }}
          className="space-y-7 pt-5"
        >
          {activeTab.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
