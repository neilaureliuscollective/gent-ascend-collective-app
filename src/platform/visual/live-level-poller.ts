import type { LiveCallLevels } from './live-call-presentation';

export type LiveLevelReader = () => Promise<{ input: number; output: number }>;

/**
 * Poll existing LiveController.audioLevels() for presentation only.
 * Never creates an AudioContext, analyser, microphone or playback route.
 */
export function createLiveLevelPoller(options: {
  read: LiveLevelReader;
  apply: (levels: LiveCallLevels) => void;
  shouldPoll: () => boolean;
  interval?: number;
}) {
  const interval = options.interval ?? 160;
  let disposed = false;
  let inflight = false;
  let timer = 0;
  let generation = 0;

  const applySafe = (levels: LiveCallLevels, gen: number) => {
    if (disposed || gen !== generation) return;
    options.apply(levels);
  };

  const sample = async (force = false) => {
    if (disposed || inflight) return;
    if (!force && !options.shouldPoll()) return;
    inflight = true;
    const gen = generation;
    try {
      const next = await options.read();
      applySafe(
        {
          input: next.input,
          output: next.output,
          source: 'webrtc-stats',
        },
        gen,
      );
    } catch {
      applySafe({ input: 0, output: 0, source: 'unavailable' }, gen);
    } finally {
      inflight = false;
    }
  };

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  };

  const sync = () => {
    if (disposed) return;
    stopTimer();
    if (!options.shouldPoll()) {
      void sample(true);
      return;
    }
    void sample();
    timer = setInterval(() => {
      void sample();
    }, interval) as unknown as number;
  };

  return {
    sync,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      generation += 1;
      stopTimer();
    },
  };
}
