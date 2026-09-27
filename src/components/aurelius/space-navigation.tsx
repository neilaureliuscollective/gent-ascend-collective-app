'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AetheliosSpaceNavigation({
  placement,
}: {
  placement: 'sidebar' | 'chat' | 'studio';
}) {
  const path = usePathname();

  return (
    <nav className={`aethelios-space-navigation is-${placement}`} aria-label="Aethelios spaces">
      <Link href="/app/aethelios" aria-current={path === '/app/aethelios' ? 'page' : undefined}>
        Chat
      </Link>
      <Link href="/app/studio" aria-current={path === '/app/studio' ? 'page' : undefined}>
        Studio
      </Link>
    </nav>
  );
}
