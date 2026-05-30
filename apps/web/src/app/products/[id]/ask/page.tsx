import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { AskClient } from './AskClient';

export const metadata: Metadata = {
  title: 'Besitzer fragen',
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AskPage({ params }: PageProps) {
  const { id } = await params;
  let product;
  try {
    product = await api.products.get(id, { cache: 'no-store' });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return <AskClient productId={product.id} productName={product.canonicalName} />;
}
