'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { CategoryDto, ProductSummaryDto, CreateProductResultDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ProductList } from '@/components/ProductList';
import { productPath } from '@/lib/seo';

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

  const goToProduct = (product: ProductSummaryDto) => {
    router.push(ownIntent ? `/products/${product.id}/own` : productPath(product));
  };

  const handleResult = (result: CreateProductResultDto) => {
    if (result.created) {
      show('Produkt angelegt 🎉', 'success');
      goToProduct(result.product);
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
      <div className="rounded-[var(--radius-lg)] bg-surface px-5 py-8 text-center">
        <h3 className="text-[1.0625rem] font-semibold text-label">Melde dich an</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[0.9375rem] text-muted-foreground">
          Um ein Produkt vorzuschlagen, brauchst du ein (kostenloses) Konto.
        </p>
        <Link href="/login" className="mt-4 inline-block">
          <Button>Anmelden</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="px-1 text-[0.9375rem] leading-snug text-muted-foreground">
        Der Name genügt. Wudly prüft Produktdaten, unabhängige Tests und öffentliche
        Bewertungssignale automatisch.
      </p>

      {submitting && (
        <div className="rounded-[var(--radius-lg)] border border-accent/20 bg-accent/5 px-4 py-3">
          <p className="flex items-center gap-2 text-[0.875rem] font-medium text-label">
            <Sparkles className="h-4 w-4 animate-pulse text-accent" aria-hidden />
            Produkt und externe Erfahrungen werden geprüft …
          </p>
          <p className="mt-1 pl-6 text-[0.8125rem] leading-snug text-muted-foreground">
            Das kann einige Sekunden dauern, weil Quellen und Bewertungswerte verifiziert werden.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDuplicates(null);
          }}
          placeholder="Produktname"
          className="hairline w-full bg-transparent px-4 py-3 text-[1.0625rem] text-label outline-none placeholder:text-faint"
        />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[1.0625rem] text-label">Kategorie</span>
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="max-w-[55%] truncate bg-transparent text-right text-[1.0625rem] text-muted-foreground outline-none"
          >
            <option value="">Optional</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

      {duplicates && duplicates.length > 0 ? (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} aria-hidden />
            Meinst du eines dieser Produkte?
          </p>
          <ProductList products={duplicates} />
          <Button variant="gray" fullWidth loading={submitting} onClick={() => void submit(true)}>
            Nein, neues Produkt anlegen
          </Button>
        </div>
      ) : (
        <Button fullWidth size="lg" loading={submitting} onClick={() => void submit(false)}>
          Produkt anlegen
        </Button>
      )}
    </div>
  );
}
