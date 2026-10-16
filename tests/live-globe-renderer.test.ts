import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveCallVisual } from '../src/platform/visual/live-call-presentation';
import { liveGlobeAssets, mountLiveGlobe } from '../src/platform/visual/live-globe-renderer';

const MAP_BYTES = 640 * 320 * 4;

function fakeCanvas() {
  const canvas = {
    className: '',
    width: 8,
    height: 8,
    style: { width: '', height: '' },
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

afterEach(() => vi.unstubAllGlobals());

describe('live globe renderer', () => {
  it('paints, pauses, and disposes without touching session media', () => {
    const display = fakeCanvas();
    const { canvas, context } = display;
    const host = {
      append: vi.fn(),
      getBoundingClientRect: () => ({ width: 160, height: 160 }),
    };
    const frames: FrameRequestCallback[] = [];
    let created = 0;
    vi.stubGlobal('document', {
      createElement: () => {
        created += 1;
        return created === 1 ? canvas : fakeCanvas().canvas;
      },
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('IntersectionObserver', undefined);
    const visual = liveCallVisual({
      sessionId: 'session-1',
      phase: 'listening',
      muted: false,
      playbackBlocked: false,
    });
    const globe = mountLiveGlobe(host as unknown as HTMLElement, visual, { moving: true });
    expect(host.append).toHaveBeenCalledTimes(1);
    expect(canvas.remove).not.toHaveBeenCalled();
    globe.pause();
    const before = context.putImageData.mock.calls.length;
    frames[0]?.(50);
    expect(context.putImageData.mock.calls.length).toBe(before);
    globe.resume();
    globe.dispose();
    expect(canvas.remove).toHaveBeenCalledTimes(1);
  });

  it('keeps a still fallback when motion is reduced', () => {
    const display = fakeCanvas();
    const { canvas, context } = display;
    let created = 0;
    vi.stubGlobal('document', {
      createElement: () => {
        created += 1;
        return created === 1 ? canvas : fakeCanvas().canvas;
      },
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('requestAnimationFrame', vi.fn());
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
      { moving: false },
    );
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    globe.paintStatic();
    expect(context.putImageData).toHaveBeenCalled();
    globe.dispose();
  });

  it('hosts NASA Blue Marble and the official 2026-10-15 mark without a transparent redraw', () => {
    expect(liveGlobeAssets.earth).toBe('/visual/nasa-blue-marble-land-shallow-topo-2048.jpg');
    expect(liveGlobeAssets.emblem).toBe('/brand/aethelios-official-20261015-512.png');
    expect(liveGlobeAssets.missingTransparentEmblem).toMatch(/No transparent or vector official gold-A/);
  });
});
