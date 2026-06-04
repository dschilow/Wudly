import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/shell/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'Wudly — Würdest du es wieder kaufen?',
    template: '%s · Wudly',
  },
  description:
    'Wudly zeigt dir, was echte Besitzer nach echter Nutzung über Produkte sagen. Wiederkauf-Score, Regret-Score und Fragen an echte Besitzer.',
  applicationName: 'Wudly',
  keywords: ['Wudly', 'Produkterfahrung', 'Wiederkauf', 'Besitzermeinung', 'Kaufberatung'],
  openGraph: {
    title: 'Wudly — Würdest du es wieder kaufen?',
    description: 'Echte Besitzer. Echte Nutzung. Bessere Käufe.',
    siteName: 'Wudly',
    type: 'website',
    locale: 'de_DE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wudly — Würdest du es wieder kaufen?',
    description: 'Echte Besitzer. Echte Nutzung. Bessere Käufe.',
  },
};

export const viewport: Viewport = {
  themeColor: '#f4f5f7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
