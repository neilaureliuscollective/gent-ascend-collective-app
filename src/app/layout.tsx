import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const sora = localFont({
  src: '../assets/fonts/sora.woff2',
  variable: '--font-display',
  display: 'swap',
});
const inter = localFont({
  src: '../assets/fonts/inter.woff2',
  variable: '--font-body',
  display: 'swap',
});
export const metadata: Metadata = {
  title: { default: 'Aurelius Collective', template: '%s · Aurelius Collective' },
  description: 'Your personal operating environment.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  themeColor: '#09070B',
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
