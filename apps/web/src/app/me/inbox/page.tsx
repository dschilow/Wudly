import type { Metadata } from 'next';
import { InboxClient } from './InboxClient';

export const metadata: Metadata = { title: 'Mitteilungen' };

export default function InboxPage() {
  return <InboxClient />;
}
