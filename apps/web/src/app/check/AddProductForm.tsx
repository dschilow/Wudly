'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CategoryDto, ProductSummaryDto, CreateProductResultDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProductCard } from '@/components/ProductCard';

interface AddProductFormProps {
  initialName: string;
  ownIntent?: boolean;
}

/**
 * Product suggestion form with built-in duplicate protection. If the API responds
 * with "possible_duplicates", we show "did you mean…" candidates and let the user
 * either pick one or force-create a new product.
 */
export function AddProductForm({ initialName, ownIntent }: AddProductFormProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { show } = useToast();

  const [name, setName] = useState(initialName);
  const [categorySlug, setCategorySlug] = useState('');
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<ProductSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.categories
      .list({ cache: 'no-store' })
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  const goToProduct = (id: string) => {
    router.push(ownIntent ? `/products/${id}/own` : `/products/${id}`);
  };

  const handleResult = (result: CreateProductResultDto) => {
    if (result.created) {
      show('Produkt angelegt 🎉', 'success');
      goToProduct(result.product.id);
    } else {
      setDuplicates(result.candidates.map((c) => c.product));
    }
  };

  const submit = async (force: boolean) => {
    if (name.trim().length < 2) {
      setError('Bitte gib einen Produktnamen ein.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.products.create({
        canonicalName: name.trim(),
        categorySlug: categorySlug || undefined,
        forceCreate: force,
      });
      handleResult(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Bitte melde dich an, um ein Produkt vorzuschlagen.');
      } else {
        setError(err instanceof ApiError ? err.displayMessage : 'Anlegen fehlgeschlagen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <Card className="text-center">
        <div className="text-3xl" aria-hidden>
          🔐
        </div>
        <h3 className="mt-2 text-lg font-bold text-ink">Melde dich an</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Um ein Produkt vorzuschlagen, brauchst du ein (kostenloses) Konto.
        </p>
        <Link href="/login" className="mt-4 inline-block">
          <Button>Anmelden / Registrieren</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-ink">Produkt vorschlagen</h3>
        <p className="text-sm text-muted-foreground">
          Kein Datenblatt nötig — der Name genügt. Details kannst du später ergänzen.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Produktname</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDuplicates(null);
            }}
            placeholder="z. B. Roborock S8 Pro Ultra"
            className="h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">
            Kategorie <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
          >
            <option value="">Später ergänzen</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm font-medium text-regret-ink">{error}</p>}

      {duplicates && duplicates.length > 0 ? (
        <div className="space-y-3 rounded-2xl bg-surface-sunken p-4">
          <p className="text-sm font-semibold text-ink">Meinst du eines dieser Produkte?</p>
          <div className="space-y-2">
            {duplicates.map((p) => (
              <button key={p.id} onClick={() => goToProduct(p.id)} className="block w-full text-left">
                <ProductCard product={p} />
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            fullWidth
            loading={submitting}
            onClick={() => void submit(true)}
          >
            Nein, neues Produkt anlegen
          </Button>
        </div>
      ) : (
        <Button fullWidth loading={submitting} onClick={() => void submit(false)}>
          Produkt anlegen
        </Button>
      )}
    </Card>
  );
}
