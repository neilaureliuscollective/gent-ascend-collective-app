'use client';
import { usePathname } from 'next/navigation';
import { LiveConversationProvider } from '../live/provider';
export function SensitiveLiveProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const path = usePathname();
  const health = path === '/app/health' || path.startsWith('/app/health/');
  return (
    <LiveConversationProvider enabled={enabled && !health}>{children}</LiveConversationProvider>
  );
}
export function SensitiveBoundary({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === '/app/health' || path.startsWith('/app/health/') ? null : children;
}
