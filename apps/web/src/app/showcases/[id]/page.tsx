import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ShowcaseRenderer } from '@/components/showcase/ShowcaseRenderer';
import { Thumb } from '@/components/Thumb';
import { productPath } from '@/lib/seo';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const showcase = await api.showcase.get(id, { next: { revalidate: 120 } });
    return {
      title: `${showcase.title} — ${showcase.profile.displayName}`,
      description: showcase.subtitle ?? undefined,
      // Showcase pages are commercial content — keep them out of the neutral index.
      robots: { index: false, follow: true },
    };
  } catch {
    return { title: 'Showcase' };
  }
}

export default async function ShowcasePage({ params }: PageProps) {
  const { id } = await params;

  let showcase;
  try {
    showcase = await api.showcase.get(id, { next: { revalidate: 60 } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="animate-fade space-y-5 pb-8 pt-1">
      <Link
        href={showcase.product ? productPath(showcase.product) : `/products/${showcase.productId}`}
        className="tap-dim inline-flex items-center gap-1.5 text-[0.9375rem] text-accent"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Zum Produkt
      </Link>

      {/* Product context + the "this is not the score" reminder */}
      {showcase.product && (
        <Link
          href={productPath(showcase.product)}
          className="press card flex items-center gap-3 p-3"
        >
          <Thumb product={showcase.product} className="h-12 w-12" rounded="rounded-[0.7rem]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-semibold text-label">
              {showcase.product.canonicalName}
            </p>
            <p className="flex items-center gap-1 text-[0.75rem] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} />
              Neutrales Wudly-Signal auf der Produktseite
            </p>
          </div>
        </Link>
      )}

      <ShowcaseRenderer showcase={showcase} />
    </div>
  );
}
