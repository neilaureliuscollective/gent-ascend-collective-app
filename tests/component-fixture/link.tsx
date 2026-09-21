// Test-only native link adapter. Next navigation is exercised against the production server.
import type { AnchorHTMLAttributes } from 'react';
export default function FixtureLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
