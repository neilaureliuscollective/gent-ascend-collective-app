import { inspectFfmpeg } from './ffmpeg';
import { designFontFaceList, designFontPath } from '../design/fonts';
import { access, readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { rasterizeSvgMarkup } from '../design/raster';
export const RENDER_CONCURRENCY_DEFAULT = 1;
export const RENDER_SHUTDOWN_MS = 25_000;

export function renderConcurrency() {
  const raw = Number(process.env.STUDIO_RENDER_CONCURRENCY ?? RENDER_CONCURRENCY_DEFAULT);
  if (!Number.isFinite(raw) || raw < 1) return RENDER_CONCURRENCY_DEFAULT;
  return Math.min(2, Math.floor(raw));
}

export function healthBind() {
  return process.env.STUDIO_RENDER_HEALTH_BIND === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1';
}

export function healthPort() {
  const raw = Number(process.env.STUDIO_RENDER_HEALTH_PORT ?? '');
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

export async function proveFontRaster() {
  const face = designFontPath('inter', 700);
  const bytes = await readFile(face);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><defs><style>@font-face{font-family:"StudioPreflight";src:url("data:font/ttf;base64,${Buffer.from(bytes).toString('base64')}") format("truetype");font-weight:700;}</style></defs><rect width="160" height="80" fill="#050706"/><text x="12" y="54" font-family="StudioPreflight" font-size="40" font-weight="700" fill="#C4912F">Hi</text></svg>`;
  const png = await rasterizeSvgMarkup(svg, 160, 80);
  const decoded = PNG.sync.read(Buffer.from(png));
  if (decoded.width !== 160 || decoded.height !== 80) throw new Error('Preflight PNG size mismatch.');
  let gold = 0;
  for (let i = 0; i < decoded.data.length; i += 4) {
    if (decoded.data[i]! > 140 && decoded.data[i + 1]! > 90 && decoded.data[i + 2]! < 90 && decoded.data[i + 3]! > 16)
      gold += 1;
  }
  if (gold < 40) throw new Error('Preflight did not rasterize the bundled Inter 700 face.');
  return { width: decoded.width, height: decoded.height, goldPixels: gold };
}

export async function rendererPreflight() {
  const fonts: { id: string; weight: number; path: string; present: boolean }[] = [];
  for (const face of designFontFaceList()) {
    let present = false;
    try {
      await access(face.path);
      present = true;
    } catch {
      present = false;
    }
    fonts.push({ id: face.id, weight: face.weight, path: face.path, present });
  }
  let ffmpeg = null;
  let ffmpegError: string | null = null;
  try {
    ffmpeg = await inspectFfmpeg();
  } catch (error) {
    ffmpegError = error instanceof Error ? error.message.slice(0, 180) : 'FFmpeg unavailable';
  }
  const libx264 = Boolean(ffmpeg?.configuration.includes('libx264'));
  let raster: { width: number; height: number; goldPixels: number } | null = null;
  let rasterError: string | null = null;
  if (ffmpeg && fonts.every((font) => font.present)) {
    try {
      raster = await proveFontRaster();
    } catch (error) {
      rasterError = error instanceof Error ? error.message.slice(0, 180) : 'Font raster proof failed';
    }
  } else {
    rasterError = 'Fonts or FFmpeg missing; SVG pipeline was not executed.';
  }
  const ok = Boolean(ffmpeg && libx264 && fonts.every((font) => font.present) && raster);
  return {
    ok,
    ffmpeg,
    ffmpegError,
    raster,
    rasterError,
    libx264,
    aac: Boolean(ffmpeg),
    fonts,
    concurrency: renderConcurrency(),
    designExport: {
      svg: 'web-runtime-static-ttf',
      png: ffmpeg && raster ? 'ffmpeg-librsvg' : 'unavailable',
      pdf: ffmpeg && raster ? 'pdf-lib-static-ttf; SVG marks rasterize through FFmpeg' : 'pdf-lib-static-ttf (SVG marks need FFmpeg)',
    },
    film: libx264 ? 'ffmpeg-libx264-aac' : 'unavailable',
    note: ok
      ? 'Local renderer preflight rendered bundled fonts through the SVG pipeline. This is not a commissioned hosted worker.'
      : 'Renderer preflight failed. Hosted rendering stays unavailable.',
  };
}

export function sanitizeWorkerLog(message: string) {
  return message
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+/g, '[redacted-jwt]')
    .replace(/service_role|SUPABASE_SERVICE_ROLE_KEY/gi, '[redacted]')
    .replace(/sk-[A-Za-z0-9]{10,}/g, '[redacted-key]');
}
