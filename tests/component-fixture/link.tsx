// Test-only native link adapter. Next navigation is exercised against the production server.
import type { AnchorHTMLAttributes } from 'react';
export default function FixtureLink({
  prefetch,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean | null | 'auto' }) {
  void prefetch;
  return <a {...props} />;
}
