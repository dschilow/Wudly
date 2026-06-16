import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/shell/AppShell';
import { siteUrl } from '@/lib/seo';

/* Wudly "Verdict" type system — premium, professional, scannable:
 * - Space Grotesk: the big verdict numerals, scores and headlines.
 * - Inter: all UI text.
 * - JetBrains Mono: data lines (scores, counts, meta). */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans-app',
  display: 'swap',
});
const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display-app',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-app',
  display: 'swap',
});

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
    { media: '(prefers-color-scheme: light)', color: '#F5F6F8' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0C10' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
