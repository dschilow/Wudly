import type { Metadata } from 'next';
import { KiTestClient } from './KiTestClient';

export const metadata: Metadata = {
  title: 'KI-Test',
  robots: { index: false },
};

export default function KiTestPage() {
  return <KiTestClient />;
}
