import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginClient } from './LoginClient';
import { LoadingState } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Anmelden',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginClient />
    </Suspense>
  );
}
