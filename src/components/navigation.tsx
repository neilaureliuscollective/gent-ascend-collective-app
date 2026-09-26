'use client';
import Link from 'next/link';
import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './visual/icon';
const destinations: [string, string, IconName][] = [
  ['/app', 'Command', 'command'],
  ['/app/world', 'My world', 'world'],
  ['/app/progress', 'Progress', 'progress'],
  ['/app/you', 'You', 'person'],
];
export function Navigation() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="navigation">
      {destinations.map(([href, label, icon], i) => (
        <Fragment key={href}>
          {i === 2 && <span className="navigation-presence-gap" aria-hidden="true" />}
          <Link href={href} aria-current={path === href ? 'page' : undefined}>
            <Icon name={icon} />
            <span>{label}</span>
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
