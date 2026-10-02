'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { commerceEvent } from './commerce-events';
const key = 'gent-ascend-collection-v1';
export function readSavedCollection(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value)
      ? value
          .filter((v): v is string => typeof v === 'string' && /^[a-z0-9-]{1,120}$/.test(v))
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export function CollectionSave({ handle }: { handle: string }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const sync = () => setSaved(readSavedCollection().includes(handle));
    queueMicrotask(sync);
    window.addEventListener('storage', sync);
    window.addEventListener('gent-ascend-collection-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('gent-ascend-collection-updated', sync);
    };
  }, [handle]);
  function toggle() {
    try {
      const entries = readSavedCollection();
      const present = entries.includes(handle);
      localStorage.setItem(
        key,
        JSON.stringify(
          present
            ? entries.filter((v) => v !== handle)
            : [...entries.filter((v) => v !== handle).slice(-99), handle],
        ),
      );
      setSaved(!present);
      setMessage(
        present
          ? 'Removed from your saved selection.'
          : 'Saved on this browser. This does not reserve stock or place an order.',
      );
      window.dispatchEvent(new Event('gent-ascend-collection-updated'));
      if (!present) commerceEvent('product_saved', handle);
    } catch {
      setMessage('Saving is unavailable in this browser. You can bookmark this page.');
    }
  }
  return (
    <div className="reserve-save">
      <button type="button" aria-pressed={saved} onClick={toggle}>
        {saved ? '◆ In your collection' : '◇ Save to my collection'}
      </button>
      <p role="status">{message || 'Your saved selection stays on this browser.'}</p>
      {saved && <Link href="/shop?saved=1">View your saved selection ↗</Link>}
    </div>
  );
}
