import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import ScreenTracker from '@/components/ScreenTracker';
import CookieConsent from '@/components/CookieConsent';
import TrackingScripts from '@/components/TrackingScripts';

export const metadata: Metadata = {
  title: 'Nosso Momento',
  description: 'Apimente a relação. Deixe tudo mais gostoso!',
  icons: {
    icon: [
      { url: '/assets/icons/icon-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/assets/icons/favicon.png', type: 'image/png' },
    ],
    apple: '/assets/icons/apple-touch-icon-180x180.png',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body>
        <TrackingScripts />
        <ScreenTracker />
        <AuthProvider>{children}</AuthProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
