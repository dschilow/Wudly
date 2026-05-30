import type { Metadata } from 'next';
import { ProfileClient } from './ProfileClient';

export const metadata: Metadata = {
  title: 'Mein Profil',
  robots: { index: false },
};

export default function MePage() {
  return <ProfileClient />;
}
