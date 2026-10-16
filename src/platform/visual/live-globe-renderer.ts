import { liveContinents } from './live-continents';
import type { LiveCallVisual } from './live-call-presentation';
import { liveGlobeMapUv, liveGlobeSphereCoords } from './live-globe-projection';
import {
  liveGlobeAssetSources,
  type LiveGlobeAssetState,
} from './live-globe-assets';
import { brand } from '@/platform/brand';

export type LiveGlobeHandle = {
  setVisual: (visual: LiveCallVisual) => void;
  setEnergy: (inward: number, outward: number, reactive: boolean) => void;
  setMotion: (moving: boolean) => void;
  assets: () => LiveGlobeAssetState;
  metrics: () => {
    bufferWidth: number;
    bufferHeight: number;
    cssWidth: string;
    cssHeight: string;
    looping: boolean;
    rotation: number;
  };
  pause: () => void;
  resume: () => void;
  dispose: () => void;
  paintStatic: () => void;
};

const MAX_PIXELS = 480;
const FALLBACK_WIDTH = 640;
const FALLBACK_HEIGHT = 320;

export function liveGlobeSquareCss(width: number, height: number) {
  return Math.max(48, Math.min(width || 240, height || 240));
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function paintFallbackMap(target: CanvasRenderingContext2D) {
  const { width, height } = target.canvas;
  target.fillStyle = '#070b0a';
  target.fillRect(0, 0, width, height);
  const project = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];
  target.fillStyle = '#3f6a55';
  for (const ring of liveContinents) {
    target.beginPath();
    ring.forEach((point, index) => {
      const [x, y] = project(point[0] ?? 0, point[1] ?? 0);
      if (index === 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    });
    target.closePath();
    target.fill();
  }
}

function readImageData(image: CanvasImageSource, width: number, height: number) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function punchDarkPlate(image: CanvasImageSource) {
  const data = readImageData(image, 512, 512);
  if (!data || typeof document === 'undefined') return null;
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const red = pixels[i] ?? 0;
    const green = pixels[i + 1] ?? 0;
    const blue = pixels[i + 2] ?? 0;
    const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    pixels[i + 3] = luma < 22 ? 0 : luma < 48 ? Math.round(((luma - 22) / 26) * 255) : 255;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  canvas.getContext('2d')?.putImageData(data, 0, 0);
  return canvas;
}

function sourceHasAlpha(image: CanvasImageSource) {
  const width = 'naturalWidth' in image ? Number(image.naturalWidth) || 48 : 48;
  const probe = Math.min(48, Math.max(8, width));
  const data = readImageData(image, probe, probe);
  if (!data) return false;
  let translucent = 0;
  const pixels = data.data.length / 4;
  for (let i = 3; i < data.data.length; i += 4) {
    if ((data.data[i] ?? 255) < 250) translucent += 1;
  }
  return translucent > pixels * 0.15;
}

function shadeEmblem(target: CanvasRenderingContext2D, size: number, source: CanvasImageSource) {
  const light = target.createRadialGradient(
    size * 0.32,
    size * 0.28,
    size * 0.05,
    size * 0.5,
    size * 0.54,
    size * 0.78,
  );
  light.addColorStop(0, 'rgb(255,253,246)');
  light.addColorStop(0.42, 'rgb(236,230,214)');
  light.addColorStop(1, 'rgb(132,142,134)');
  target.globalCompositeOperation = 'multiply';
  target.fillStyle = light;
  target.fillRect(0, 0, size, size);
  target.globalCompositeOperation = 'destination-in';
  target.drawImage(source, 0, 0, size, size);
  target.globalCompositeOperation = 'source-over';
}

function prepareEmblem(image: HTMLImageElement) {
  if (typeof document === 'undefined') return null;
  if (!sourceHasAlpha(image)) return punchDarkPlate(image);
  const size = Math.max(256, Math.min(1024, image.naturalWidth || 1024));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  shadeEmblem(context, size, image);
  return canvas;
}

function sample(data: ImageData, lon: number, lat: number) {
  const { u, v } = liveGlobeMapUv(lon, lat);
  const width = data.width;
  const height = data.height;
  const fx = (((u % 1) + 1) % 1) * width;
  const fy = Math.min(height - 1, Math.max(0, v * (height - 1)));
  const x0 = Math.floor(fx) % width;
  const x1 = (x0 + 1) % width;
  const y0 = Math.floor(fy);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - Math.floor(fx);
  const ty = fy - y0;
  const at = (cx: number, cy: number) => {
    const index = (cy * width + cx) * 4;
    return [data.data[index] ?? 10, data.data[index + 1] ?? 14, data.data[index + 2] ?? 12] as const;
  };
  const a = at(x0, y0);
  const b = at(x1, y0);
  const c = at(x0, y1);
  const d = at(x1, y1);
  const mix = (left: number, right: number, t: number) => left + (right - left) * t;
  return [
    mix(mix(a[0], b[0], tx), mix(c[0], d[0], tx), ty),
    mix(mix(a[1], b[1], tx), mix(c[1], d[1], tx), ty),
    mix(mix(a[2], b[2], tx), mix(c[2], d[2], tx), ty),
  ] as const;
}

function gradeEarth(red: number, green: number, blue: number) {
  const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const ocean = blue > green + 6 && blue > red + 10 && luma < 104;
  if (ocean) {
    const depth = luma / 104;
    return [4 + depth * 6, 7 + depth * 11, 8 + depth * 9] as const;
  }
  const ice = luma > 196 && Math.abs(red - green) < 24;
  if (ice) return [90, 102, 100] as const;
  const relief = luma / 255;
  return [42 + relief * 76, 80 + relief * 112, 56 + relief * 52] as const;
}

function prepareEarth(image: CanvasImageSource, width: number, height: number) {
  const data = readImageData(image, width, height);
  if (!data) return null;
  const pixels = data.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const [red, green, blue] = gradeEarth(
      pixels[index] ?? 0,
      pixels[index + 1] ?? 0,
      pixels[index + 2] ?? 0,
    );
    pixels[index] = red;
    pixels[index + 1] = green;
    pixels[index + 2] = blue;
  }
  return data;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image unavailable'));
      return;
    }
    const image = new Image();
    image.onload = () => {
      const decoded = image.decode?.();
      if (decoded && typeof decoded.then === 'function') {
        void decoded.then(() => resolve(image)).catch(() => resolve(image));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Missing ${src}`));
    image.src = src;
  });
}

function pixelBudget(size: number) {
  const ratio = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  return Math.max(160, Math.min(MAX_PIXELS, Math.round(size * Math.min(1.5, ratio))));
}

export function mountLiveGlobe(
  host: HTMLElement,
  initial: LiveCallVisual,
  options?: {
    moving?: boolean;
    readEnergy?: () => { inward: number; outward: number };
    earthSrc?: string;
    emblemSrc?: string;
    onAssets?: (state: LiveGlobeAssetState) => void;
  },
): LiveGlobeHandle {
  const canvas = document.createElement('canvas');
  canvas.className = 'live-globe-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const context = canvas.getContext('2d', { alpha: true });
  let visual = initial;
  let inward = initial.inward;
  let outward = initial.outward;
  let rotation = 0.35;
  let frame = 0;
  let last = 0;
  let disposed = false;
  let paused = false;
  let visible = true;
  let hidden = typeof document !== 'undefined' && document.hidden;
  let allowMotion = options?.moving !== false;
  let earth: ImageData | null = null;
  let emblem: HTMLCanvasElement | null = null;
  const assetState: LiveGlobeAssetState = { earth: 'loading', emblem: 'loading' };
  const media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = Boolean(media?.matches);

  const publishAssets = () => options?.onAssets?.({ ...assetState });

  const reducedNow = () => Boolean(media?.matches);

  const shouldAnimate = () =>
    !disposed &&
    !paused &&
    visible &&
    !hidden &&
    allowMotion &&
    !reduced &&
    visual.rotate;

  const measure = () => {
    const box = host.getBoundingClientRect();
    const css = liveGlobeSquareCss(box.width, box.height);
    return { css, pixels: pixelBudget(css) };
  };

  const resize = () => {
    const { css, pixels } = measure();
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
    canvas.style.aspectRatio = '1';
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
      return true;
    }
    return false;
  };

  const paint = (stamp: number) => {
    if (!context || disposed) return;
    resize();
    const width = canvas.width;
    const radius = width * 0.46;
    const cx = width / 2;
    const cy = width / 2;
    const image = context.createImageData(width, width);
    const pixels = image.data;
    const lightX = -0.38;
    const lightY = 0.28;
    const lightZ = 0.88;
    const kind = visual.kind;
    const dim =
      kind === 'ended' || kind === 'error' ? 0.78 : kind === 'muted' || kind === 'blocked' ? 0.86 : 1;
    for (let y = 0; y < width; y++) {
      const ny = (y - cy) / radius;
      for (let x = 0; x < width; x++) {
        const nx = (x - cx) / radius;
        const sphere = liveGlobeSphereCoords(nx, ny, rotation);
        if (!sphere) continue;
        const [red, green, blue] = earth
          ? sample(earth, sphere.lon, sphere.lat)
          : ([24, 38, 32] as const);
        const nz = sphere.facing;
        const diffuse = Math.max(0, nx * lightX + -ny * lightY + nz * lightZ);
        const wrap = diffuse * 0.5 + 0.48;
        const terminator = 0.58 + 0.42 * clamp01((diffuse + 0.2) / 0.6);
        const spec = Math.pow(diffuse, 30) * (0.045 + outward * 0.035);
        const fresnel = Math.pow(1 - nz, 3.4);
        const inhale = kind === 'listening' ? inward * 0.06 * (1 - nz) : 0;
        const glow = fresnel * (8 + outward * 14);
        const index = (y * width + x) * 4;
        pixels[index] = Math.min(
          255,
          (red * wrap + spec * 170 + glow * 0.16) * dim * terminator - inhale * 12,
        );
        pixels[index + 1] = Math.min(
          255,
          (green * wrap + spec * 130 + glow * 0.4) * dim * terminator - inhale * 6,
        );
        pixels[index + 2] = Math.min(
          255,
          (blue * wrap + spec * 70 + glow * 0.22) * dim * terminator,
        );
        pixels[index + 3] = 255;
      }
    }
    context.clearRect(0, 0, width, width);
    context.putImageData(image, 0, 0);
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();
    if (emblem) {
      const size = radius * 0.7;
      const dx = cx - size / 2;
      const dy = cy - size / 2 + size * 0.035;
      const shadow = context.createRadialGradient(
        cx,
        cy + size * 0.1,
        size * 0.06,
        cx,
        cy + size * 0.08,
        size * 0.46,
      );
      shadow.addColorStop(0, 'rgba(5,8,7,0.32)');
      shadow.addColorStop(1, 'rgba(5,8,7,0)');
      context.fillStyle = shadow;
      context.beginPath();
      if (typeof context.ellipse === 'function') {
        context.ellipse(cx, cy + size * 0.08, size * 0.4, size * 0.24, 0, 0, Math.PI * 2);
      } else {
        context.arc(cx, cy + size * 0.08, size * 0.32, 0, Math.PI * 2);
      }
      context.fill();
      context.save();
      context.globalAlpha = 0.1 + outward * 0.04;
      context.translate(cx, cy + radius * 0.12);
      context.scale(0.9, -0.26);
      if (typeof context.filter === 'string') context.filter = 'blur(1.6px)';
      context.drawImage(emblem, -size / 2, -size / 2, size, size);
      if (typeof context.filter === 'string') context.filter = 'none';
      context.restore();
      context.globalAlpha = 0.86;
      context.drawImage(emblem, dx, dy, size, size);
      const wash = context.createRadialGradient(
        cx - radius * 0.2,
        cy - radius * 0.24,
        radius * 0.04,
        cx,
        cy,
        radius,
      );
      wash.addColorStop(0, `rgba(232,233,226,${0.035 + outward * 0.025})`);
      wash.addColorStop(0.5, `rgba(46,110,86,${0.04 + outward * 0.025})`);
      wash.addColorStop(1, 'rgba(196,145,47,0.025)');
      context.globalCompositeOperation = 'soft-light';
      context.globalAlpha = 1;
      context.fillStyle = wash;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      context.globalCompositeOperation = 'source-over';
    }
    context.restore();
    const rim = context.createRadialGradient(cx, cy, radius * 0.96, cx, cy, radius * 1.06);
    const rimAlpha =
      kind === 'error' ? 0.1 : kind === 'ended' ? 0.07 : kind === 'muted' ? 0.09 : 0.16 + outward * 0.08;
    rim.addColorStop(0, 'rgba(36,91,72,0)');
    rim.addColorStop(0.7, `rgba(46,110,86,${rimAlpha})`);
    rim.addColorStop(1, 'rgba(7,11,10,0)');
    context.fillStyle = rim;
    context.beginPath();
    context.arc(cx, cy, radius * 1.06, 0, Math.PI * 2);
    context.fill();
    last = stamp;
  };

  const stopLoop = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const tick = (stamp: number) => {
    frame = 0;
    if (disposed) return;
    if (!shouldAnimate()) {
      paint(stamp);
      return;
    }
    if (stamp - last >= 33) {
      const measured = options?.readEnergy?.();
      if (measured) {
        inward = clamp01(measured.inward);
        outward = clamp01(measured.outward);
      }
      const speed =
        visual.kind === 'connecting' || visual.kind === 'recovering' ? 0.00022 : 0.00012;
      rotation += Math.min(48, stamp - last || 16) * speed;
      paint(stamp);
    }
    if (shouldAnimate() && !frame) frame = requestAnimationFrame(tick);
  };

  const ensureLoop = () => {
    if (disposed) return;
    reduced = reducedNow();
    if (shouldAnimate()) {
      if (!frame) frame = requestAnimationFrame(tick);
      return;
    }
    stopLoop();
    paint(typeof performance !== 'undefined' ? performance.now() : 0);
  };

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          visible = entries[0]?.isIntersecting ?? false;
          ensureLoop();
        })
      : null;
  observer?.observe(host);
  const sizeObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          if (disposed || shouldAnimate()) return;
          const { css, pixels } = measure();
          if (
            canvas.style.width === `${css}px` &&
            canvas.style.height === `${css}px` &&
            canvas.width === pixels &&
            canvas.height === pixels
          ) {
            return;
          }
          paint(typeof performance !== 'undefined' ? performance.now() : 0);
        })
      : null;
  sizeObserver?.observe(host);
  const onVisibility = () => {
    hidden = document.hidden;
    ensureLoop();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const onMotionPreference = () => ensureLoop();
  media?.addEventListener?.('change', onMotionPreference);

  if (typeof document !== 'undefined') {
    const fallback = document.createElement('canvas');
    fallback.width = FALLBACK_WIDTH;
    fallback.height = FALLBACK_HEIGHT;
    const fallbackContext = fallback.getContext('2d');
    if (fallbackContext) {
      paintFallbackMap(fallbackContext);
      earth = fallbackContext.getImageData(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);
      assetState.earth = 'fallback';
    }
  }
  void loadImage(options?.earthSrc ?? liveGlobeAssetSources.earth)
    .then((image) => {
      if (disposed) return;
      const width = Math.min(1024, image.naturalWidth || 2048);
      const height = Math.min(512, image.naturalHeight || 1024);
      const prepared = prepareEarth(image, width, height);
      if (!prepared) {
        assetState.earth = 'fallback';
        publishAssets();
        return;
      }
      earth = prepared;
      assetState.earth = 'ready';
      publishAssets();
      paint(typeof performance !== 'undefined' ? performance.now() : 0);
    })
    .catch(() => {
      if (disposed) return;
      assetState.earth = 'fallback';
      publishAssets();
      paint(typeof performance !== 'undefined' ? performance.now() : 0);
    });
  void loadImage(options?.emblemSrc ?? liveGlobeAssetSources.emblem)
    .then((image) => {
      if (disposed) return;
      emblem = prepareEmblem(image);
      assetState.emblem = emblem ? 'ready' : 'missing';
      publishAssets();
      paint(typeof performance !== 'undefined' ? performance.now() : 0);
    })
    .catch(() => {
      if (disposed) return;
      emblem = null;
      assetState.emblem = 'missing';
      publishAssets();
      paint(typeof performance !== 'undefined' ? performance.now() : 0);
    });

  paint(typeof performance !== 'undefined' ? performance.now() : 0);
  ensureLoop();

  return {
    setVisual: (next) => {
      visual = next;
      inward = next.inward;
      outward = next.outward;
      ensureLoop();
    },
    setEnergy: (nextInward, nextOutward) => {
      inward = clamp01(nextInward);
      outward = clamp01(nextOutward);
    },
    setMotion: (moving) => {
      allowMotion = moving;
      ensureLoop();
    },
    assets: () => ({ ...assetState }),
    metrics: () => ({
      bufferWidth: canvas.width,
      bufferHeight: canvas.height,
      cssWidth: canvas.style.width,
      cssHeight: canvas.style.height,
      looping: frame !== 0,
      rotation,
    }),
    pause: () => {
      paused = true;
      ensureLoop();
    },
    resume: () => {
      paused = false;
      ensureLoop();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stopLoop();
      observer?.disconnect();
      sizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      media?.removeEventListener?.('change', onMotionPreference);
      canvas.remove();
    },
    paintStatic: () => paint(typeof performance !== 'undefined' ? performance.now() : 0),
  };
}

export const liveGlobeAssets = {
  earth: liveGlobeAssetSources.earth,
  emblem: liveGlobeAssetSources.emblem,
  emblemId: liveGlobeAssetSources.emblemId,
  missingTransparentEmblem:
    'Live uses the founder-supplied 1254 RGBA original A/star. Install icons remain aethelios-official-20261015 opaque plates. No SVG of this mark is in the repository; the supplied original already has alpha and is not redrawn.',
  crest: brand.crest,
};
