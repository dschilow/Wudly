'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Box,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import type { MyProductsDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { dataConfidenceLabel, isEarlySignal } from '@/lib/verdict';
import { PageSkeleton, EmptyState } from '@/components/states/States';
import { Thumb } from '@/components/Thumb';
import { HouseholdSwipeDeck } from '@/app/check/HouseholdSwipeDeck';
import { productPath } from '@/lib/seo';

type ProductRelation = 'owned' | 'created';

function ProductItem({ product, relation }: { product: ProductSummaryDto; relation: ProductRelation }) {
  const scoreText =
    product.rebuyScore === null
      ? 'Noch keine Bewertungen'
      : isEarlySignal(product.experienceCount)
        ? dataConfidenceLabel(product.experienceCount)
        : `${product.rebuyScore}% würden wieder kaufen`;
  const tone =
    product.rebuyScore === null
      ? 'bg-faint'
      : product.rebuyScore >= 65
        ? 'bg-positive'
        : product.rebuyScore >= 45
          ? 'bg-unsure'
          : 'bg-regret';

  return (
    <Link href={productPath(product)} className="card press flex items-center gap-3 p-3">
      <Thumb product={product} className="h-[4.9rem] w-[4.9rem]" rounded="rounded-[1rem]" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[1.125rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[0.9375rem] text-muted-foreground">
          <CalendarDays className="h-4 w-4" strokeWidth={2.2} />
          {relation === 'owned' ? 'Von dir als Besitz markiert' : 'Von dir angelegt'}
        </p>
        <p className="mt-1 flex items-center gap-2 text-[0.9375rem] text-muted-foreground">
          <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
          <span className="font-medium text-label">{scoreText}</span>
        </p>
      </div>
      <ChevronRight className="h-6 w-6 shrink-0 text-label-3" strokeWidth={2.3} />
    </Link>
  );
}

export function MyProductsClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [data, setData] = useState<MyProductsDto | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/me/products');
      return;
    }
    api.products
      .mine({ cache: 'no-store' })
      .then(setData)
      .catch(() => undefined)
      .finally(() => setDataLoading(false));
  }, [user, loading, router]);

  const products = useMemo(
    () => [
      ...(data?.owned ?? []).map((product) => ({ product, relation: 'owned' as const })),
      ...(data?.created ?? []).map((product) => ({ product, relation: 'created' as const })),
    ],
    [data],
  );
  const productSummaries = products.map((entry) => entry.product);
  const lastProduct = productSummaries[0];

  if (loading || dataLoading) return <PageSkeleton />;
  if (!user) return null;

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-7 pt-2"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      <motion.section variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Besitzen
        </p>
        <h1 className="font-display mt-2.5 text-balance text-[3rem] leading-[1.0] text-label">
          Was nutzt du <em className="text-accent-ink">wirklich</em>?
        </h1>
      </motion.section>

      <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
        <Link
          href="/check?own=1"
          className="press sheen brand-gradient flex h-[3.6rem] items-center justify-center gap-2.5 rounded-full text-[1.0625rem] font-semibold text-[#f1efe6] shadow-[var(--shadow-glow)]"
        >
          <Plus className="h-7 w-7" strokeWidth={2.4} />
          Produkt hinzufügen
        </Link>
      </motion.div>

      {/* 3-Sekunden-Check: with products it becomes the swipe deck (drag right =
          wieder kaufen, left = nie wieder); without, a calm static prompt. */}
      <motion.section variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
        {products.length > 0 ? (
          <HouseholdSwipeDeck
            products={productSummaries}
            title="3-Sekunden-Check"
            subtitle="Würdest du es wieder kaufen?"
          />
        ) : (
          <div className="card-elevated p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                <Zap className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-accent-ink">
                  3-Sekunden-Check
                </p>
                <h2 className="font-display mt-1 text-[1.45rem] italic leading-snug text-label">
                  Würdest du dein letztes Produkt wieder kaufen?
                </h2>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Ja', icon: ThumbsUp, tone: 'text-positive-ink ring-positive/35' },
                { label: 'Nein', icon: ThumbsDown, tone: 'text-muted-foreground ring-border' },
                { label: 'Unsicher', icon: CircleHelp, tone: 'text-unsure-ink ring-unsure/35' },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <Link
                    key={option.label}
                    href={lastProduct ? `/products/${lastProduct.id}/own` : '/check?own=1'}
                    className={`press flex h-12 items-center justify-center gap-2 rounded-full bg-surface text-[0.9375rem] font-semibold shadow-[var(--shadow-xs)] ring-1 ${option.tone}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </motion.section>

      <motion.section
        className="space-y-3"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        <div className="flex items-baseline justify-between px-1">
          <h2 className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Meine Produkte
          </h2>
          {products.length > 0 && (
            <span className="mono-data text-[0.75rem] font-semibold text-accent">
              {products.length}
            </span>
          )}
        </div>
        {products.length > 0 ? (
          <div className="space-y-3">
            {products.slice(0, 8).map(({ product, relation }) => (
              <ProductItem key={`${relation}-${product.id}`} product={product} relation={relation} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={<Box className="h-7 w-7" strokeWidth={1.8} />}
              title="Noch keine Produkte"
              description="Füge dein erstes Produkt hinzu und teile dein Signal."
            />
          </div>
        )}
      </motion.section>

      <motion.section
        className="card flex items-center gap-4 p-4"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-positive-soft text-positive-ink">
          <Box className="h-6 w-6" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-positive-ink">
            Dein Impact
          </p>
          <p className="mt-0.5 text-[1.0625rem] font-semibold leading-snug text-label">
            Jede echte Erfahrung macht ein Produkt für andere Käufer nützlicher.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-label-3" strokeWidth={2.3} />
      </motion.section>
    </motion.div>
  );
}
