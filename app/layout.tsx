import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/nav/AppShell';
import { RegisterSW } from '@/components/pwa/RegisterSW';

export const metadata: Metadata = {
  title: 'Workout Caller',
  description: 'A hands-free workout timer, library, and planner.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Workout Caller',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RegisterSW />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
