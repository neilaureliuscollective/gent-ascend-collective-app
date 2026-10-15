import type { IconName } from './visual/icon';

/** Presentation only: server routes and services remain the authorization boundary. */
export type NavigationAccess = { signedIn?: boolean; founderOffice?: boolean; developer?: boolean };
type Destination = {
  href: string;
  label: string;
  icon: IconName;
  group: 'Spaces' | 'Account' | 'Founder';
  publicHref?: string;
  primary?: boolean;
  audience?: 'founder' | 'developer';
};
export const destinations: readonly Destination[] = [
  { href: '/app', publicHref: '/', label: 'Home', primary: true, icon: 'command', group: 'Spaces' },
  { href: '/app/aethelios', label: 'Talk', primary: true, icon: 'spark', group: 'Spaces' },
  { href: '/app/work', label: 'Work', primary: true, icon: 'command', group: 'Spaces' },
  { href: '/app/architect', label: 'Architect', primary: true, icon: 'expand', group: 'Spaces' },
  { href: '/app/studio', label: 'Studio', icon: 'collection', group: 'Spaces' },
  { href: '/app/health', label: 'Health', icon: 'person', group: 'Spaces' },
  {
    href: '/app/lifestyle',
    publicHref: '/lifestyle',
    label: 'Lifestyle',
    icon: 'collection',
    group: 'Spaces',
  },
  { href: '/app/ecosystem', label: 'Ecosystem', icon: 'world', group: 'Spaces' },
  {
    href: '/app/membership',
    publicHref: '/membership',
    label: 'Membership',
    icon: 'shield',
    group: 'Account',
  },
  { href: '/app/you', label: 'Account & settings', icon: 'person', group: 'Account' },
  { href: '/app/missions', label: 'Missions', icon: 'command', group: 'Spaces' },
  { href: '/app/entities', label: 'Council', icon: 'person', group: 'Spaces' },
  { href: '/app/aethelios/meet', label: 'Meet Aethelios', icon: 'spark', group: 'Account' },
  { href: '/support', label: 'Support', icon: 'world', group: 'Account' },
  {
    href: '/app/founder',
    label: 'Founder Office',
    icon: 'shield',
    group: 'Founder',
    audience: 'founder',
  },
  {
    href: '/dev',
    label: 'Developer console',
    icon: 'expand',
    group: 'Founder',
    audience: 'developer',
  },
];
export function visibleDestinations(access: NavigationAccess = {}) {
  return destinations
    .filter(
      (d) =>
        !d.audience ||
        (d.audience === 'founder'
          ? access.signedIn && access.founderOffice
          : access.signedIn && access.developer),
    )
    .map((d) => ({ ...d, href: !access.signedIn && d.publicHref ? d.publicHref : d.href }));
}
export function destinationIsCurrent(href: string, path: string) {
  if (href === '/' || href === '/app') return path === '/' || path === '/app';
  if (
    href === '/lifestyle' &&
    (path === '/app/lifestyle' ||
      path.startsWith('/app/lifestyle/') ||
      path.startsWith('/app/collection'))
  )
    return true;
  if (href === '/membership' && path === '/app/membership') return true;
  return (
    path === href ||
    path.startsWith(href + '/') ||
    (href === '/app/aethelios' && path.startsWith('/app/companies/')) ||
    (href === '/app/lifestyle' && path.startsWith('/app/collection'))
  );
}
