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
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}
