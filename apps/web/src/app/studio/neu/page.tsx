import type { Metadata } from 'next';
import { NewShowcaseClient } from './NewShowcaseClient';

export const metadata: Metadata = {
  title: 'Neues Showcase',
  robots: { index: false },
};

export default function NewShowcasePage() {
  return <NewShowcaseClient />;
}
