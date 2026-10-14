import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { compositionVtt } from '../composition/captions';
import {
  compileCoverArgs,
  compileRender,
  type LocalAsset,
} from '../composition/compile';
import { compositionDuration, type CompositionDocument } from '../composition/model';
import { inspectRenderedMp4 } from './verify';

export type RenderResult = {
  film: Uint8Array;
  cover: Uint8Array;
  captions: Uint8Array;
  durationMs: number;
  width: number;
  height: number;
  ffmpeg: { path: string; version: string; configuration: string };
};

export function ffmpegBinary() {
  return process.env.STUDIO_FFMPEG_PATH || 'ffmpeg';
}

export function hostedRenderConfigured() {
  return process.env.STUDIO_RENDER_WORKER === 'true';
}

export function localRenderAvailable() {
  return Boolean(ffmpegBinary());
}

export async function inspectFfmpeg(binary = ffmpegBinary()) {
  const text = await runCapture(binary, ['-hide_banner', '-version']);
  const version = text.match(/ffmpeg version ([^\s]+)/)?.[1] ?? 'unknown';
  const configuration = text.match(/configuration: ([^\n]+)/)?.[1] ?? 'unknown';
  return { path: binary, version, configuration, license: configuration.includes('--enable-gpl') ? 'GPL' : 'unknown' };
}

function runCapture(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk) => out.push(chunk as Buffer));
    child.stderr.on('data', (chunk) => err.push(chunk as Buffer));
    child.on('error', reject);
    child.on('close', (code) => {
      const combined = `${Buffer.concat(out).toString('utf8')}\n${Buffer.concat(err).toString('utf8')}`;
      if (code === 0) resolve(combined);
      else reject(new Error(combined.slice(0, 600) || `Command failed (${code})`));
    });
  });
}

function run(command: string, args: string[], timeoutMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Studio render exceeded the time limit.'));
    }, timeoutMs);
    const abort = () => {
      child.kill('SIGKILL');
      reject(new Error('Studio render was cancelled.'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    child.stderr.on('data', (chunk) => err.push(chunk as Buffer));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (code === 0) resolve();
      else reject(new Error(Buffer.concat(err).toString('utf8').slice(0, 500) || `ffmpeg exited ${code}`));
    });
  });
}

export async function renderComposition(
  document: CompositionDocument,
  assets: LocalAsset[],
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<RenderResult> {
  const binary = ffmpegBinary();
  const ffmpeg = await inspectFfmpeg(binary);
  if (!ffmpeg.configuration.includes('libx264'))
    throw new Error('The configured FFmpeg build does not include libx264.');
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-render-'));
  try {
    const film = path.join(dir, 'film.mp4');
    const cover = path.join(dir, 'cover.png');
    const vtt = path.join(dir, 'captions.vtt');
    await mkdir(dir, { recursive: true });
    await writeFile(vtt, compositionVtt(document));
    const plan = compileRender(document, assets, { film, cover });
    await run(binary, plan.args, options.timeoutMs ?? 90_000, options.signal);
    await run(binary, compileCoverArgs(film, cover), 15_000, options.signal);
    const filmBytes = new Uint8Array(await readFile(film));
    const coverBytes = new Uint8Array(await readFile(cover));
    const duration = compositionDuration(document) / 1000;
    inspectRenderedMp4(filmBytes, { seconds: duration, width: plan.width, height: plan.height });
    return {
      film: filmBytes,
      cover: coverBytes,
      captions: new TextEncoder().encode(compositionVtt(document)),
      durationMs: plan.durationMs,
      width: plan.width,
      height: plan.height,
      ffmpeg,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
