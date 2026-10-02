'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, ViewTransition, type ReactNode } from 'react';
import { AppearanceControls, useAppearance } from '@/components/visual/appearance';
import { AppRuntime } from '@/components/app-runtime';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { EnergyOrb } from './energy-orb';

/** A single audio context for the environment, never voice or microphone. */
function AmbientSound({ quiet }: { quiet: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  useEffect(() => {
    const pause = () => {
      if (document.hidden || document.querySelector('dialog[open]')) {
        void audio.current?.suspend();
        setPlaying(false);
      }
    };
    const dialogs = new MutationObserver(pause);
    dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', pause);
    return () => {
      dialogs.disconnect();
      document.removeEventListener('visibilitychange', pause);
      void audio.current?.close();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    if (quiet) void audio.current?.suspend();
  }, [quiet]);
  async function toggle() {
    try {
      if (playing) {
        await audio.current?.suspend();
        setPlaying(false);
      } else {
        if (!audio.current) {
          const context = new AudioContext();
          audio.current = context;
          context.onstatechange = () => setPlaying(context.state === 'running');
          gain.current = context.createGain();
          gain.current.gain.value = 0;
          gain.current.connect(context.destination);
          for (const frequency of [110, 164.81, 220]) {
            const tone = context.createOscillator();
            tone.frequency.value = frequency;
            tone.connect(gain.current);
            tone.start();
          }
        }
        await audio.current.resume();
        gain.current?.gain.setTargetAtTime(0.009, audio.current.currentTime, 0.8);
        setPlaying(true);
      }
      // Playback always requires a fresh gesture, even if the preference was sound-on.
      try {
        localStorage.setItem('gent-world-muted', String(playing));
      } catch {
        /* optional preference */
      }
      setNotice('');
    } catch {
      setNotice('Sound is unavailable on this device.');
      setPlaying(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={playing && !quiet}
        aria-label={playing ? 'Mute ambient sound' : 'Enable ambient sound'}
      >
        {playing && !quiet ? 'Sound on' : 'Sound off'}
      </button>
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  );
}

export function WorldShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { moving } = useAppearance();
  const [intelligence, setIntelligence] = useState(false);
  const threshold = path === '/experience';
  const conversation = path === '/experience/aethelios';
  const practice = path.endsWith('/practice');
  const main = useRef<HTMLElement>(null);
  const previous = useRef(path);
  useEffect(() => {
    if (previous.current !== path) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      main.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
      previous.current = path;
    }
  }, [path]);
  return (
    <div
      className="gent-world"
      data-moving={moving}
      data-practice={practice}
      data-conversation={conversation}
    >
      <AppRuntime />
      <a className="skip" href="#experience-main">
        Skip to content
      </a>
      <header className="gw-header">
        <Link href="/experience" className="gw-wordmark">
          GENT ASCEND <small>COLLECTIVE</small>
        </Link>
        <div className="gw-preferences">
          <AppearanceControls />
          <AmbientSound quiet={intelligence || conversation} />
        </div>
      </header>
      <main id="experience-main" ref={main}>
        {practice || conversation ? (
          children
        ) : (
          <ViewTransition
            key={path}
            name="gent-world-scene"
            default="none"
            enter="gw-reveal"
            exit="gw-leave"
            share="gw-reveal"
          >
            {children}
          </ViewTransition>
        )}
      </main>
      {!threshold && (
        <nav className="gw-dock" aria-label="World navigation">
          <Link
            href="/experience/world"
            aria-current={path === '/experience/world' ? 'page' : undefined}
          >
            World
          </Link>
          <button onClick={() => setIntelligence(true)} aria-haspopup="dialog">
            Aethelios <span aria-hidden="true">✦</span>
          </button>
          <Link href="/app/you">You</Link>
        </nav>
      )}
      <ContextSheet open={intelligence} title="Aethelios" onClose={() => setIntelligence(false)}>
        <div className="gw-intelligence">
          <EnergyOrb moving={false} />
          <p className="gw-kicker">A clearer next move</p>
          <p>
            {path.includes('grooming')
              ? 'Refine your grooming direction and the rituals that support it.'
              : path.includes('performance')
                ? 'Think through how your training fits the rest of your life.'
                : 'Bring the parts of your life into one conversation.'}
          </p>
          <p className="gw-muted">
            Your private conversations and saved context stay in your account. Opening a
            conversation does not automatically share your records.
          </p>
          <Link
            className="gw-action"
            href="/experience/aethelios"
            onClick={() => setIntelligence(false)}
          >
            Open your conversation ↗
          </Link>
          <Link href="/experience/world#direction" onClick={() => setIntelligence(false)}>
            Start with a simple direction
          </Link>
        </div>
      </ContextSheet>
    </div>
  );
}
