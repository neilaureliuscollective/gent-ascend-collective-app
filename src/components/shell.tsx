import { ConnectionField } from './visual/connection-field';
import Link from 'next/link';
import { Navigation } from './navigation';
import { AureliusPanel } from './aurelius-panel';
import { Brand } from './visual/brand';
import { AppearanceControls, VisualEnvironment } from './visual/appearance';
import { Icon } from './visual/icon';
import { UniversalCapture } from './capture/universal-capture';
export function Shell({
  children,
  founder = false,
}: {
  children: React.ReactNode;
  founder?: boolean;
}) {
  return (
    <div className="app-shell">
      <VisualEnvironment>
        <ConnectionField />
      </VisualEnvironment>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="wordmark" href="/" aria-label="Gent Ascend Collective home">
          <Brand />
        </Link>
        <p className="navigation-label">YOUR ASCENT</p>
        <Navigation />
        <AureliusPanel />
        <div className="sidebar-footer">
          <span className="brand-star" aria-hidden="true">
            ✦
          </span>
          <p>
            Strength. Discipline.
            <br />
            Character. Legacy.
          </p>
          <span className="quiet-label">A better standard, built daily.</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link href="/" className="mobile-brand" aria-label="Gent Ascend Collective home">
            <Brand compact />
          </Link>
          <span className="topbar-context">
            GENT ASCEND <span>/</span> YOUR PERSONAL COMMAND
          </span>
          <div className="topbar-actions">
            <UniversalCapture />
            <AppearanceControls />
            {founder && <Link href="/dev">Developer console</Link>}
            <Link href="/you" className="avatar" aria-label="Your account">
              <Icon name="person" />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
