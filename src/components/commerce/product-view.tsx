'use client';
import { useEffect } from 'react';
import { commerceEvent } from './commerce-events';
export function ProductView({ handle }: { handle: string }) {
  useEffect(() => {
    commerceEvent('product_view', handle);
  }, [handle]);
  return null;
}
