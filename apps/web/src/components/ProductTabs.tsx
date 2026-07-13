'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface ProductTab {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/** Compact, swipeable and keyboard-operable product detail tabs. */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const [dir, setDir] = useState(1);
  const baseId = useId().replace(/:/g, '');

  const activeTab = tabs.find((tab) => tab.key === active) ?? tabs[0];
  if (!activeTab) return null;

  const select = (key: string) => {
    if (key === active) return;
    const from = tabs.findIndex((tab) => tab.key === active);
    const to = tabs.findIndex((tab) => tab.key === key);
    setDir(to > from ? 1 : -1);
    navigator.vibrate?.(5);
    setActive(key);
  };

  const selectRelative = (delta: number) => {
    const index = tabs.findIndex((tab) => tab.key === activeTab.key);
    const next = tabs[index + delta];
    if (next) select(next.key);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = tabs[nextIndex]!;
    select(next.key);
    document.getElementById(`${baseId}-tab-${next.key}`)?.focus();
  };

  return (
    <div>
      <div className="hairline sticky top-[3rem] z-20 -mx-5 bg-canvas/92 px-5 backdrop-blur-xl">
        <div role="tablist" aria-label="Produktdetails" className="flex gap-6">
          {tabs.map((tab, index) => {
            const isActive = tab.key === activeTab.key;
            return (
              <button
                key={tab.key}
                id={`${baseId}-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${baseId}-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(tab.key)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={cn(
                  'relative flex min-h-11 items-baseline gap-1.5 pb-2.5 pt-3 transition-colors duration-200',
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
          id={`${baseId}-panel-${activeTab.key}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeTab.key}`}
          tabIndex={0}
          custom={dir}
          variants={{
            enter: (direction: number) => ({ x: direction * 32, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (direction: number) => ({ x: direction * -32, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -64 || info.velocity.x < -500) selectRelative(1);
            else if (info.offset.x > 64 || info.velocity.x > 500) selectRelative(-1);
          }}
          className="space-y-7 pt-5 outline-none"
        >
          {activeTab.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
