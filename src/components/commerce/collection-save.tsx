'use client';
import Link from 'next/link';
import { useState } from 'react';
import { commerceEvent } from './commerce-events';
import {
  readSavedCollection,
  useSavedCollection,
  writeSavedCollection,
} from './saved-selection-store';
export function CollectionSave({
  handle,
  title,
  compact = false,
  basePath = '/shop',
}: {
  handle: string;
  title?: string;
  compact?: boolean;
  basePath?: string;
}) {
  const saved = useSavedCollection().includes(handle);
  const [message, setMessage] = useState('');
  function toggle() {
    try {
      const entries = readSavedCollection();
      const present = entries.includes(handle);
      writeSavedCollection(
        present
          ? entries.filter((v) => v !== handle)
          : [...entries.filter((v) => v !== handle).slice(-99), handle],
      );
      setMessage(
        present
          ? 'Removed from your saved selection.'
          : 'Saved on this browser. This does not reserve stock or place an order.',
      );
      if (!present) commerceEvent('product_saved', handle);
    } catch {
      setMessage('Saving is unavailable in this browser. You can bookmark this page.');
    }
  }
  return (
    <div className={`reserve-save${compact ? ' reserve-save--compact' : ''}`}>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={
          compact
            ? `${saved ? 'Remove' : 'Save'} ${title ?? handle}${saved ? ' from' : ' to'} my collection`
            : undefined
        }
        onClick={toggle}
      >
        {saved ? '◆ In your collection' : '◇ Save to my collection'}
      </button>
      <p role="status">{message || 'Your saved selection stays on this browser.'}</p>
      {saved && !compact && <Link href={`${basePath}?saved=1`}>View your saved selection ↗</Link>}
    </div>
  );
}
