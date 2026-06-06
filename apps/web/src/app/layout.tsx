import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/shell/AppShell';
import { siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Wudly — Würdest du es wieder kaufen?',
    template: '%s · Wudly',
  },
  description:
    'Wudly zeigt dir, was echte Besitzer nach echter Nutzung über Produkte sagen. Wiederkauf-Score, Regret-Score und Fragen an echte Besitzer.',
  applicationName: 'Wudly',
  keywords: ['Wudly', 'Produkterfahrung', 'Wiederkauf', 'Besitzermeinung', 'Kaufberatung'],
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wudly',
  },
  openGraph: {
    title: 'Wudly — Würdest du es wieder kaufen?',
    description: 'Echte Besitzer. Echte Nutzung. Bessere Käufe.',
    siteName: 'Wudly',
    type: 'website',
    locale: 'de_DE',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wudly — Würdest du es wieder kaufen?',
    description: 'Echte Besitzer. Echte Nutzung. Bessere Käufe.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFBFD' },
    { media: '(prefers-color-scheme: dark)', color: '#111114' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
