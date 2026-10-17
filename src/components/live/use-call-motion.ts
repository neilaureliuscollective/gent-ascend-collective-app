'use client';
import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function snapshot() {
  return !window.matchMedia(query).matches;
}
const serverSnapshot = () => false;

/** Call feedback is automatic; the page's legacy Ambient/Still choice is unrelated. */
export function useCallMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
