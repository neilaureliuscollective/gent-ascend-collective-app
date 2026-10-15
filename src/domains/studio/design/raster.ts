import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PNG } from 'pngjs';
import { decode as decodeJpeg } from 'jpeg-js';
import type { AssetBytes } from './assets';

export function ffmpegBinary() {
  return process.env.STUDIO_FFMPEG_PATH || 'ffmpeg';
}

export function runFfmpeg(args: string[], timeoutMs = 20_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ ffmpegBinary(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Studio image conversion exceeded the time limit.'));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => err.push(chunk as Buffer));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(Buffer.concat(err).toString('utf8').slice(0, 400) || `ffmpeg exited ${code}`));
    });
  });
}

export async function rasterizeSvgMarkup(markup: string, width: number, height: number) {
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-svg-'));
  try {
    const svgPath = path.join(dir, 'layer.svg');
    const pngPath = path.join(dir, 'layer.png');
    await writeFile(svgPath, markup);
    await runFfmpeg([
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
    ]);
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
