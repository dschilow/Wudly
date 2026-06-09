import type { Metadata } from 'next';
import { StudioClient } from './StudioClient';

export const metadata: Metadata = {
  title: 'Creator-Studio',
  robots: { index: false },
};

export default function StudioPage() {
  return <StudioClient />;
}
