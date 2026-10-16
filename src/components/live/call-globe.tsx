'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAppearance } from '@/components/visual/appearance';
import { brand } from '@/platform/brand';
import { motionPresentationPhase } from '@/platform/visual/motion-presentation';
import { liveCallVisual, type LiveCallSession } from '@/platform/visual/live-call-presentation';
import { mountLiveGlobe, type LiveGlobeHandle } from '@/platform/visual/live-globe-renderer';
import type { LiveAudioSample } from '@/platform/visual/live-audio-tap';

export function LiveCallGlobe({
  state,
  moving,
  size = 'immersive',
  readSample,
}: {
  state: LiveCallSession;
  moving: boolean;
  size?: 'immersive' | 'compact';
  readSample?: () => LiveAudioSample;
}) {
  const { moving: prefersMotion } = useAppearance();
  const allowedMotion = moving && prefersMotion;
  const host = useRef<HTMLSpanElement>(null);
  const handle = useRef<LiveGlobeHandle | null>(null);
  const stateRef = useRef(state);
  const movingRef = useRef(allowedMotion);
  const readRef = useRef(readSample);
  const visual = liveCallVisual(state, readSample?.(), { moving: allowedMotion });
  const phase = motionPresentationPhase(visual.operation);
  useEffect(() => {
    stateRef.current = state;
    movingRef.current = allowedMotion;
    readRef.current = readSample;
  }, [state, allowedMotion, readSample]);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const globe = mountLiveGlobe(
      node,
      liveCallVisual(stateRef.current, readRef.current?.(), { moving: movingRef.current }),
      {
        moving: movingRef.current,
        readEnergy: () => {
          const latest = liveCallVisual(stateRef.current, readRef.current?.(), {
            moving: movingRef.current,
          });
          return { inward: latest.inward, outward: latest.outward };
        },
      },
    );
    handle.current = globe;
    return () => {
      globe.dispose();
      handle.current = null;
    };
  }, [size]);
  useEffect(() => {
    handle.current?.setVisual(visual);
  }, [visual]);
  return (
    <span
      ref={host}
      className={`im-presence live-call-globe live-call-globe-${size}`}
      data-phase={phase}
      data-kind={visual.kind}
      data-reactive={String(visual.reactive)}
      data-energy-source={visual.energySource}
      data-motion={allowedMotion && visual.rotate ? 'ambient' : 'still'}
      data-operation={state.sessionId ?? 'live-idle'}
      aria-hidden="true"
    >
      <span className="live-call-globe-fallback" />
      <Image
        className="live-call-emblem"
        src={brand.conversationEmblem}
        alt=""
        width={size === 'compact' ? 28 : 56}
        height={size === 'compact' ? 28 : 56}
        unoptimized
        draggable={false}
      />
    </span>
  );
}
