import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResetPasswordClient } from './ResetPasswordClient';
import { LoadingState } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Passwort zurücksetzen',
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
