'use client';
import { usePathname } from 'next/navigation';
import { CartPanel } from './cart-panel';
export function MemberCartLauncher({ basePath = '/app/collection' }: { basePath?: string }) {
  const path = usePathname();
  return path === `${basePath}/cart` ? null : <CartPanel basePath={basePath} />;
}
