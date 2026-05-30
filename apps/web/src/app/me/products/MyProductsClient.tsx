'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OwnershipDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/Button';
import { LoadingState, EmptyState } from '@/components/states/States';

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Meine Produkte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produkte, die du besitzt oder bewertet hast.
        </p>
      </div>

      {ownerships.length > 0 ? (
        <div className="space-y-3">
          {ownerships.map((o) =>
            o.product ? <ProductCard key={o.id} product={o.product} /> : null,
          )}
        </div>
      ) : (
        <EmptyState
          icon="📦"
          title="Noch keine Produkte"
          description="Sobald du ein Produkt bewertest, erscheint es hier."
          action={
            <Link href="/check?own=1">
              <Button>Produkt hinzufügen</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
