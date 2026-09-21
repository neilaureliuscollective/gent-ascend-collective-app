'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { Icon } from './icon';
const eventName = 'aurelius-appearance';
let sessionMotion: string | null = null;
let sessionMaterial: string | null = null;
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function snapshot() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const solid =
    window.matchMedia('(prefers-reduced-transparency: reduce)').matches ||
    window.matchMedia('(prefers-contrast: more)').matches;
  const motion = sessionMotion ?? read('aurelius-motion');
  const material = sessionMaterial ?? read('aurelius-material');
  return `${reduce || motion === 'still' ? 'still' : 'ambient'}:${solid || material === 'solid' ? 'solid' : 'glass'}`;
}
function subscribe(callback: () => void) {
  const queries = [
    '(prefers-reduced-motion: reduce)',
    '(prefers-reduced-transparency: reduce)',
    '(prefers-contrast: more)',
  ].map((q) => matchMedia(q));
  queries.forEach((q) => q.addEventListener('change', callback));
  window.addEventListener(eventName, callback);
  const onStorage = () => {
    sessionMotion = null;
    sessionMaterial = null;
    callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    queries.forEach((q) => q.removeEventListener('change', callback));
    window.removeEventListener(eventName, callback);
    window.removeEventListener('storage', onStorage);
  };
}
export function useAppearance() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'still:glass');
  return { moving: value.startsWith('ambient'), solid: value.endsWith('solid') };
}
function update(kind: 'motion' | 'material', value: string) {
  if (kind === 'motion') sessionMotion = value;
  else sessionMaterial = value;
  try {
    localStorage.setItem(`aurelius-${kind}`, value);
  } catch {
    /* Appearance remains usable without storage. */
  }
  window.dispatchEvent(new Event(eventName));
}
export function AppearanceControls() {
  const { moving, solid } = useAppearance();
  return (
    <div className="appearance-controls" aria-label="Display preferences">
      <button
        onClick={() => update('motion', moving ? 'still' : 'ambient')}
        aria-label={moving ? 'Pause ambient motion' : 'Enable ambient motion'}
        aria-pressed={moving}
        title={moving ? 'Pause ambient motion' : 'Enable ambient motion (respects reduced motion)'}
      >
        <Icon name={moving ? 'sun' : 'moon'} />
        <span>{moving ? 'Ambient' : 'Still'}</span>
      </button>
      <button
        onClick={() => update('material', solid ? 'glass' : 'solid')}
        aria-label="Use solid surfaces"
        aria-pressed={solid}
        title="Use solid surfaces"
      >
        <Icon name="shield" />
      </button>
    </div>
  );
}
export function VisualEnvironment() {
  const { moving, solid } = useAppearance();
  useEffect(() => {
    document.documentElement.dataset.motion = moving ? 'ambient' : 'still';
    document.documentElement.dataset.material = solid ? 'solid' : 'glass';
  }, [moving, solid]);
  useEffect(() => {
    const sync = () => {
      document.documentElement.dataset.quiet = String(
        document.hidden ||
          !!document.activeElement?.matches('input, textarea, [contenteditable="true"]') ||
          !!document.querySelector('dialog[open]'),
      );
    };
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return (
    <div className="ambient-environment" aria-hidden="true">
      <div className="ambient-light" />
      <div className="ambient-horizon" />
      <div className="ambient-grain" />
    </div>
  );
}
