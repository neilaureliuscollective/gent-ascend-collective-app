import { liveContinents } from './live-continents';
import type { LiveCallVisual } from './live-call-presentation';

export type LiveGlobeHandle = {
  setVisual: (visual: LiveCallVisual) => void;
  setEnergy: (inward: number, outward: number, reactive: boolean) => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
  paintStatic: () => void;
};

const MAX_PIXELS = 480;
const MAP_WIDTH = 640;
const MAP_HEIGHT = 320;

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function paintMap(target: CanvasRenderingContext2D) {
  const { width, height } = target.canvas;
  target.fillStyle = '#070b0a';
  target.fillRect(0, 0, width, height);
  const ocean = target.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#12201c');
  ocean.addColorStop(0.5, '#0c1412');
  ocean.addColorStop(1, '#080d0c');
  target.fillStyle = ocean;
  target.fillRect(0, 0, width, height);
  const project = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];
  target.fillStyle = '#5d7d6a';
  target.strokeStyle = 'rgba(212,183,106,0.35)';
  target.lineWidth = 1;
  for (const ring of liveContinents) {
    target.beginPath();
    ring.forEach((point, index) => {
      const [x, y] = project(point[0] ?? 0, point[1] ?? 0);
      if (index === 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    });
    target.closePath();
    target.fill();
    target.stroke();
  }
  const shade = target.createLinearGradient(0, 0, width, height);
  shade.addColorStop(0, 'rgba(54,137,108,0.08)');
  shade.addColorStop(0.45, 'transparent');
  shade.addColorStop(1, 'rgba(5,7,6,0.18)');
  target.fillStyle = shade;
  target.fillRect(0, 0, width, height);
}

let mapPixels: Uint8ClampedArray | null = null;

function mapTexture() {
  if (mapPixels) return mapPixels;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  paintMap(context);
  mapPixels = context.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  return mapPixels;
}

function sampleMap(lon: number, lat: number) {
  const data = mapTexture();
  if (!data) return [12, 16, 14] as const;
  const u = ((lon + Math.PI) / (Math.PI * 2) + 1) % 1;
  const v = 0.5 - lat / Math.PI;
  const x = Math.min(MAP_WIDTH - 1, Math.max(0, Math.floor(u * MAP_WIDTH)));
  const y = Math.min(MAP_HEIGHT - 1, Math.max(0, Math.floor(v * MAP_HEIGHT)));
  const index = (y * MAP_WIDTH + x) * 4;
  return [data[index] ?? 12, data[index + 1] ?? 16, data[index + 2] ?? 14] as const;
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
  let rotation = 0.42;
  let frame = 0;
  let last = 0;
  let disposed = false;
  let paused = false;
  let visible = true;
  let hidden = typeof document !== 'undefined' && document.hidden;
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
    const lightX = -0.46;
    const lightY = 0.58;
    const lightZ = 0.68;
    const kind = visual.kind;
    const night =
      kind === 'ended' || kind === 'error' || kind === 'muted' || kind === 'blocked' ? 0.62 : 1;
    const warmth = kind === 'speaking' ? 1 + outward * 0.18 : 1;
    for (let y = 0; y < width; y++) {
      const ny = (y - cy) / radius;
      for (let x = 0; x < width; x++) {
        const nx = (x - cx) / radius;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const rx = nx * cos + nz * sin;
        const rz = -nx * sin + nz * cos;
        const lon = Math.atan2(rx, rz);
        const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
        const [red, green, blue] = sampleMap(lon, lat);
        const diffuse = Math.max(0, nx * lightX + ny * lightY + nz * lightZ);
        const rim = Math.pow(1 - nz, 2.4);
        const spec = Math.pow(diffuse, 28) * (0.18 + outward * 0.22);
        const limb = kind === 'listening' ? inward * 0.16 * (1 - nz) : 0;
        const emerald = rim * (18 + outward * 42);
        const index = (y * width + x) * 4;
        const light = 0.72 + diffuse * 0.5;
        pixels[index] = Math.min(
          255,
          (red * light + spec * 210 + emerald * 0.18) * night * warmth - limb * 28,
        );
        pixels[index + 1] = Math.min(
          255,
          (green * light + spec * 170 + emerald * 0.62) * night * warmth - limb * 12,
        );
        pixels[index + 2] = Math.min(
          255,
          (blue * light + spec * 90 + emerald * 0.4) * night,
        );
        pixels[index + 3] = 255;
      }
    }
    context.clearRect(0, 0, width, width);
    context.putImageData(image, 0, 0);
    const atmosphere = context.createRadialGradient(
      cx,
      cy,
      radius * 0.86,
      cx,
      cy,
      radius * (1.18 + outward * 0.16 - inward * 0.06),
    );
    const atmosphereAlpha =
      kind === 'error'
        ? 0.12
        : kind === 'ended'
          ? 0.1
          : kind === 'muted'
            ? 0.14
            : 0.2 + outward * 0.28;
    atmosphere.addColorStop(0, `rgba(36,91,72,${atmosphereAlpha})`);
    atmosphere.addColorStop(0.55, `rgba(22,63,53,${atmosphereAlpha * 0.45})`);
    atmosphere.addColorStop(1, 'rgba(7,11,10,0)');
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = atmosphere;
    context.beginPath();
    context.arc(cx, cy, radius * 1.22, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    const sheen = context.createRadialGradient(
      cx - radius * 0.28,
      cy - radius * 0.32,
      radius * 0.04,
      cx,
      cy,
      radius,
    );
    sheen.addColorStop(0, `rgba(232,233,226,${0.1 + outward * 0.08})`);
    sheen.addColorStop(0.18, 'rgba(54,137,108,0.08)');
    sheen.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = sheen;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
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
        visual.kind === 'connecting' || visual.kind === 'recovering' ? 0.00028 : 0.00016;
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
  mapTexture();
  paint(typeof performance !== 'undefined' ? performance.now() : 0);
  if (moving && !reduced) frame = requestAnimationFrame(tick);

  return {
    setVisual: (next) => {
      visual = next;
      inward = next.inward;
      outward = next.outward;
      if (paused || reduced || !moving) paint(typeof performance !== 'undefined' ? performance.now() : 0);
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
