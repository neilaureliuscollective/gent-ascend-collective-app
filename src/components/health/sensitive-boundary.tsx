'use client';
import { usePathname } from 'next/navigation';
import { LiveConversationProvider } from '../live/provider';
export function SensitiveLiveProvider({
  children,
  enabled,
  unavailableReason = 'Aethelios Live is unavailable on this deployment.',
}: {
  children: React.ReactNode;
  enabled: boolean;
  unavailableReason?: string | null;
}) {
  const path = usePathname();
  const health = path === '/app/health' || path.startsWith('/app/health/');
  return (
    <LiveConversationProvider
      enabled={enabled && !health}
      unavailableReason={health ? 'Voice is unavailable on Health routes.' : unavailableReason}
    >
      {children}
    </LiveConversationProvider>
  );
}
export function SensitiveBoundary({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === '/app/health' || path.startsWith('/app/health/') ? null : children;
}
