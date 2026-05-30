'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OwnershipDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ProductList } from '@/components/ProductList';
import { Button } from '@/components/ui/Button';
import { LoadingState, EmptyState } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';

export function MyProductsClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [ownerships, setOwnerships] = useState<OwnershipDto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/me/products');
      return;
    }
    api.ownership
      .mine({ cache: 'no-store' })
      .then(setOwnerships)
      .catch(() => undefined)
      .finally(() => setDataLoading(false));
  }, [user, loading, router]);

  if (loading || dataLoading) return <LoadingState />;
  if (!user) return null;

  const products = ownerships.map((o) => o.product).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className="animate-fade space-y-4 pt-2">
      <LargeTitle title="Meine Produkte" subtitle="Produkte, die du besitzt oder bewertet hast." />

      {products.length > 0 ? (
        <ProductList products={products} />
      ) : (
        <div className="rounded-[var(--radius-lg)] bg-surface">
          <EmptyState
            title="Noch keine Produkte"
            description="Sobald du ein Produkt bewertest, erscheint es hier."
            action={
              <Link href="/check?own=1">
                <Button>Produkt hinzufügen</Button>
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
