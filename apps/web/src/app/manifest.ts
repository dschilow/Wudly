import type { MetadataRoute } from 'next';

/**
 * Web App Manifest — makes Wudly installable as a standalone app with proper
 * icons, theme, and quick-action shortcuts. Next auto-injects the manifest link.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wudly — Würdest du es wieder kaufen?',
    short_name: 'Wudly',
    description:
      'Echte Besitzer. Echte Nutzung. Bessere Käufe. Der Wiederkauf-Score statt Sterne beim Kauf.',
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'de',
    dir: 'ltr',
    background_color: '#FBFBFD',
    theme_color: '#FBFBFD',
    categories: ['shopping', 'lifestyle', 'productivity'],
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/manifest-icon-192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
      { src: '/manifest-icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
      {
        src: '/manifest-icon-512-maskable.png',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Produkt scannen',
        short_name: 'Scan',
        url: '/check?scan=1',
        description: 'Barcode oder Foto prüfen',
      },
      {
        name: 'Charts',
        short_name: 'Charts',
        url: '/rankings',
        description: 'Top & Flop Rankings',
      },
    ],
  };
}
