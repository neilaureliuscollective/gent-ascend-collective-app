// Test-only native link adapter. Next navigation is exercised against the production server.
import type { AnchorHTMLAttributes } from 'react';
export default function FixtureLink({
  prefetch,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean | null | 'auto' }) {
  void prefetch;
  // Historical commerce links stay inside this isolated component fixture.
  // Production navigation is exercised against the application server separately.
  const mode = new URLSearchParams(location.search).get('mode') ?? '';
  if (mode.startsWith('archived-commerce') && props.href?.startsWith('/shop')) {
    const destination = new URL(props.href, location.origin);
    const handle = destination.pathname.split('/')[2];
    const fixture = new URL('/', location.origin);
    fixture.searchParams.set(
      'mode',
      handle ? 'archived-commerce-product' : 'archived-commerce-shop',
    );
    if (handle) fixture.searchParams.set('handle', handle);
    if (destination.searchParams.get('saved') === '1') fixture.searchParams.set('saved', '1');
    fixture.hash = destination.hash;
    return <a {...props} href={fixture.pathname + fixture.search + fixture.hash} />;
  }
  return <a {...props} />;
}
