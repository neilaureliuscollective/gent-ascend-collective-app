import Link from 'next/link';
import { Navigation } from './navigation';
import { AureliusPanel } from './aurelius-panel';
export function Shell({
  children,
  founder = false,
}: {
  children: React.ReactNode;
  founder?: boolean;
}) {
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="wordmark" href="/" aria-label="Aurelius Collective home">
          <span className="monogram">A</span>
          <span>
            AURELIUS<small>COLLECTIVE</small>
          </span>
        </Link>
        <Navigation />
        <div className="sidebar-footer">
          <p>
            Build a life
            <br />
            <em>with intention.</em>
          </p>
          <span className="eyebrow">Private foundation</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="eyebrow">Aurelius Collective</span>
          <div className="topbar-actions">
            {founder && <Link href="/dev">Developer console</Link>}
            <Link href="/you" className="avatar" aria-label="Your account">
              A
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <AureliusPanel />
    </div>
  );
}
