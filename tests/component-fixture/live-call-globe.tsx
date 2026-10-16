import { useEffect, useMemo, useState } from 'react';
import { VisualEnvironment } from '@/components/visual/appearance';
import { LiveCallGlobe } from '@/components/live/call-globe';
import type { LiveCallSession } from '@/platform/visual/live-call-presentation';
import type { LiveAudioSample } from '@/platform/visual/live-audio-tap';
import '@/components/live/live.css';

const scenes: {
  id: string;
  title: string;
  state: LiveCallSession;
  sample: LiveAudioSample;
}[] = [
  {
    id: 'connecting',
    title: 'Connecting',
    state: {
      sessionId: 'demo-session',
      phase: 'connecting',
      muted: false,
      playbackBlocked: false,
    },
    sample: { input: 0, output: 0, source: 'unavailable' },
  },
  {
    id: 'listening',
    title: 'Listening',
    state: {
      sessionId: 'demo-session',
      phase: 'listening',
      muted: false,
      playbackBlocked: false,
      speechDetected: true,
    },
    sample: { input: 0.46, output: 0, source: 'webrtc-stats' },
  },
  {
    id: 'speaking',
    title: 'Speaking',
    state: {
      sessionId: 'demo-session',
      phase: 'speaking',
      muted: false,
      playbackBlocked: false,
    },
    sample: { input: 0, output: 0.62, source: 'webrtc-stats' },
  },
  {
    id: 'waiting',
    title: 'Waiting',
    state: {
      sessionId: 'demo-session',
      phase: 'listening',
      muted: false,
      playbackBlocked: false,
      responsePending: true,
    },
    sample: { input: 0, output: 0, source: 'unavailable' },
  },
  {
    id: 'muted',
    title: 'Muted',
    state: {
      sessionId: 'demo-session',
      phase: 'listening',
      muted: true,
      playbackBlocked: false,
    },
    sample: { input: 0, output: 0, source: 'unavailable' },
  },
  {
    id: 'compact',
    title: 'Compact mode',
    state: {
      sessionId: 'demo-session',
      phase: 'listening',
      muted: false,
      playbackBlocked: false,
    },
    sample: { input: 0.3, output: 0, source: 'webrtc-stats' },
  },
  {
    id: 'ended',
    title: 'Ended',
    state: {
      sessionId: 'demo-session',
      phase: 'ended',
      muted: false,
      playbackBlocked: false,
    },
    sample: { input: 0, output: 0, source: 'unavailable' },
  },
  {
    id: 'error',
    title: 'Error',
    state: {
      sessionId: 'demo-session',
      phase: 'error',
      muted: false,
      playbackBlocked: false,
      error: 'The voice provider stopped responding. Resume when ready.',
    },
    sample: { input: 0, output: 0, source: 'unavailable' },
  },
];

export function LiveCallGlobeFixture() {
  const params = new URLSearchParams(location.search);
  const tour = params.get('tour') === '1';
  const initial = tour ? 'connecting' : (params.get('scene') ?? 'listening');
  const [sceneId, setSceneId] = useState(scenes.some((scene) => scene.id === initial) ? initial : 'listening');
  const scene = scenes.find((item) => item.id === sceneId) ?? scenes[1]!;
  useEffect(() => {
    if (!tour) return;
    const order = ['connecting', 'listening', 'speaking', 'waiting', 'muted', 'compact', 'ended'];
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= order.length) {
        window.clearInterval(timer);
        return;
      }
      setSceneId(order[index]!);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [tour]);
  const sample = useMemo(() => scene.sample, [scene]);
  const compact = scene.id === 'compact';
  return (
    <>
      <VisualEnvironment />
      <main className={`live-call-demo${compact ? ' is-compact' : ''}`}>
        <p className="live-call-demo-label" role="note">
          Mocked audio and session states · not a live microphone, playback or OpenAI voice call.
        </p>
        <section
          className={compact ? 'live-compact live-call-compact' : 'live-immersive live-call-stage'}
          aria-label={compact ? 'Persistent Aethelios voice controls' : 'Aethelios Live'}
        >
          <div className={compact ? 'live-compact-presence' : 'live-call'}>
            {!compact && <p className="live-brand">AETHELIOS LIVE</p>}
            <div className={compact ? undefined : 'live-orb'}>
              <LiveCallGlobe
                state={scene.state}
                moving
                size={compact ? 'compact' : 'immersive'}
                readSample={() => sample}
              />
            </div>
            <p className="im-status" role="status">
              {scene.title}
              {sample.source === 'webrtc-stats' ? ' · mocked energy' : ''}
            </p>
            {compact && <p className="live-brand">AETHELIOS LIVE</p>}
          </div>
          <div className="live-controls live-controls-compact">
            <div className="live-control-session">
              <button type="button" aria-pressed={scene.state.muted}>
                {scene.state.muted ? 'Unmute microphone' : 'Mute microphone'}
              </button>
              <button type="button">End session</button>
            </div>
            <div className="live-control-layout">
              <button type="button">{compact ? 'Expand' : 'Compact'}</button>
              <button type="button" aria-pressed>
                Transcript
              </button>
            </div>
          </div>
          {!compact && (
            <div className="live-transcript" role="log" aria-label="Live transcript; mocked demonstration">
              <p>
                <strong>You</strong> Mocked listening sample.
              </p>
              <p>
                <strong>Aethelios</strong> Mocked speaking sample.
              </p>
            </div>
          )}
        </section>
        <nav className="live-call-demo-scenes" aria-label="Mocked live-call scenes">
          {scenes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === scene.id}
              onClick={() => setSceneId(item.id)}
            >
              {item.title}
            </button>
          ))}
        </nav>
      </main>
    </>
  );
}
