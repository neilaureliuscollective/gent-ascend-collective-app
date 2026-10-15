import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { compositionAss, compositionVtt } from '../composition/captions';
import {
  compileCoverArgs,
  compileRender,
  type LocalAsset,
} from '../composition/compile';
import { compositionPlaybackMs } from '../composition/timing';
import { type CompositionDocument } from '../composition/model';
import { inspectRenderedMp4 } from './verify';
import { RENDER_LIMITS, remainingMs } from './limits';
import { combineAbortSignals, runCommand } from './process';

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

/** Never implied by STUDIO_RENDER_WORKER. Requires an explicit commissioned worker. */
export function hostedRenderConfigured() {
  return process.env.STUDIO_RENDER_COMMISSIONED === 'true';
}

export function renderWorkerRequested() {
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

function runCapture(command: string, args: string[], timeoutMs = 8_000, signal?: AbortSignal) {
  return runCommand(command, args, { timeoutMs, signal }).then(
    (result) => `${result.stdout}\n${result.stderr}`,
  );
}

export async function renderComposition(
  document: CompositionDocument,
  assets: LocalAsset[],
  options: { signal?: AbortSignal; timeoutMs?: number; deadlineAt?: number } = {},
): Promise<RenderResult> {
  const binary = ffmpegBinary();
  const ffmpeg = await inspectFfmpeg(binary);
  if (!ffmpeg.configuration.includes('libx264'))
    throw new Error('The configured FFmpeg build does not include libx264.');
  const deadlineAt = options.deadlineAt ?? Date.now() + (options.timeoutMs ?? RENDER_LIMITS.jobMs);
  const signal = combineAbortSignals(
    [options.signal, AbortSignal.timeout(Math.max(1, deadlineAt - Date.now()))].filter(
      (value): value is AbortSignal => Boolean(value),
    ),
  );
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-render-'));
  try {
    const film = path.join(dir, 'film.mp4');
    const cover = path.join(dir, 'cover.png');
    const vtt = path.join(dir, 'captions.vtt');
    const ass = path.join(dir, 'overlay.ass');
    await mkdir(dir, { recursive: true });
    await writeFile(vtt, compositionVtt(document));
    await writeFile(ass, compositionAss(document));
    const probed = await probeAssets(binary, assets, signal, deadlineAt);
    const plan = compileRender(document, probed, { film, cover, captions: ass });
    await runCommand(binary, plan.args, {
      timeoutMs: remainingMs(deadlineAt, RENDER_LIMITS.renderMs),
      signal,
    });
    await runCommand(binary, compileCoverArgs(film, cover), {
      timeoutMs: remainingMs(deadlineAt, RENDER_LIMITS.coverMs),
      signal,
    });
    const filmBytes = new Uint8Array(await readFile(film));
    const coverBytes = new Uint8Array(await readFile(cover));
    const duration = compositionPlaybackMs(document) / 1000;
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

async function probeAssets(
  binary: string,
  assets: LocalAsset[],
  signal?: AbortSignal,
  deadlineAt = Date.now() + RENDER_LIMITS.jobMs,
): Promise<LocalAsset[]> {
  const probed: LocalAsset[] = [];
  for (const asset of assets) {
    if (asset.media !== 'video' && asset.media !== 'wav' && asset.media !== 'audio') {
      probed.push(asset);
      continue;
    }
    try {
      const text = await runCapture(
        binary,
        ['-hide_banner', '-i', asset.path, '-f', 'null', '-'],
        remainingMs(deadlineAt, RENDER_LIMITS.probeMs),
        signal,
      ).catch((error) => (error instanceof Error ? error.message : ''));
      const duration = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!duration) {
        probed.push(asset);
        continue;
      }
      const ms =
        (Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])) * 1000;
      probed.push({ ...asset, durationMs: Math.round(ms) });
    } catch {
      probed.push(asset);
    }
  }
  return probed;
}
