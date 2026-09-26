import Link from 'next/link';
import type { Metadata } from 'next';
import { WorldHeader } from '@/components/public/world-header';
import { CinematicWorld } from '@/components/public/cinematic-world';
import './world.css';
import './cinematic.css';
export const metadata: Metadata = {
  robots: { index: process.env.VERCEL_ENV === 'production', follow: true },
  description:
    'Gent Ascend Collective connects grooming, personal intelligence, daily practice, and the Reserve at Sanctum. Rooted in Louisiana. Built around the man.',
};
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CinematicWorld>
      <a className="skip" href="#world-main">
        Skip to content
      </a>
      <WorldHeader />
      {children}
      <footer className="world-footer">
        <div>
          <Link href="/" className="footer-brand">
            GENT ASCEND<small>COLLECTIVE</small>
          </Link>
          <p>
            Rooted in Louisiana.
            <br />
            Built around the man.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/about">Our story</Link>
          <Link href="/membership">Membership</Link>
          <Link href="/reserve">The Reserve</Link>
          <Link href="/enter">Member entrance</Link>
        </nav>
        <div className="footer-note">
          <span>CARE · CHARACTER · DIRECTION</span>
          <small>© {new Date().getFullYear()} Gent Ascend Collective</small>
        </div>
      </footer>
    </CinematicWorld>
  );
}
