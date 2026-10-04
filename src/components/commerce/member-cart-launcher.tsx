'use client';
import { usePathname } from 'next/navigation';
import { CartPanel } from './cart-panel';
export function MemberCartLauncher() {
  const path = usePathname();
  return path === '/app/collection/cart' ? null : <CartPanel basePath="/app/collection" />;
}
