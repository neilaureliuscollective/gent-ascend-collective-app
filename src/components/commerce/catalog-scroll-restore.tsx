'use client';
import { useLayoutEffect } from 'react';
import { matchingCatalogScroll } from '@/domains/commerce/catalog-return';

export function CatalogScrollRestore() {
  useLayoutEffect(() => {
    const href = `${window.location.pathname}${window.location.search}`;
    const scroll = matchingCatalogScroll(href);
    if (scroll == null) return;
    window.scrollTo(0, scroll);
  }, []);
  return null;
}
