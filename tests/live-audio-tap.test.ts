import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLiveAudioMonitor } from '../src/platform/visual/live-audio-tap';

class FakeAnalyser {
  fftSize = 256;
  smoothingTimeConstant = 0;
  disconnect = vi.fn();
  getByteTimeDomainData(buffer: Uint8Array) {
    buffer.fill(160);
  }
}

class FakeSource {
  disconnect = vi.fn();
  connect = vi.fn();
}

class FakeContext {
  closed = false;
  createMediaStreamSource = vi.fn(() => new FakeSource());
  createAnalyser = vi.fn(() => new FakeAnalyser());
  close = vi.fn(async () => {
    this.closed = true;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('live audio monitor', () => {
  it('taps existing streams and never stops tracks or requests a microphone', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn();
    const context = new FakeContext();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          return context;
        }
      },
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    const microphone = {
      getAudioTracks: () => [{ readyState: 'live', stop }],
    } as unknown as MediaStream;
    const playback = {
      getAudioTracks: () => [{ readyState: 'live', stop }],
    } as unknown as MediaStream;
    const monitor = createLiveAudioMonitor({
      streams: () => ({ microphone, playback }),
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const sample = monitor.read();
    expect(sample.source).toBe('web-audio-tap');
    expect(sample.input).toBeGreaterThan(0);
    expect(getUserMedia).not.toHaveBeenCalled();
    monitor.dispose();
    expect(stop).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.createMediaStreamSource).toHaveBeenCalledTimes(2);
  });

  it('falls back to WebRTC stats when Web Audio cannot attach', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    const stats = vi.fn(async () => ({ input: 0.2, output: 0.6 }));
    const monitor = createLiveAudioMonitor({
      streams: () => ({ microphone: null, playback: null }),
      stats,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(stats).toHaveBeenCalled();
    expect(monitor.read()).toMatchObject({
      input: 0.2,
      output: 0.6,
      source: 'webrtc-stats',
    });
    monitor.dispose();
  });
});
