import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveCallVisual } from '../src/platform/visual/live-call-presentation';
import {
  liveGlobeAssets,
  liveGlobeSquareCss,
  mountLiveGlobe,
} from '../src/platform/visual/live-globe-renderer';

const MAP_BYTES = 640 * 320 * 4;

function fakeCanvas() {
  const canvas = {
    className: '',
    width: 8,
    height: 8,
    style: { width: '', height: '', aspectRatio: '' },
    setAttribute: vi.fn(),
    getContext() {
      return context;
    },
    remove: vi.fn(),
  };
  const context = {
    canvas,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalCompositeOperation: 'source-over',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    globalAlpha: 1,
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createImageData: (width = canvas.width, height = canvas.height) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(MAP_BYTES) }),
    arc: vi.fn(),
  };
  return { canvas, context };
}

function stubDocument(display: ReturnType<typeof fakeCanvas>) {
  let created = 0;
  vi.stubGlobal('document', {
    createElement: () => {
      created += 1;
      return created === 1 ? display.canvas : fakeCanvas().canvas;
    },
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('live globe renderer', () => {
  it('keeps the drawing buffer square', () => {
    expect(liveGlobeSquareCss(320, 180)).toBe(180);
    expect(liveGlobeSquareCss(90, 220)).toBe(90);
    const display = fakeCanvas();
    stubDocument(display);
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const globe = mountLiveGlobe(
      {
        append: vi.fn(),
        getBoundingClientRect: () => ({ width: 300, height: 180 }),
      } as unknown as HTMLElement,
      liveCallVisual({
        sessionId: 'session-1',
        phase: 'listening',
        muted: false,
        playbackBlocked: false,
      }),
      { moving: false },
    );
    expect(display.canvas.width).toBe(display.canvas.height);
    expect(display.canvas.style.width).toBe(display.canvas.style.height);
    globe.dispose();
  });

  it('paints, pauses, and disposes a single render loop', () => {
    const display = fakeCanvas();
    stubDocument(display);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const raf = vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.stubGlobal('IntersectionObserver', undefined);
    const globe = mountLiveGlobe(
      {
        append: vi.fn(),
        getBoundingClientRect: () => ({ width: 160, height: 160 }),
      } as unknown as HTMLElement,
      liveCallVisual({
        sessionId: 'session-1',
        phase: 'listening',
        muted: false,
        playbackBlocked: false,
      }),
      { moving: true },
    );
    expect(raf).toHaveBeenCalledTimes(1);
    globe.pause();
    const before = display.context.putImageData.mock.calls.length;
    frames[0]?.(50);
    expect(display.context.putImageData.mock.calls.length).toBeGreaterThanOrEqual(before);
    globe.dispose();
    expect(display.canvas.remove).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
  });

  it('applies Still and reduced-motion changes after mount', () => {
    const display = fakeCanvas();
    stubDocument(display);
    const listeners: Array<(event: { matches: boolean }) => void> = [];
    const media = {
      matches: false,
      addEventListener: (_name: string, callback: (event: { matches: boolean }) => void) => {
        listeners.push(callback);
      },
      removeEventListener: vi.fn(),
    };
    const raf = vi.fn(() => 1);
    vi.stubGlobal('matchMedia', () => media);
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('devicePixelRatio', 1);
    const globe = mountLiveGlobe(
      {
        append: vi.fn(),
        getBoundingClientRect: () => ({ width: 200, height: 200 }),
      } as unknown as HTMLElement,
      liveCallVisual({
        sessionId: 'session-1',
        phase: 'speaking',
        muted: false,
        playbackBlocked: false,
      }),
      { moving: true },
    );
    expect(raf).toHaveBeenCalled();
    raf.mockClear();
    globe.setMotion(false);
    expect(raf).not.toHaveBeenCalled();
    globe.setMotion(true);
    expect(raf).toHaveBeenCalled();
    raf.mockClear();
    media.matches = true;
    listeners.forEach((listener) => listener({ matches: true }));
    expect(raf).not.toHaveBeenCalled();
    globe.dispose();
  });

  it('stops the loop while hidden and reports missing assets instead of labeling success', async () => {
    const display = fakeCanvas();
    stubDocument(display);
    const visibility: Array<() => void> = [];
    (globalThis.document as { addEventListener: (name: string, callback: () => void) => void }).addEventListener =
      (name, callback) => {
        if (name === 'visibilitychange') visibility.push(callback);
      };
    const raf = vi.fn(() => 1);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const updates: Array<{ earth: string; emblem: string }> = [];
    const globe = mountLiveGlobe(
      {
        append: vi.fn(),
        getBoundingClientRect: () => ({ width: 160, height: 160 }),
      } as unknown as HTMLElement,
      liveCallVisual({
        sessionId: 'session-1',
        phase: 'listening',
        muted: false,
        playbackBlocked: false,
      }),
      {
        moving: true,
        earthSrc: '/missing-earth.jpg',
        emblemSrc: '/missing-emblem.png',
        onAssets: (state) => updates.push(state),
      },
    );
    expect(globe.assets().earth).toBe('fallback');
    (globalThis.document as { hidden: boolean }).hidden = true;
    visibility.forEach((listener) => listener());
    expect(cancel).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(globe.assets()).toMatchObject({ earth: 'fallback', emblem: 'missing' });
    expect(updates.some((state) => state.emblem === 'missing')).toBe(true);
    globe.dispose();
  });

  it('hosts NASA Blue Marble and the official 2026-10-15 mark without a transparent redraw', () => {
    expect(liveGlobeAssets.earth).toBe('/visual/nasa-blue-marble-land-shallow-topo-2048.jpg');
    expect(liveGlobeAssets.emblem).toBe('/brand/aethelios-official-20261015-512.png');
    expect(liveGlobeAssets.missingTransparentEmblem).toMatch(/No transparent or vector official gold-A/);
  });
});
