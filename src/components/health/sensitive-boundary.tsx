'use client';
import { usePathname } from 'next/navigation';
export function SensitiveBoundary({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === '/app/health' || path.startsWith('/app/health/') ? null : children;
}
