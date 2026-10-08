import { ConversationDraftProvider } from './aurelius/draft-handoff';
import { ConnectionField } from './visual/connection-field';
import Link from 'next/link';
import { Navigation } from './navigation';
import { AureliusPanel } from './aurelius-panel';
import { Brand } from './visual/brand';
import { AppearanceControls, VisualEnvironment } from './visual/appearance';
import { Icon } from './visual/icon';
import { AppRuntime } from './app-runtime';
import { UniversalCapture } from './capture/universal-capture';
export function Shell({
  children,
  founder = false,
}: {
  children: React.ReactNode;
  founder?: boolean;
}) {
  return (
    <ConversationDraftProvider>
      <div className="app-shell aethelios-aether">
        <AppRuntime />
        <VisualEnvironment>
          <ConnectionField />
        </VisualEnvironment>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <aside className="sidebar">
          <Link className="wordmark" href="/app" aria-label="Aethelios home">
            <Brand />
          </Link>
          <p className="navigation-label">AETHELIOS</p>
          <Navigation />
          <AureliusPanel />

          <div className="sidebar-footer">
            <Link href="/app/library" prefetch={false} className="text-link">
              Saved work ↗
            </Link>
            <span className="brand-star" aria-hidden="true">
              ✦
            </span>
            <p>
              Think. Build.
              <br />
              Operate.
            </p>
            <span className="quiet-label">A clearer way to build.</span>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <Link href="/app" className="mobile-brand" aria-label="Aethelios home">
              <Brand compact />
            </Link>
            <span className="topbar-context">
              AETHELIOS <span>/</span> PERSONAL INTELLIGENCE
            </span>
            <div className="topbar-actions">
              <UniversalCapture />
              <AppearanceControls />
              <Link href="/app/work" className="text-link shell-ascend-link">
                Your work
              </Link>
              {founder && <Link href="/dev">Developer console</Link>}
              <Link href="/app/you" className="avatar" aria-label="Your account">
                <Icon name="person" />
              </Link>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </ConversationDraftProvider>
  );
}
