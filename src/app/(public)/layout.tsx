import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/platform/brand';
import { AppRuntime } from '@/components/app-runtime';
import type { Metadata } from 'next';
import { WorldHeader } from '@/components/public/world-header';
import { CartPanel } from '@/components/commerce/cart-panel';
import { commerceConfigured } from '@/domains/commerce/shopify';
import './world.css';
import './cinematic.css';
import './commerce-experience.css';
export const metadata: Metadata = {
  robots: { index: process.env.VERCEL_ENV === 'production', follow: true },
  description: brand.description,
};
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppRuntime />
      <a className="skip" href="#world-main">
        Skip to content
      </a>
      <WorldHeader />
      {commerceConfigured() && <CartPanel />}
      {children}
      <footer className="world-footer">
        <div>
          <Link href="/" className="footer-brand">
            <Image
              className="footer-crest"
              src={brand.crest}
              alt={brand.crestAlt}
              width={180}
              height={180}
              sizes="180px"
            />
            <span>
              AETHELIOS<small>INTELLIGENCE</small>
            </span>
          </Link>
          <p>
            Your context.
            <br />
            Your direction.
          </p>
        </div>
        <nav aria-label="Footer navigation"><Link href="/enter">Sign in</Link><Link href="/membership">Account plans</Link><Link href="/support">Support</Link><Link href="/shop">Legacy Reserve products</Link></nav>
        <div className="footer-note">
          <span>THINK · CREATE · CONTINUE</span>
          <small>© {new Date().getFullYear()} Aethelios</small>
        </div>
      </footer>
    </>
  );
}
