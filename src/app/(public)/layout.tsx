import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/platform/brand';
import { AppRuntime } from '@/components/app-runtime';
import type { Metadata } from 'next';
import { WorldHeader } from '@/components/public/world-header';
import { CinematicWorld } from '@/components/public/cinematic-world';
import './world.css';
import './cinematic.css';
import './commerce-experience.css';
import '../imperial-ascend.css';
export const metadata: Metadata = {
  robots: { index: process.env.VERCEL_ENV === 'production', follow: true },
  description: 'Aethelios helps founders and operators build, grow and operate companies.',
};
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CinematicWorld>
      <AppRuntime />
      <a className="skip" href="#world-main">
        Skip to content
      </a>
      <WorldHeader />
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
              AETHELIOS<small>PERSONAL INTELLIGENCE OS</small>
            </span>
          </Link>
          <p>
            Rooted in Louisiana.
            <br />
            Built for company builders.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/about">Our story</Link>
          <Link href="/support">Member support</Link>
          <Link href="/app/studio">Studio</Link>
          <Link href="/app/work">Company work</Link>
          <Link href="/reserve">The Reserve</Link>
          <Link href="/enter">Open Aethelios</Link>
        </nav>
        <div className="footer-note">
          <span>CARE · CHARACTER · DIRECTION</span>
          <small>© {new Date().getFullYear()} Aethelios</small>
        </div>
      </footer>
    </CinematicWorld>
  );
}
