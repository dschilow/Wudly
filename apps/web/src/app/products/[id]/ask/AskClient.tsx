'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AskForm } from '@/components/AskForm';
import { AuthGate } from '@/components/AuthGate';
import { productPath } from '@/lib/seo';

/** Standalone /ask route — same composer the product page opens as a sheet. */
export function AskClient({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return (
      <AuthGate
        title="Frage an Besitzer"
        description={`Melde dich an, um Besitzern von „${productName}" eine Frage zu stellen.`}
        redirect={`/products/${productId}/ask`}
      />
    );
  }

  return (
    <div className="animate-fade mx-auto max-w-md pt-4">
      <AskForm
        productId={productId}
        productName={productName}
        onDone={() => router.push(productPath({ id: productId, canonicalName: productName }))}
      />
    </div>
  );
}
