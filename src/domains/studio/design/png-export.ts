import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PNG } from 'pngjs';
import { mediaPixels } from './units';
import type { DesignDocument } from './document';
import { exportSvg } from './svg-export';
import type { AssetBytes } from './assets';

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const err: Buffer[] = [];
    child.stderr.on('data', (chunk) => err.push(chunk as Buffer));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PNG rasterizer failed (${code}): ${Buffer.concat(err).toString('utf8').slice(0, 400)}`));
    });
  });
}

export async function exportPng(
  document: DesignDocument,
  assets: AssetBytes[],
  ffmpegPath = process.env.STUDIO_FFMPEG_PATH || 'ffmpeg',
) {
  const svg = await exportSvg(document, assets, 'embed');
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-png-'));
  try {
    const svgPath = path.join(dir, 'design.svg');
    const pngPath = path.join(dir, 'design.png');
    await writeFile(svgPath, svg);
    const size = mediaPixels(document.page);
    await run(ffmpegPath, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      svgPath,
      '-vf',
      `format=rgba,scale=${size.width}:${size.height}:flags=lanczos`,
      '-frames:v',
      '1',
      '-update',
      '1',
      pngPath,
    ]);
    const bytes = await readFile(pngPath);
    const png = PNG.sync.read(bytes);
    if (png.width !== size.width || png.height !== size.height)
      throw new Error(
        `PNG dimensions were ${png.width}×${png.height}, expected ${size.width}×${size.height} at ${document.page.ppi} PPI (trim plus outward bleed).`,
      );
    return new Uint8Array(bytes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const missing = /ENOENT|spawn ffmpeg/i.test(reason) || /not found/i.test(reason);
    throw new Error(
      missing
        ? `PNG export requires FFmpeg to rasterize the outlined SVG. Install a trusted FFmpeg build and set STUDIO_FFMPEG_PATH if it is not on PATH. Studio will not return a degraded rectangle fallback. ${reason}`
        : `PNG export failed and will not return a silently degraded substitute. ${reason}`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function inspectPng(bytes: Uint8Array) {
  if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    throw new Error('Export is not a PNG.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
