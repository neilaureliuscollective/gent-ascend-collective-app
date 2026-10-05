'use client';
import { useState, useSyncExternalStore } from 'react';
const subscribe = () => () => {};
const embedded = () => /FBAN|FBAV|Instagram/i.test(navigator.userAgent);
export function BrowserEntryNotice() {
  const inSocialBrowser = useSyncExternalStore(subscribe, embedded, () => false);
  const [notice, setNotice] = useState('');
  if (!inSocialBrowser) return null;
  async function copy() {
    try {
      // Share only the public entrance; never copy a token, private path or direction draft.
      await navigator.clipboard.writeText(`${location.origin}/enter`);
      setNotice('Entrance link copied. Open it in Safari, Chrome or Samsung Internet.');
    } catch {
      setNotice(`Open ${location.origin}/enter in Safari, Chrome or Samsung Internet.`);
    }
  }
  return (
    <aside className="browser-entry-notice" aria-label="Open in your browser">
      <p>
        Opening from Facebook or Instagram? For Google sign-in and installation, use the menu to
        open this site in Safari, Chrome or Samsung Internet. Device drafts stay in the browser
        where you created them.
      </p>
      <button type="button" className="secondary-button" onClick={() => void copy()}>
        Copy entrance link
      </button>
      {notice && <p role="status">{notice}</p>}
    </aside>
  );
}
