import type { Metadata } from 'next';
import { AdminClient } from './AdminClient';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false },
};

export default function AdminPage(): any {
  return <AdminClient />;
}
