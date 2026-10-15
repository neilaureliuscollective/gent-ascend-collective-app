'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Brand } from './visual/brand';
import './environment-frame.css';
import { GlobalNavigation } from './global-navigation';

/** Route presentation only. Identity, access and operation providers stay in Shell. */
export function EnvironmentFrame({
  immersive,
  globalMenu,
  navigation,
  controls,
  ambience,
  children,
}: {
  ambience?: React.ReactNode;
  immersive: boolean;
  globalMenu?: React.ReactNode;
  navigation: React.ReactNode;
  controls: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`app-shell aethelios-aether imperial-workspace${immersive ? ' environment-immersive' : ''}`}
    >
      {ambience}
      <a className="skip" href="#main">
        Skip to content
      </a>
      {immersive ? (
        <>
          <header className="environment-bar">
            <Link href="/app" aria-label="Aethelios home">
              <Brand compact />
            </Link>
            <span className="environment-name">
              ARCHITECT <span>/ CREATION ENVIRONMENT</span>
            </span>
            {globalMenu ?? <GlobalNavigation />}
          </header>
          <main id="main" tabIndex={-1} className="environment-main">
            {children}
          </main>
        </>
      ) : (
        <>
          {navigation}
          <div className="workspace">
            {controls}
            <main id="main" tabIndex={-1}>
              {children}
            </main>
          </div>
        </>
      )}
    </div>
  );
}

export function ShellWorkspace(
  props: Omit<React.ComponentProps<typeof EnvironmentFrame>, 'immersive'>,
) {
  const path = usePathname();
  return (
    <EnvironmentFrame
      key={path === '/app/architect' ? 'architect' : 'standard'}
      immersive={path === '/app/architect'}
      {...props}
    />
  );
}
