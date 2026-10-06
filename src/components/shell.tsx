import { ConversationDraftProvider } from './aurelius/draft-handoff';
import { ConnectionField } from './visual/connection-field';
import Link from 'next/link';
import { Navigation } from './navigation';
import { Capabilities } from './workspace/capabilities';
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
      <div className="app-shell">
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
          <Capabilities />
          <div className="sidebar-footer"><Link href="/app/you">Account and privacy →</Link><span className="quiet-label">Your context. Your direction.</span></div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <Link href="/app" className="mobile-brand" aria-label="Aethelios home">
              <Brand compact />
            </Link>
            <span className="topbar-context">
              AETHELIOS <span>/</span> INTELLIGENCE ENVIRONMENT
            </span>
            <div className="topbar-actions">
              <div className="mobile-capabilities"><Capabilities /></div>
              <UniversalCapture />
              <AppearanceControls />
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
