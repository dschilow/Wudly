import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PulseShell } from '@/components/pulse/PulseShell';

export const metadata: Metadata = {
  title: {
    default: 'Wudly Pulse',
    template: '%s · Wudly Pulse',
  },
  robots: { index: false },
};

export default function PulseLayout({ children }: { children: ReactNode }) {
  return <PulseShell>{children}</PulseShell>;
}
