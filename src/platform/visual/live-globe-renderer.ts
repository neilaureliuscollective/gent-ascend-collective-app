import { liveContinents } from './live-continents';
import type { LiveCallVisual } from './live-call-presentation';
import { liveGlobeMapUv, liveGlobeSphereCoords } from './live-globe-projection';
import { brand } from '@/platform/brand';

export type LiveGlobeHandle = {
  setVisual: (visual: LiveCallVisual) => void;
  setEnergy: (inward: number, outward: number, reactive: boolean) => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
  paintStatic: () => void;
};

const MAX_PIXELS = 480;
const FALLBACK_WIDTH = 640;
const FALLBACK_HEIGHT = 320;
const EARTH_SRC = '/visual/nasa-blue-marble-land-shallow-topo-2048.jpg';
const EMBLEM_SRC = '/brand/aethelios-official-20261015-512.png';

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function paintFallbackMap(target: CanvasRenderingContext2D) {
  const { width, height } = target.canvas;
  target.fillStyle = '#0a100e';
  target.fillRect(0, 0, width, height);
  const project = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];
  target.fillStyle = '#3d5a4c';
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

function sample(data: ImageData, lon: number, lat: number) {
  const { u, v } = liveGlobeMapUv(lon, lat);
  const x = ((u % 1) + 1) % 1;
  const width = data.width;
  const height = data.height;
  const fx = x * (width - 1);
  const fy = Math.min(height - 1, Math.max(0, v * (height - 1)));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - x0;
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
  const ocean = blue > green + 6 && blue > red + 10 && luma < 96;
  if (ocean) {
    const depth = luma / 96;
    return [6 + depth * 8, 10 + depth * 14, 10 + depth * 10] as const;
  }
  const ice = luma > 196 && Math.abs(red - green) < 24;
  if (ice) return [72, 86, 84] as const;
  const relief = luma / 255;
  return [34 + relief * 64, 62 + relief * 96, 46 + relief * 52] as const;
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
    image.onload = () => resolve(image);
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
  let earth: ImageData | null = null;
  let emblem: HTMLCanvasElement | null = null;
  const moving = options?.moving !== false;
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const resize = () => {
    const box = host.getBoundingClientRect();
    const css = Math.max(48, Math.min(box.width || 240, box.height || 240));
    const pixels = pixelBudget(css);
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
    if (canvas.width !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
  };

  const paint = (stamp: number) => {
    if (!context || disposed) return;
    resize();
    const width = canvas.width;
    const radius = width * 0.42;
    const cx = width / 2;
    const cy = width / 2;
    const image = context.createImageData(width, width);
    const pixels = image.data;
    const lightX = -0.42;
    const lightY = 0.36;
    const lightZ = 0.84;
    const kind = visual.kind;
    const night =
      kind === 'ended' || kind === 'error' || kind === 'muted' || kind === 'blocked' ? 0.7 : 1;
    for (let y = 0; y < width; y++) {
      const ny = (y - cy) / radius;
      for (let x = 0; x < width; x++) {
        const nx = (x - cx) / radius;
        const sphere = liveGlobeSphereCoords(nx, ny, rotation);
        if (!sphere) continue;
        const [red, green, blue] = earth
          ? sample(earth, sphere.lon, sphere.lat)
          : ([22, 34, 30] as const);
        const nz = sphere.facing;
        const diffuse = Math.max(0, nx * lightX + -ny * lightY + nz * lightZ);
        const wrap = diffuse * 0.62 + 0.28;
        const terminator = clamp01((diffuse + 0.12) / 0.4);
        const spec = Math.pow(diffuse, 42) * (0.1 + outward * 0.08);
        const fresnel = Math.pow(1 - nz, 2.6);
        const inhale = kind === 'listening' ? inward * 0.12 * (1 - nz) : 0;
        const glow = fresnel * (10 + outward * 22);
        const index = (y * width + x) * 4;
        pixels[index] = Math.min(
          255,
          (red * wrap + spec * 190 + glow * 0.2) * night * terminator - inhale * 22,
        );
        pixels[index + 1] = Math.min(
          255,
          (green * wrap + spec * 150 + glow * 0.55) * night * terminator - inhale * 10,
        );
        pixels[index + 2] = Math.min(
          255,
          (blue * wrap + spec * 80 + glow * 0.32) * night * terminator,
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
      const size = radius * 1.24;
      context.globalAlpha = 0.97;
      context.drawImage(emblem, cx - size / 2, cy - size / 2, size, size);
      const wash = context.createRadialGradient(
        cx - radius * 0.22,
        cy - radius * 0.28,
        radius * 0.05,
        cx,
        cy,
        radius,
      );
      wash.addColorStop(0, `rgba(232,233,226,${0.1 + outward * 0.05})`);
      wash.addColorStop(0.4, `rgba(54,137,108,${0.1 + outward * 0.06})`);
      wash.addColorStop(0.78, `rgba(196,145,47,${0.08 + outward * 0.04})`);
      wash.addColorStop(1, 'rgba(7,11,10,0.04)');
      context.globalCompositeOperation = 'soft-light';
      context.globalAlpha = 1;
      context.fillStyle = wash;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      context.globalCompositeOperation = 'source-over';
    }
    context.restore();
    const atmosphere = context.createRadialGradient(
      cx,
      cy,
      radius * 0.9,
      cx,
      cy,
      radius * (1.16 + outward * 0.1 - inward * 0.04),
    );
    const atmosphereAlpha =
      kind === 'error' ? 0.1 : kind === 'ended' ? 0.08 : kind === 'muted' ? 0.12 : 0.16 + outward * 0.18;
    atmosphere.addColorStop(0, 'rgba(36,91,72,0)');
    atmosphere.addColorStop(0.72, `rgba(36,91,72,${atmosphereAlpha})`);
    atmosphere.addColorStop(1, 'rgba(7,11,10,0)');
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = atmosphere;
    context.beginPath();
    context.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    last = stamp;
  };

  const tick = (stamp: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    if (paused || !visible || hidden) return;
    if (stamp - last < 33) return;
    const measured = options?.readEnergy?.();
    if (measured) {
      inward = clamp01(measured.inward);
      outward = clamp01(measured.outward);
    }
    if (visual.rotate && moving && !reduced) {
      const speed =
        visual.kind === 'connecting' || visual.kind === 'recovering' ? 0.00022 : 0.00012;
      rotation += Math.min(48, stamp - last) * speed;
    }
    paint(stamp);
  };

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          visible = entries[0]?.isIntersecting ?? false;
        })
      : null;
  observer?.observe(host);
  const onVisibility = () => {
    hidden = document.hidden;
  };
  document.addEventListener('visibilitychange', onVisibility);

  if (typeof document !== 'undefined') {
    const fallback = document.createElement('canvas');
    fallback.width = FALLBACK_WIDTH;
    fallback.height = FALLBACK_HEIGHT;
    const fallbackContext = fallback.getContext('2d');
    if (fallbackContext) {
      paintFallbackMap(fallbackContext);
      earth = fallbackContext.getImageData(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);
    }
  }
  void loadImage(EARTH_SRC)
    .then((image) => {
      if (disposed) return;
      const width = Math.min(1024, image.naturalWidth || 2048);
      const height = Math.min(512, image.naturalHeight || 1024);
      earth = prepareEarth(image, width, height);
      paint(typeof performance !== 'undefined' ? performance.now() : 0);
    })
    .catch(() => {});
  void loadImage(EMBLEM_SRC)
    .then((image) => {
      if (disposed) return;
      emblem = punchDarkPlate(image);
      paint(typeof performance !== 'undefined' ? performance.now() : 0);
    })
    .catch(() => {});

  paint(typeof performance !== 'undefined' ? performance.now() : 0);
  if (moving && !reduced) frame = requestAnimationFrame(tick);

  return {
    setVisual: (next) => {
      visual = next;
      inward = next.inward;
      outward = next.outward;
      if (paused || reduced || !moving)
        paint(typeof performance !== 'undefined' ? performance.now() : 0);
    },
    setEnergy: (nextInward, nextOutward) => {
      inward = clamp01(nextInward);
      outward = clamp01(nextOutward);
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
    },
    paintStatic: () => paint(typeof performance !== 'undefined' ? performance.now() : 0),
  };
}

export const liveGlobeAssets = {
  earth: EARTH_SRC,
  emblem: EMBLEM_SRC,
  emblemId: 'aethelios-official-20261015-512',
  missingTransparentEmblem:
    'No transparent or vector official gold-A exists. All aethelios-official-20261015 PNGs are opaque RGB plates; crest/lockup are WebP plates. Live punches the dark plate of the 512 official mark without cropping.',
  crest: brand.crest,
};
