'use client';
import { useEffect, useRef, useState } from 'react';
import { useCallMotion } from './use-call-motion';
import { motionPresentationPhase } from '@/platform/visual/motion-presentation';
import {
  liveCallVisual,
  type LiveCallLevels,
  type LiveCallSession,
} from '@/platform/visual/live-call-presentation';
import { liveGlobeAssetSources, type LiveGlobeAssetState } from '@/platform/visual/live-globe-assets';
import { mountLiveGlobe, type LiveGlobeHandle } from '@/platform/visual/live-globe-renderer';

const pendingAssets: LiveGlobeAssetState = { earth: 'loading', emblem: 'loading' };

export function LiveCallGlobe({
  state,
  moving,
  size = 'immersive',
  readSample,
}: {
  state: LiveCallSession;
  moving: boolean;
  size?: 'immersive' | 'compact';
  readSample?: () => LiveCallLevels;
}) {
  const prefersMotion = useCallMotion();
  const allowedMotion = moving && prefersMotion;
  const host = useRef<HTMLSpanElement>(null);
  const handle = useRef<LiveGlobeHandle | null>(null);
  const stateRef = useRef(state);
  const movingRef = useRef(allowedMotion);
  const readRef = useRef(readSample);
  const [assets, setAssets] = useState<LiveGlobeAssetState>(pendingAssets);
  const visual = liveCallVisual(state, readSample?.(), { moving: allowedMotion });
  const phase = motionPresentationPhase(visual.operation);
  useEffect(() => {
    stateRef.current = state;
    movingRef.current = allowedMotion;
    readRef.current = readSample;
    handle.current?.setMotion(allowedMotion);
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
        onAssets: (next) => setAssets(next),
      },
    );
    handle.current = globe;
    setAssets(globe.assets());
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
      data-emblem={assets.emblem}
      data-emblem-id={liveGlobeAssetSources.emblemId}
      data-earth={assets.earth}
      aria-hidden="true"
    >
      <span className="live-call-globe-fallback" data-earth={assets.earth} />
    </span>
  );
}

