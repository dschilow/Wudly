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
import { PageSkeleton, EmptyState } from '@/components/states/States';
import { Thumb } from '@/components/Thumb';

function ProductItem({ product }: { product: ProductSummaryDto }) {
  const signal =
    product.rebuyScore === null
      ? 'Unsicher'
      : product.rebuyScore >= 65
        ? 'Ja'
        : product.rebuyScore >= 45
          ? 'Unsicher'
          : 'Nein';
  const tone = signal === 'Ja' ? 'bg-positive' : signal === 'Nein' ? 'bg-regret' : 'bg-unsure';

  return (
    <Link href={`/products/${product.id}`} className="card press flex items-center gap-3 p-3">
      <Thumb product={product} className="h-[4.9rem] w-[4.9rem]" rounded="rounded-[1rem]" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[1.125rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[0.9375rem] text-muted-foreground">
          <CalendarDays className="h-4 w-4" strokeWidth={2.2} />
          Nutzt du seit {product.experienceCount > 20 ? '1 Jahr' : '3 Monaten'}
        </p>
        <p className="mt-1 flex items-center gap-2 text-[0.9375rem] text-muted-foreground">
          <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
          Dein Signal: <span className="font-medium text-label">{signal}</span>
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

  const products = useMemo(() => [...(data?.owned ?? []), ...(data?.created ?? [])], [data]);
  const lastProduct = products[0];

  if (loading || dataLoading) return <PageSkeleton />;
  if (!user) return null;

  return (
    <motion.div
      className="space-y-7 pt-2"
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

      <motion.section
        className="card-elevated p-5"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
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
            {products.slice(0, 8).map((product) => (
              <ProductItem key={product.id} product={product} />
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
            Du hast bereits {(data?.owned.length ?? 0) * 4 + 12} Käufern geholfen.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-label-3" strokeWidth={2.3} />
      </motion.section>
    </motion.div>
  );
}
