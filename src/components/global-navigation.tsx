'use client';
import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ContextSheet } from './interaction/context-sheet';
import { AppearanceControls } from './visual/appearance';
import { Icon } from './visual/icon';
import { destinationIsCurrent, visibleDestinations, type NavigationAccess } from './destinations';
import './global-navigation.css';

export const NavigationAccessContext = createContext<NavigationAccess>({});
export function NavigationAccessProvider({
  access,
  children,
}: {
  access: NavigationAccess;
  children: React.ReactNode;
}) {
  return (
    <NavigationAccessContext.Provider value={access}>{children}</NavigationAccessContext.Provider>
  );
}
export function GlobalNavigation({ access: suppliedAccess }: { access?: NavigationAccess }) {
  const contextAccess = useContext(NavigationAccessContext);
  const access = suppliedAccess ?? contextAccess;
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const links = visibleDestinations(access);
  const current = links
    .filter((d) => destinationIsCurrent(d.href, path))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <div className="global-navigation">
      <button
        type="button"
        className="global-menu-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">☰</span> Menu
      </button>
      <ContextSheet
        open={open}
        title="Aethelios menu"
        onClose={() => setOpen(false)}
        dismissOnBackdrop
      >
        <nav aria-label="Global navigation">
          {(['Spaces', 'Account', 'Founder'] as const).map((group) => {
            const items = links.filter((d) => d.group === group);
            return items.length ? (
              <section key={group} aria-label={group}>
                <h3>{group}</h3>
                {items.map((d) => (
                  <Link
                    key={d.href}
                    href={d.href}
                    prefetch={false}
                    aria-current={d.href === current ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={d.icon} />
                    <span>{d.label}</span>
                  </Link>
                ))}
              </section>
            ) : null;
          })}
        </nav>
        <section aria-label="Display preferences">
          <h3>Display preferences</h3>
          <AppearanceControls />
        </section>
      </ContextSheet>
    </div>
  );
}
