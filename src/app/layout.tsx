import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { PerformanceReporting } from '@/components/performance-reporting';
import { brand } from '@/platform/brand';
import './globals.css';
import './ecosystem.css';
import './interaction.css';
import './aether-materials.css';
import './imperial-materials.css';
import './imperial-workspace.css';
import './imperial-tools.css';
import './imperial-environment.css';
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
  title: { default: brand.name, template: `%s · ${brand.shortName}` },
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: 'black-translucent' },
  description: brand.description,
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  themeColor: brand.themeColor,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${inter.variable}`}>
        {process.env.GENT_PERFORMANCE_ENABLED === 'true' && <PerformanceReporting />}
        {children}
      </body>
    </html>
  );
}
