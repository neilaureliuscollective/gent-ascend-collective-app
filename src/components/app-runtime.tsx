'use client';
import { useEffect } from 'react';
/** Only static fallback assets are cached. Personal responses always use the network. */
export function AppRuntime() {
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}
