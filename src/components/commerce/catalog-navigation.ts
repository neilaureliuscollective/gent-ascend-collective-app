'use client';
import { useSyncExternalStore } from 'react';
import {
  catalogViewSearch,
  readCatalogView,
  type CatalogView,
} from '@/domains/commerce/catalog-view';
const eventName = 'aethelios-catalog-navigation';
function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(eventName, callback);
  };
}
export function useCatalogNavigation(
  chapters: readonly string[],
  brands: readonly string[],
  priceSortSupported: boolean,
  savedOnly: boolean,
) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
  const view = readCatalogView(search, chapters, brands, priceSortSupported, savedOnly);
  function update(patch: Partial<CatalogView>, replace = false) {
    const next = {
      ...readCatalogView(window.location.search, chapters, brands, priceSortSupported, savedOnly),
      ...patch,
    };
    const query = catalogViewSearch(window.location.search, next, savedOnly);
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`)
      return;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    window.dispatchEvent(new Event(eventName));
  }
  return { view, update };
}
