import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PNG } from 'pngjs';
import { decode as decodeJpeg } from 'jpeg-js';
import { pagePixels, toPixels } from './units';
import { visibleOrder, type DesignDocument } from './document';
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
  const svg = await exportSvg(document, assets, 'outline');
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-png-'));
  try {
    const svgPath = path.join(dir, 'design.svg');
    const pngPath = path.join(dir, 'design.png');
    await writeFile(svgPath, svg);
    const size = pagePixels(document.page);
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
        `PNG dimensions were ${png.width}×${png.height}, expected ${size.width}×${size.height} at ${document.page.ppi} PPI.`,
      );
    return new Uint8Array(bytes);
  } catch (error) {
    return softwarePng(document, assets, error);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function softwarePng(document: DesignDocument, assets: AssetBytes[], cause: unknown) {
  const size = pagePixels(document.page);
  const png = new PNG({ width: size.width, height: size.height, fill: true });
  fillRect(png, 0, 0, size.width, size.height, hex(document.page.background));
  const lookup = new Map(assets.map((asset) => [`${asset.kind}:${asset.id}`, asset]));
  for (const layer of visibleOrder(document)) {
    const x = Math.round(toPixels(layer.x, document.page.unit, document.page.ppi));
    const y = Math.round(toPixels(layer.y, document.page.unit, document.page.ppi));
    const w = Math.round(toPixels(layer.width, document.page.unit, document.page.ppi));
    const h = Math.round(toPixels(layer.height, document.page.unit, document.page.ppi));
    if (layer.type === 'rect' || layer.type === 'ellipse')
      fillRect(png, x, y, w, h, hex(layer.fill), layer.opacity);
    if (layer.type === 'image') {
      const asset = lookup.get(`${layer.assetKind}:${layer.assetId}`);
      if (!asset) throw new Error(`Missing asset for layer ${layer.name}.`);
      blit(png, x, y, w, h, decodeImage(asset), layer.opacity);
    }
    if (layer.type === 'text')
      throw new Error(
        `PNG software fallback cannot draw “${layer.name}”. FFmpeg must rasterize outlined SVG type. ${cause instanceof Error ? cause.message : ''}`,
      );
  }
  void cause;
  return PNG.sync.write(png);
}

function hex(value: string) {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
    255,
  ] as const;
}

function fillRect(
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  color: readonly [number, number, number, number],
  opacity = 1,
) {
  for (let row = Math.max(0, y); row < Math.min(png.height, y + h); row++) {
    for (let col = Math.max(0, x); col < Math.min(png.width, x + w); col++) {
      const i = (png.width * row + col) << 2;
      const a = color[3] * opacity;
      png.data[i] = color[0]!;
      png.data[i + 1] = color[1]!;
      png.data[i + 2] = color[2]!;
      png.data[i + 3] = a;
    }
  }
}

function decodeImage(asset: AssetBytes) {
  if (asset.mediaType === 'image/jpeg') {
    const decoded = decodeJpeg(Buffer.from(asset.bytes), { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  const png = PNG.sync.read(Buffer.from(asset.bytes));
  return { width: png.width, height: png.height, data: png.data };
}

function blit(
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  source: { width: number; height: number; data: Uint8Array },
  opacity: number,
) {
  for (let row = 0; row < h; row++) {
    const dy = y + row;
    if (dy < 0 || dy >= png.height) continue;
    const sy = Math.min(source.height - 1, Math.floor((row / h) * source.height));
    for (let col = 0; col < w; col++) {
      const dx = x + col;
      if (dx < 0 || dx >= png.width) continue;
      const sx = Math.min(source.width - 1, Math.floor((col / w) * source.width));
      const si = (source.width * sy + sx) << 2;
      const di = (png.width * dy + dx) << 2;
      png.data[di] = source.data[si]!;
      png.data[di + 1] = source.data[si + 1]!;
      png.data[di + 2] = source.data[si + 2]!;
      png.data[di + 3] = (source.data[si + 3] ?? 255) * opacity;
    }
  }
}

export function inspectPng(bytes: Uint8Array) {
  if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    throw new Error('Export is not a PNG.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
