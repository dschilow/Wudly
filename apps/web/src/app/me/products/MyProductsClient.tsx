'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MyProductsDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ProductList } from '@/components/ProductList';
import { Button } from '@/components/ui/Button';
import { PageSkeleton, EmptyState } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';

function GroupLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <h2 className="text-[1.0625rem] font-bold tracking-tight text-label">{children}</h2>
      <span className="tnum text-[0.8125rem] font-medium text-faint">{count}</span>
    </div>
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

  if (loading || dataLoading) return <PageSkeleton />;
  if (!user) return null;

  const owned = data?.owned ?? [];
  const created = data?.created ?? [];
  const empty = owned.length === 0 && created.length === 0;

  return (
    <div className="animate-fade space-y-6 pt-2">
      <LargeTitle title="Meine Produkte" subtitle="Was du besitzt und was du zu Wudly hinzugefügt hast." />

      {empty ? (
        <div className="card">
          <EmptyState
            title="Noch keine Produkte"
            description="Scanne, fotografiere oder bewerte ein Produkt — es erscheint dann hier."
            action={
              <Link href="/check?own=1">
                <Button>Produkt hinzufügen</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {owned.length > 0 && (
            <section>
              <GroupLabel count={owned.length}>Besitzt &amp; bewertet</GroupLabel>
              <ProductList products={owned} />
            </section>
          )}

          {created.length > 0 && (
            <section>
              <GroupLabel count={created.length}>Von dir hinzugefügt</GroupLabel>
              <ProductList products={created} />
              <p className="mt-2 px-1 text-[0.8125rem] leading-snug text-muted-foreground">
                Du bekommst eine Mitteilung, sobald jemand zu diesen Produkten eine Frage stellt.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
