import type { Metadata } from 'next';
import { ProfileClient } from './ProfileClient';

export const metadata: Metadata = {
  title: 'Ich',
  robots: { index: false },
};

export default function MePage() {
  return <ProfileClient />;
}
