import type { LiveEnergySource } from './live-call-presentation';

export type LiveMediaStreams = {
  microphone: MediaStream | null;
  playback: MediaStream | null;
};

export type LiveAudioSample = {
  input: number;
  output: number;
  source: LiveEnergySource;
};

type AnalyserBundle = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  stream: MediaStream;
  buffer: Uint8Array;
};

function rms(analyser: AnalyserNode, buffer: Uint8Array) {
  analyser.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);
  let total = 0;
  for (const sample of buffer) {
    const value = (sample - 128) / 128;
    total += value * value;
  }
  return Math.min(1, Math.sqrt(total / buffer.length) * 3.2);
}

function attachAnalyser(context: AudioContext, stream: MediaStream): AnalyserBundle | null {
  if (!stream.getAudioTracks().some((track) => track.readyState === 'live')) return null;
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  source.connect(analyser);
  return { source, analyser, stream, buffer: new Uint8Array(analyser.fftSize) };
}

function release(bundle: AnalyserBundle | null) {
  if (!bundle) return;
  try {
    bundle.source.disconnect();
  } catch {
    /* Node may already be disconnected. */
  }
  try {
    bundle.analyser.disconnect();
  } catch {
    /* Node may already be disconnected. */
  }
}

/**
 * Read energy from the existing Live microphone and playback streams.
 * Never calls getUserMedia, never connects to the destination, and never stops tracks.
 */
export function createLiveAudioMonitor(options: {
  streams: () => LiveMediaStreams;
  stats?: () => Promise<{ input: number; output: number }>;
}): { read: () => LiveAudioSample; dispose: () => void } {
  const sample: LiveAudioSample = { input: 0, output: 0, source: 'unavailable' };
  let context: AudioContext | null = null;
  let input: AnalyserBundle | null = null;
  let output: AnalyserBundle | null = null;
  let disposed = false;
  let frame = 0;
  let statsAt = 0;
  let statsPending = false;

  const AudioCtor =
    typeof AudioContext === 'function'
      ? AudioContext
      : typeof (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext === 'function'
        ? (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null;

  const sync = () => {
    if (disposed) return;
    const streams = options.streams();
    if (AudioCtor && !context) {
      try {
        context = new AudioCtor();
      } catch {
        context = null;
      }
    }
    if (context && streams.microphone !== input?.stream) {
      release(input);
      try {
        input = streams.microphone ? attachAnalyser(context, streams.microphone) : null;
      } catch {
        input = null;
      }
    }
    if (context && streams.playback !== output?.stream) {
      release(output);
      try {
        output = streams.playback ? attachAnalyser(context, streams.playback) : null;
      } catch {
        output = null;
      }
    }
    if (input || output) {
      sample.input = input ? rms(input.analyser, input.buffer) : 0;
      sample.output = output ? rms(output.analyser, output.buffer) : 0;
      sample.source = 'web-audio-tap';
      return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!options.stats || statsPending || now - statsAt < 120) return;
    statsPending = true;
    statsAt = now;
    void options
      .stats()
      .then((levels) => {
        if (disposed || input || output) return;
        sample.input = Math.max(0, Math.min(1, levels.input));
        sample.output = Math.max(0, Math.min(1, levels.output));
        sample.source = 'webrtc-stats';
      })
      .catch(() => {
        if (!disposed && !input && !output) sample.source = 'unavailable';
      })
      .finally(() => {
        statsPending = false;
      });
  };

  const raf =
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(globalThis) : null;
  const cancel =
    typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame.bind(globalThis) : null;
  const tick = () => {
    if (disposed) return;
    sync();
    if (raf) frame = raf(tick);
  };
  sync();
  if (raf) frame = raf(tick);

  return {
    read: () => ({ ...sample }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (frame && cancel) cancel(frame);
      release(input);
      release(output);
      input = null;
      output = null;
      if (context) {
        const closing = context.close();
        void closing?.catch?.(() => {});
      }
      context = null;
      sample.input = 0;
      sample.output = 0;
      sample.source = 'unavailable';
    },
  };
}
