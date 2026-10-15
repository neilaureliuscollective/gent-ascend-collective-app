'use client';
import { useSyncExternalStore } from 'react';
import { LifestyleAction } from './lifestyle-action';
import { readCatalogReturn } from '@/domains/commerce/catalog-return';

function subscribe() {
  return () => undefined;
}

export function CollectionReturnLink({
  fallback,
  children,
  className = 'world-text-link',
}: {
  fallback: string;
  children: React.ReactNode;
  className?: string;
}) {
  const href = useSyncExternalStore(
    subscribe,
    () => readCatalogReturn(fallback),
    () => fallback,
  );
  return (
    <LifestyleAction href={href} className={className} icon="back">
      {children}
    </LifestyleAction>
  );
}
