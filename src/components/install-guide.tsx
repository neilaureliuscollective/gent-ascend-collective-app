'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const subscribePlatform = () => () => {};
const platformSnapshot = (): 'ios' | 'android' | 'other' => {
  const agent = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(agent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    ? 'ios'
    : /Android/.test(agent)
      ? 'android'
      : 'other';
};
export function InstallGuide() {
  const [installed, setInstalled] = useState(false);
  const platform = useSyncExternalStore(subscribePlatform, platformSnapshot, () => 'other');
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const update = () =>
      setInstalled(
        display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      );
    update();
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const complete = () => {
      setPrompt(null);
      setNotice(
        'Installation accepted. Open Gent Ascend from your Home Screen to check your app experience.',
      );
    };
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', complete);
    display.addEventListener('change', update);
    return () => {
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', complete);
      display.removeEventListener('change', update);
    };
  }, []);
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setNotice(
        choice.outcome === 'accepted'
          ? 'Installation accepted. Open the new icon on your Home Screen.'
          : 'You can install later from this guide or your browser menu.',
      );
    } catch {
      setNotice('Use your browser menu to install Gent Ascend. The steps are below.');
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }
  return (
    <section className="panel install-guide" aria-labelledby="install-title">
      <p className="eyebrow">Your phone / Your own space</p>
      <h2 id="install-title">{installed ? 'You’re in the app.' : 'Keep Gent Ascend close.'}</h2>
      <p>
        {installed
          ? 'Gent Ascend is open in its standalone app experience.'
          : 'Add Gent Ascend to your Home Screen, then open its icon to enter your personal OS.'}
      </p>
      {!installed && prompt && (
        <button className="button" disabled={busy} onClick={() => void install()}>
          {busy ? 'Opening installation…' : 'Install Gent Ascend'}
        </button>
      )}
      {!installed && (
        <div className="install-instructions">
          <details open={platform === 'ios'}>
            <summary>iPhone / iPad</summary>
            <ol>
              <li>Open this site in Safari, then open the browser’s Share menu.</li>
              <li>
                Choose <strong>Add to Home Screen</strong>. On supported versions, keep{' '}
                <strong>Open as Web App</strong> enabled.
              </li>
              <li>
                Tap <strong>Add</strong>, return to your Home Screen, and open Gent Ascend.
              </li>
            </ol>
            <p>
              If the browser asks you to sign in again, use your Gent Ascend email and password.
            </p>
          </details>
          <details open={platform === 'android'}>
            <summary>Android / Samsung Fold</summary>
            <ol>
              <li>Open Gent Ascend in Chrome or Samsung Internet.</li>
              <li>
                Use <strong>Install app</strong> or <strong>Add to Home screen</strong> in the
                browser menu. Wording varies by browser.
              </li>
              <li>Confirm, return to your Home Screen, and open the Gent Ascend icon.</li>
            </ol>
            <p>
              The layout adapts as you fold or unfold your phone. You can also install from Chrome
              if your browser only offers a shortcut.
            </p>
          </details>
          {platform === 'other' && (
            <details>
              <summary>Computer</summary>
              <p>
                Use your browser’s install icon or app menu when offered. In Safari on Mac, use File
                → Add to Dock. You can always use Gent Ascend in a browser.
              </p>
            </details>
          )}
        </div>
      )}
      <p className="install-notice" role="status">
        {notice}
      </p>
      <p className="muted">
        Aethelios and personal records need an internet connection. Offline, the app shows a
        reconnect screen and does not report unsaved work as saved.
      </p>
      <Link href="/app" className="text-link">
        Open Command →
      </Link>
    </section>
  );
}
