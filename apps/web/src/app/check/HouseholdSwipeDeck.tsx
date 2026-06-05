'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { Check, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ProductSummaryDto } from '@wudly/shared';
import { Thumb } from '@/components/Thumb';
import { ScoreRing } from '@/components/ScoreRing';
import { cn } from '@/lib/utils';

const TAGS = ['Leise', 'Haltbar', 'Zu teuer', 'Nervt im Alltag', 'Überraschend gut'];

export function HouseholdSwipeDeck({ products }: { products: ProductSummaryDto[] }) {
  const deck = useMemo(() => products.slice(0, 10), [products]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 0, 180], [-8, 0, 8]);
  const opacity = useTransform(x, [-180, 0, 180], [0.82, 1, 0.82]);

  const current = deck[index];
  const done = index >= deck.length;

  function vote(nextDirection: 1 | -1) {
    navigator.vibrate?.(18);
    setDirection(nextDirection);
    setSelectedTags([]);
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setDirection(0);
      x.set(0);
    }, 180);
  }

  if (deck.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="text-[1.3125rem] font-bold tracking-tight text-label">Dein Haushalt</h2>
          <p className="mt-0.5 text-[0.875rem] text-muted-foreground">
            10 ehrliche Antworten in 30 Sekunden.
          </p>
        </div>
        <span className="tnum text-[0.875rem] font-medium text-faint">
          {Math.min(index + 1, deck.length)}/{deck.length}
        </span>
      </div>

      <div className="relative h-[24rem] overflow-hidden rounded-[1.375rem]">
        {done ? (
          <div className="card grid h-full place-items-center p-6 text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-positive-soft text-positive">
                <Check className="h-8 w-8" strokeWidth={2.4} />
              </span>
              <h3 className="mt-4 text-[1.5rem] font-bold tracking-tight text-label">
                Fertig für heute.
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">
                Deine Signale machen Wudly für andere Käufer deutlich nützlicher.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                  setSelectedTags([]);
                }}
                className="press mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[0.85rem] bg-fill-2 px-4 text-[0.9375rem] font-semibold text-label"
              >
                <RotateCcw className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />
                Nochmal ansehen
              </button>
            </div>
          </div>
        ) : (
          <>
            {deck.slice(index + 1, index + 3).map((product, offset) => (
              <div
                key={product.id}
                className="card absolute inset-x-4 top-4 h-[21rem] border border-border"
                style={{
                  transform: `translateY(${(offset + 1) * 10}px) scale(${1 - (offset + 1) * 0.035})`,
                  opacity: 0.58 - offset * 0.18,
                }}
              />
            ))}

            <AnimatePresence mode="popLayout">
              {current && (
                <motion.div
                  key={current.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 92) vote(1);
                    if (info.offset.x < -92) vote(-1);
                  }}
                  animate={{
                    x: direction === 1 ? 360 : direction === -1 ? -360 : 0,
                    rotate: direction === 1 ? 10 : direction === -1 ? -10 : 0,
                  }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  style={{ x, rotate, opacity }}
                  className="card-elevated absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
                >
                  <div className="flex h-full flex-col p-4">
                    <div className="flex items-start gap-3">
                      <Thumb product={current} className="h-16 w-16" rounded="rounded-[1rem]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Besitzt du das?
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-[1.375rem] font-bold leading-[1.08] tracking-tight text-label">
                          {current.canonicalName}
                        </h3>
                        <p className="mt-1 truncate text-[0.875rem] text-muted-foreground">
                          {[current.brand, current.category?.name].filter(Boolean).join(' · ') ||
                            'Produkt'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid flex-1 place-items-center text-center">
                      <div>
                        <ScoreRing score={current.rebuyScore} tone="auto" size={132} />
                        <p className="mx-auto mt-4 max-w-[15rem] text-[1.125rem] font-semibold leading-tight text-label">
                          Würdest du es wieder kaufen?
                        </p>
                        <p className="mt-2 text-[0.8125rem] leading-snug text-muted-foreground">
                          Rechts für ja. Links für nie wieder.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {TAGS.map((tag) => {
                        const active = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              navigator.vibrate?.(8);
                              setSelectedTags((tags) =>
                                tags.includes(tag)
                                  ? tags.filter((item) => item !== tag)
                                  : [...tags, tag],
                              );
                            }}
                            className={cn(
                              'tap-dim rounded-full px-3 py-1.5 text-[0.75rem] font-medium',
                              active
                                ? 'bg-accent text-white'
                                : 'bg-fill-2 text-muted-foreground',
                            )}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {!done && current && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => vote(-1)}
            className="press flex h-12 items-center justify-center gap-2 rounded-[0.95rem] bg-regret-soft text-[1rem] font-semibold text-regret-ink"
          >
            <ThumbsDown className="h-5 w-5" strokeWidth={2.4} />
            Nie wieder
          </button>
          <button
            type="button"
            onClick={() => vote(1)}
            className="press flex h-12 items-center justify-center gap-2 rounded-[0.95rem] bg-positive text-[1rem] font-semibold text-white shadow-[0_8px_22px_-12px_rgba(47,180,87,0.8)]"
          >
            <ThumbsUp className="h-5 w-5" strokeWidth={2.4} />
            Wieder kaufen
          </button>
        </div>
      )}

      {current && !done && (
        <Link
          href={`/products/${current.id}/own`}
          className="tap-dim block text-center text-[0.875rem] font-medium text-accent"
        >
          Ausführlich bewerten
        </Link>
      )}
    </section>
  );
}
