import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Aurelius Collective', template: '%s · Aurelius Collective' },
  description: 'Your personal operating environment.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#09080D', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
