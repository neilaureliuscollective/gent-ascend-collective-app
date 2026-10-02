'use client';
import { useSyncExternalStore } from 'react';
import { parseSavedSelection } from '@/domains/commerce/saved-selection';
const key = 'gent-ascend-collection-v1';
const empty: string[] = [];
let rawSnapshot: string | null | undefined;
let snapshot: string[] = empty;
const subscribers = new Set<() => void>();
export function readSavedCollection() {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== rawSnapshot) {
      rawSnapshot = raw;
      snapshot = parseSavedSelection(raw);
    }
    return snapshot;
  } catch {
    return empty;
  }
}
function notify() {
  readSavedCollection();
  subscribers.forEach((subscriber) => subscriber());
}
function onStorage(event: StorageEvent) {
  if (event.key === key || event.key === null) notify();
}
function subscribe(subscriber: () => void) {
  if (!subscribers.size) {
    window.addEventListener('storage', onStorage);
    window.addEventListener('gent-ascend-collection-updated', notify);
  }
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size) {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('gent-ascend-collection-updated', notify);
    }
  };
}
export function useSavedCollection() {
  return useSyncExternalStore(subscribe, readSavedCollection, () => empty);
}
export function writeSavedCollection(entries: string[]) {
  localStorage.setItem(key, JSON.stringify(parseSavedSelection(JSON.stringify(entries))));
  window.dispatchEvent(new Event('gent-ascend-collection-updated'));
}
export function removeSavedCollection(handle: string) {
  writeSavedCollection(readSavedCollection().filter((value) => value !== handle));
}
