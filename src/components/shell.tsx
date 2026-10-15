import { ShellWorkspace } from './environment-frame';
import { SensitiveBoundary, SensitiveLiveProvider } from './health/sensitive-boundary';
import { ConversationDraftProvider } from './aurelius/draft-handoff';
import { OriginDraftProvider } from './architect-origin/draft-handoff';
import { ConnectionField } from './visual/connection-field';
import Link from 'next/link';
import { GlobalNavigation, NavigationAccessProvider } from './global-navigation';
import { Navigation } from './navigation';
import { AureliusPanel } from './aurelius-panel';
import { Brand } from './visual/brand';
import { VisualEnvironment } from './visual/appearance';
import { AppRuntime } from './app-runtime';
import { UniversalCapture } from './capture/universal-capture';
import { liveShellAvailability } from '@/domains/live/admission-policy';
export function Shell({
  children,
  founder = false,
  signedIn = false,
  founderOffice = false,
}: {
  children: React.ReactNode;
  founder?: boolean;
  signedIn?: boolean;
  founderOffice?: boolean;
}) {
  const live = liveShellAvailability(process.env, founderOffice);
  return (
    <NavigationAccessProvider access={{ signedIn, founderOffice, developer: founder }}>
      <SensitiveLiveProvider enabled={live.enabled} unavailableReason={live.reason}>
        <ConversationDraftProvider>
          <OriginDraftProvider>
            <ShellWorkspace
              globalMenu={
                <GlobalNavigation access={{ signedIn, founderOffice, developer: founder }} />
              }
              ambience={
                <>
                  <AppRuntime />
                  <VisualEnvironment>
                    <ConnectionField />
                  </VisualEnvironment>
                </>
              }
              navigation={
                <aside className="sidebar">
                  <Link className="wordmark" href="/app" aria-label="Aethelios home">
                    <Brand />
                  </Link>
                  <p className="navigation-label">AETHELIOS</p>
                  <Navigation />
                  <SensitiveBoundary>
                    <AureliusPanel />
                  </SensitiveBoundary>

                  <div className="sidebar-footer">
                    <Link href="/app/work" prefetch={false} className="text-link">
                      Company work ↗
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
              }
              controls={
                <header className="topbar">
                  <Link href="/app" className="mobile-brand" aria-label="Aethelios home">
                    <Brand compact />
                  </Link>
                  <span className="topbar-context">
                    AETHELIOS <span>/</span> PERSONAL INTELLIGENCE OS
                  </span>
                  <div className="topbar-actions">
                    <GlobalNavigation access={{ signedIn, founderOffice, developer: founder }} />
                    <SensitiveBoundary>
                      <UniversalCapture />
                    </SensitiveBoundary>
                  </div>
                </header>
              }
            >
              {children}
            </ShellWorkspace>
          </OriginDraftProvider>
        </ConversationDraftProvider>
      </SensitiveLiveProvider>
    </NavigationAccessProvider>
  );
}
