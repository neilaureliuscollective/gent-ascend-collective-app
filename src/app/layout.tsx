import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { PerformanceReporting } from '@/components/performance-reporting';
import { brand } from '@/platform/brand';
import './globals.css';
import './interaction.css';
import './aether-materials.css';
import './imperial-materials.css';
import './imperial-workspace.css';
import './imperial-emerald-ii.css';
import './obsidian-smoked-glass.css';
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
  openGraph: {
    title: brand.name,
    description: brand.description,
    siteName: brand.name,
  },
  twitter: { card: 'summary_large_image', title: brand.name, description: brand.description },
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
        <noscript>
          <section className="panel">
            <p>
              If this screen stays here, enable JavaScript to use the interactive workspace. Your
              saved work stays with your account.
            </p>
            <nav aria-label="Workspace fallback">
              <Link href="/enter">Your account</Link> · <Link href="/">Aethelios home</Link>
            </nav>
          </section>
        </noscript>
        {process.env.GENT_PERFORMANCE_ENABLED === 'true' && <PerformanceReporting />}
        {children}
      </body>
    </html>
  );
}
