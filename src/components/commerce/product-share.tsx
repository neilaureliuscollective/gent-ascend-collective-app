'use client';
import { useRef, useState } from 'react';
import { productPath } from '@/domains/commerce/product-path';

export function ProductShare({ handle, title }: { handle: string; title: string }) {
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const path = productPath(handle);
  async function share(copyOnly = false) {
    if (!path || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    setManual('');
    const url = `${window.location.origin}${path}`;
    try {
      if (!copyOnly && navigator.share) {
        await navigator.share({ title, url });
        setMessage('Share completed.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMessage('Product link copied.');
      } else {
        setManual(url);
        setMessage('Select the product link below to copy it.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setManual(url);
        setMessage('Sharing is unavailable here. You can copy the product link below.');
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!path) return null;
  return (
    <div className="reserve-product-share">
      <button type="button" disabled={busy} onClick={() => void share()}>
        Share this product ↗
      </button>
      <button type="button" disabled={busy} onClick={() => void share(true)}>
        Copy product link
      </button>
      <p role="status">{message}</p>
      {manual && (
        <label>
          Product link
          <input
            type="url"
            readOnly
            value={manual}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}
