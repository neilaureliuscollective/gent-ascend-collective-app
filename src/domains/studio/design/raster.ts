import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { decode as decodeJpeg } from 'jpeg-js';
import type { AssetBytes } from './assets';
import { RENDER_LIMITS } from '../render/limits';
import { runCommand } from '../render/process';

export function ffmpegBinary() {
  return process.env.STUDIO_FFMPEG_PATH || 'ffmpeg';
}

export async function runFfmpeg(args: string[], timeoutMs: number = RENDER_LIMITS.pngMs, signal?: AbortSignal) {
  await runCommand(ffmpegBinary(), args, { timeoutMs, signal });
}

export async function rasterizeSvgMarkup(
  markup: string,
  width: number,
  height: number,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-svg-'));
  try {
    const svgPath = path.join(dir, 'layer.svg');
    const pngPath = path.join(dir, 'layer.png');
    await writeFile(svgPath, markup);
    await runFfmpeg(
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        svgPath,
        '-vf',
        `format=rgba,scale=${Math.max(1, width)}:${Math.max(1, height)}:flags=lanczos`,
        '-frames:v',
        '1',
        '-update',
        '1',
        pngPath,
      ],
      options.timeoutMs ?? RENDER_LIMITS.pngMs,
      options.signal,
    );
    return new Uint8Array(await readFile(pngPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function assetPngBytes(asset: AssetBytes) {
  if (asset.mediaType === 'image/png') return asset.bytes;
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-img-'));
  try {
    const ext = asset.mediaType === 'image/jpeg' ? 'jpg' : 'webp';
    const input = path.join(dir, `in.${ext}`);
    const output = path.join(dir, 'out.png');
    await writeFile(input, asset.bytes);
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      '-frames:v',
      '1',
      '-update',
      '1',
      output,
    ]);
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function decodeRaster(asset: AssetBytes) {
  if (asset.mediaType === 'image/jpeg') {
    const decoded = decodeJpeg(Buffer.from(asset.bytes), { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  if (asset.mediaType === 'image/png') {
    const png = PNG.sync.read(Buffer.from(asset.bytes));
    return { width: png.width, height: png.height, data: png.data };
  }
  throw new Error('WebP must be decoded through the FFmpeg conversion path before pixel access.');
}
