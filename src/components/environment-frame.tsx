'use client';
import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Brand } from './visual/brand';
import './environment-frame.css';

/** Route presentation only. Identity, access and operation providers stay in Shell. */
export function EnvironmentFrame({
  immersive,
  navigation,
  controls,
  ambience,
  children,
}: {
  ambience?: React.ReactNode;
  immersive: boolean;
  navigation: React.ReactNode;
  controls: React.ReactNode;
  children: React.ReactNode;
}) {
  const menu = useRef<HTMLDialogElement>(null);
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
            <button
              className="environment-menu-button"
              aria-haspopup="dialog"
              onClick={() => menu.current?.showModal()}
            >
              Aethelios menu
            </button>
          </header>
          <dialog ref={menu} className="environment-menu" aria-labelledby="environment-menu-title">
            <div className="environment-menu-heading">
              <h2 id="environment-menu-title">Your Aethelios environments</h2>
              <button autoFocus onClick={() => menu.current?.close()}>
                Close menu
              </button>
            </div>
            {navigation}
            <Link href="/app/entities" prefetch={false} className="environment-council">
              Council ↗
            </Link>
            {controls}
          </dialog>
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
