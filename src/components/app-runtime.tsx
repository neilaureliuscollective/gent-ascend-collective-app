'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
/** Only static fallback assets are cached. Personal responses always use the network. */
export function AppRuntime() {
  const path = usePathname();
  useEffect(() => {
    if (document.cookie.split('; ').includes('performance-reset=1')) {
      void import('../../public/performance-store.js')
        .then(async ({ clearDrafts }) => {
          await clearDrafts();
          document.cookie = 'performance-reset=; Max-Age=0; Path=/; SameSite=Strict';
        })
        .catch(() => {});
    }
  }, [path]);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;
    let checkedAt = Date.now();
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((value) => {
        if (!disposed) registration = value;
      })
      .catch(() => {});
    const resume = () => {
      if (document.visibilityState !== 'visible' || Date.now() - checkedAt < 60_000) return;
      checkedAt = Date.now();
      void registration?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, []);
  return null;
}
