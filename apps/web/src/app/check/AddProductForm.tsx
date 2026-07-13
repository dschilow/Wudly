'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import type { ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { productPath } from '@/lib/seo';

interface AddProductFormProps {
  initialName: string;
  ownIntent?: boolean;
}

/**
 * One-field product import. The same research pipeline as scan/search resolves
 * duplicates and enriches new products before the user sees the detail page.
 */
export function AddProductForm({ initialName, ownIntent }: AddProductFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToProduct = (product: ProductSummaryDto) => {
    router.push(ownIntent ? `/products/${product.id}/own` : productPath(product));
  };

  const submit = async () => {
    const query = name.trim();
    if (query.length < 2) {
      setError('Bitte gib Hersteller und Modell ein.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.products.research(query);
      if (!result.product) {
        setError(
          'Das Produkt konnte nicht eindeutig gefunden werden. Ergänze bitte die Modellnummer.',
        );
        return;
      }
      show(
        result.created ? 'Produkt vollständig recherchiert' : 'Produkt bereits gefunden',
        'success',
      );
      goToProduct(result.product);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Recherche fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-accent/20 bg-accent-soft px-4 py-3">
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-label">
          <Sparkles className="h-4 w-4 text-accent-ink" aria-hidden />
          Ein Name genügt
        </p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
          Wudly prüft Dubletten, Herstellerdaten, technische Daten, Produktbild und belegte
          Erfahrungsquellen automatisch. Keine Rechnung erforderlich.
        </p>
      </div>

      {submitting && (
        <div className="rounded-[var(--radius-lg)] bg-surface px-4 py-3" role="status">
          <p className="flex items-center gap-2 text-[0.875rem] font-medium text-label">
            <Sparkles className="h-4 w-4 animate-pulse text-accent" aria-hidden />
            Produkt und Quellen werden geprüft …
          </p>
          <p className="mt-1 pl-6 text-[0.8125rem] leading-snug text-muted-foreground">
            Meist dauert das nur wenige Sekunden.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="new-product-name"
          className="mono-data mb-2 block px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Hersteller und Modell
        </label>
        <input
          id="new-product-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          autoComplete="off"
          placeholder="z. B. Bosch WGB244040"
          aria-describedby="new-product-hint"
          className="min-h-12 w-full rounded-[var(--radius-lg)] bg-surface px-4 text-[1.0625rem] text-label shadow-[inset_0_0_0_1px_var(--color-border)] outline-none placeholder:text-faint"
        />
        <p id="new-product-hint" className="mt-2 px-1 text-[0.8125rem] text-muted-foreground">
          Tipp: Die genaue Modellnummer verhindert Verwechslungen.
        </p>
      </div>

      {error && (
        <p className="px-1 text-[0.9375rem] text-regret" role="alert">
          {error}
        </p>
      )}

      <Button fullWidth size="lg" loading={submitting} onClick={() => void submit()}>
        {ownIntent ? 'Produkt finden und eintragen' : 'Produkt vollständig recherchieren'}
      </Button>
    </div>
  );
}
