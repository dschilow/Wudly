'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { Check, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { WouldBuyAgain, type ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { Thumb } from '@/components/Thumb';
import { cn } from '@/lib/utils';

const TAGS = ['Leise', 'Haltbar', 'Zu teuer', 'Nervt im Alltag', 'Überraschend gut'];

/**
 * The swipe check — Tinder for your purchases. Pull a card right and the
 * WIEDER KAUFEN stamp presses in; pull left for NIE WIEDER. Releasing past the
 * threshold files the signal instantly (fire-and-forget) and the next receipt
 * slides up from the stack.
 */
export function HouseholdSwipeDeck({
  products,
  title = 'Schnell-Check',
  subtitle = 'Ehrliche Antworten in Sekunden.',
}: {
  products: ProductSummaryDto[];
  title?: string;
  subtitle?: string;
}) {
  const deck = useMemo(() => products.slice(0, 10), [products]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [voted, setVoted] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 0, 180], [-7, 0, 7]);
  // Directional verdict stamps — press in as the card is pulled toward yes/no.
  const yesOpacity = useTransform(x, [24, 110], [0, 1]);
  const yesScale = useTransform(x, [24, 110], [1.4, 1]);
  const noOpacity = useTransform(x, [-110, -24], [1, 0]);
  const noScale = useTransform(x, [-110, -24], [1, 1.4]);

  const current = deck[index];
  const done = index >= deck.length;

  function vote(nextDirection: 1 | -1) {
    navigator.vibrate?.(18);
    const product = deck[index];
    const tags = selectedTags;
    // Persist the signal (fire-and-forget — the swipe must feel instant).
    if (product) {
      void api.products
        .vote(product.id, {
          value: nextDirection === 1 ? WouldBuyAgain.YES : WouldBuyAgain.NO,
          tags: tags.length > 0 ? tags : undefined,
        })
        .catch(() => undefined);
      setVoted((v) => v + 1);
    }
    setDirection(nextDirection);
    setSelectedTags([]);
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setDirection(0);
      x.set(0);
    }, 200);
  }

  if (deck.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-accent-ink">
            {title}
          </p>
          <h2 className="font-display mt-1 text-[1.45rem] italic leading-snug text-label">
            {subtitle}
          </h2>
        </div>
        <span className="mono-data shrink-0 pb-1 text-[0.75rem] font-semibold text-faint">
          {Math.min(index + 1, deck.length)}/{deck.length}
        </span>
      </div>

      <div className="relative h-[23rem]">
        {done ? (
          <div className="card grid h-full place-items-center p-6 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-positive-soft text-positive-ink">
                <Check className="h-7 w-7" strokeWidth={2.4} />
              </span>
              <h3 className="font-display mt-4 text-[1.7rem] leading-tight text-label">
                Fertig für heute.
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">
                {voted > 0
                  ? `${voted} ${voted === 1 ? 'Signal' : 'Signale'} gespeichert — danke! Das macht Wudly für andere Käufer genauer.`
                  : 'Deine Signale machen Wudly für andere Käufer deutlich nützlicher.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                  setSelectedTags([]);
                  setVoted(0);
                }}
                className="press mono-data mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-fill-2 px-4 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-label"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
                Nochmal
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* The stack underneath — upcoming receipts peeking out. */}
            {deck.slice(index + 1, index + 3).map((product, offset) => (
              <div
                key={product.id}
                className="card absolute inset-x-3 top-0 h-full"
                style={{
                  transform: `translateY(${(offset + 1) * 9}px) scale(${1 - (offset + 1) * 0.04})`,
                  opacity: 0.5 - offset * 0.2,
                }}
              />
            ))}

            <AnimatePresence mode="popLayout">
              {current && (
                <motion.div
                  key={current.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.9}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 92 || info.velocity.x > 600) vote(1);
                    else if (info.offset.x < -92 || info.velocity.x < -600) vote(-1);
                  }}
                  animate={{
                    x: direction === 1 ? 420 : direction === -1 ? -420 : 0,
                    rotate: direction === 1 ? 10 : direction === -1 ? -10 : 0,
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{ x, rotate }}
                  className="card-elevated absolute inset-0 cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
                >
                  {/* Verdict stamps pressing in with the pull */}
                  <motion.span
                    aria-hidden
                    style={{ opacity: yesOpacity, scale: yesScale }}
                    className="stamp pointer-events-none absolute left-4 top-4 z-10 -rotate-6 text-positive-ink"
                  >
                    Wieder kaufen
                  </motion.span>
                  <motion.span
                    aria-hidden
                    style={{ opacity: noOpacity, scale: noScale }}
                    className="stamp pointer-events-none absolute right-4 top-4 z-10 rotate-6 text-regret-ink"
                  >
                    Nie wieder
                  </motion.span>

                  <div className="flex h-full flex-col p-5">
                    <div className="grid flex-1 place-items-center text-center">
                      <div>
                        <Thumb
                          product={current}
                          className="mx-auto h-28 w-28"
                          rounded="rounded-[1.1rem]"
                        />
                        <p className="mono-data mt-4 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {[current.brand, current.category?.name].filter(Boolean).join(' · ') ||
                            'Produkt'}
                        </p>
                        <h3 className="font-display mx-auto mt-1.5 line-clamp-2 max-w-[16rem] text-[1.7rem] leading-[1.05] text-label">
                          {current.canonicalName}
                        </h3>
                        <p className="font-display mt-3 text-[1.15rem] italic text-ink-soft">
                          Würdest du es wieder kaufen?
                        </p>
                        <p className="mono-data mt-2 text-[0.625rem] uppercase tracking-[0.18em] text-faint">
                          ← Nie wieder · Wieder kaufen →
                        </p>
                      </div>
                    </div>

                    <div className="rule-dashed pt-3" />
                    <div className="flex flex-wrap gap-1.5">
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
                              active ? 'bg-accent text-[#f1efe6]' : 'bg-fill-2 text-muted-foreground',
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
            className="press flex h-12 items-center justify-center gap-2 rounded-full bg-regret-soft text-[0.9375rem] font-semibold text-regret-ink"
          >
            <ThumbsDown className="h-5 w-5" strokeWidth={2.4} />
            Nie wieder
          </button>
          <button
            type="button"
            onClick={() => vote(1)}
            className="press flex h-12 items-center justify-center gap-2 rounded-full bg-positive text-[0.9375rem] font-semibold text-[#f7f5ef] shadow-[0_8px_22px_-12px_rgba(31,138,77,0.8)]"
          >
            <ThumbsUp className="h-5 w-5" strokeWidth={2.4} />
            Wieder kaufen
          </button>
        </div>
      )}

      {current && !done && (
        <Link
          href={`/products/${current.id}/own`}
          className="tap-dim mono-data block text-center text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-accent"
        >
          Ausführlich bewerten
        </Link>
      )}
    </section>
  );
}
