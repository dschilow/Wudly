import type { Metadata } from 'next';
import { ProfileEditorClient } from './ProfileEditorClient';

export const metadata: Metadata = {
  title: 'Profi-Profil',
  robots: { index: false },
};

export default function StudioProfilePage() {
  return <ProfileEditorClient />;
}
