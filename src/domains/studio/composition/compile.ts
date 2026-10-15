import { compositionFrame, type CompositionDocument, type CompositionScene } from './model';
import {
  COMPOSITION_FPS,
  compositionPlaybackMs,
  sceneDissolveMs,
  sceneFrames,
  scenePlaybackStartMs,
} from './timing';

export type MediaKind = 'image' | 'video' | 'audio' | 'wav';
export type LocalAsset = {
  id: string;
  kind: 'version' | 'reference' | 'footage' | 'narration' | 'music';
  path: string;
  media: MediaKind;
  durationMs?: number;
  width?: number;
  height?: number;
};

export type RenderPlan = {
  args: string[];
  durationMs: number;
  width: number;
  height: number;
  fps: typeof COMPOSITION_FPS;
  filter: string;
};

const SAFE_PATH = /^\/[A-Za-z0-9/_.-]+$/;

export function assertSafePath(file: string) {
  if (!SAFE_PATH.test(file) || file.includes('..'))
    throw new Error('Renderer paths must stay inside the trusted workspace.');
  return file;
}

function n(value: number) {
  if (!Number.isFinite(value)) throw new Error('Invalid render number.');
  return String(value);
}

function filterPath(file: string) {
  assertSafePath(file);
  return file.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function cropPlace(scene: CompositionScene, frame: { width: number; height: number }) {
  const placeW = Math.max(2, Math.round(frame.width * scene.placement.width) & ~1);
  const placeH = Math.max(2, Math.round(frame.height * scene.placement.height) & ~1);
  const placeX = Math.max(0, Math.round(frame.width * scene.placement.x) & ~1);
  const placeY = Math.max(0, Math.round(frame.height * scene.placement.y) & ~1);
  return {
    crop: `crop=iw*${n(scene.crop.width)}:ih*${n(scene.crop.height)}:iw*${n(scene.crop.x)}:ih*${n(scene.crop.y)}`,
    scale: `scale=${placeW}:${placeH}:flags=lanczos`,
    pad: `pad=${frame.width}:${frame.height}:${placeX}:${placeY}:black`,
  };
}

export function compileRender(
  document: CompositionDocument,
  assets: LocalAsset[],
  output: { film: string; cover: string; captions?: string },
): RenderPlan {
  const frame = compositionFrame(document.aspect);
  const durationMs = compositionPlaybackMs(document);
  const lookup = new Map(assets.map((asset) => [`${asset.kind}:${asset.id}`, asset]));
  const inputs: string[] = [];
  const filters: string[] = [];
  document.scenes.forEach((scene, index) => {
    const asset = lookup.get(`${scene.assetKind}:${scene.assetId}`);
    if (!asset) throw new Error(`Composition is missing owned media for scene ${scene.name}.`);
    assertSafePath(asset.path);
    const next = document.scenes[index + 1];
    const extra = next ? sceneDissolveMs(next, index + 1) : 0;
    const generateMs = scene.durationMs + extra;
    const seconds = generateMs / 1000;
    const frames = sceneFrames(generateMs) + (extra ? 1 : 0);
    if (scene.kind === 'video' && asset.durationMs != null) {
      if (scene.outMs > asset.durationMs + 20)
        throw new Error(
          `Scene “${scene.name}” out point ${scene.outMs}ms is past the owned clip (${asset.durationMs}ms).`,
        );
    }
    const layout = cropPlace(scene, frame);
    if (scene.kind === 'image') {
      inputs.push('-framerate', String(COMPOSITION_FPS), '-i', asset.path);
      if (scene.stillMotion === 'slow-zoom') {
        filters.push(
          `[${index}:v]${layout.crop},${layout.scale},zoompan=z='min(zoom+0.0012,1.08)':d=${frames}:s=${frame.width}x${frame.height}:fps=${COMPOSITION_FPS},setsar=1,trim=end_frame=${frames},setpts=PTS-STARTPTS[v${index}]`,
        );
      } else {
        filters.push(
          `[${index}:v]${layout.crop},${layout.scale},${layout.pad},fps=${COMPOSITION_FPS},tpad=stop_mode=clone:stop_duration=${n(seconds)},trim=duration=${n(seconds)},setpts=PTS-STARTPTS[v${index}]`,
        );
      }
    } else {
      inputs.push('-ss', n(scene.inMs / 1000), '-t', n((scene.outMs - scene.inMs) / 1000), '-i', asset.path);
      filters.push(
        `[${index}:v]${layout.crop},${layout.scale},${layout.pad},fps=${COMPOSITION_FPS},trim=duration=${n(seconds)},setpts=PTS-STARTPTS[v${index}]`,
      );
    }
  });
  let video = '[v0]';
  if (document.scenes.length === 1) {
    filters.push('[v0]copy[vout]');
    video = '[vout]';
  } else {
    let last = 'v0';
    for (let index = 1; index < document.scenes.length; index++) {
      const scene = document.scenes[index]!;
      const label = `vx${index}`;
      const fade = sceneDissolveMs(scene, index) / 1000;
      const offset = scenePlaybackStartMs(document, index) / 1000;
      if (fade > 0) {
        filters.push(
          `[${last}][v${index}]xfade=transition=fade:duration=${n(fade)}:offset=${n(Math.max(0, offset))}[${label}]`,
        );
      } else {
        filters.push(`[${last}][v${index}]concat=n=2:v=1:a=0[${label}]`);
      }
      last = label;
    }
    video = `[${last}]`;
  }
  const overlay = [...document.titles, ...document.captions];
  if (overlay.length && output.captions) {
    assertSafePath(output.captions);
    filters.push(`${video}subtitles=${filterPath(output.captions)}[vsub]`);
    video = '[vsub]';
  }
  let audioIndex = document.scenes.length;
  const audioMix: string[] = [];
  if (document.narration) {
    const narration = lookup.get(`narration:${document.narration.assetId}`);
    if (!narration) throw new Error('Narration track is missing from owned storage.');
    assertSafePath(narration.path);
    inputs.push('-i', narration.path);
    const fadeIn = document.narration.fadeInMs / 1000;
    const fadeOut = document.narration.fadeOutMs / 1000;
    const delay = Math.max(0, durationMs / 1000 - fadeOut);
    filters.push(
      `[${audioIndex}:a]volume=${n(dbToRatio(document.narration.gainDb))},afade=t=in:st=0:d=${n(fadeIn)},afade=t=out:st=${n(delay)}:d=${n(fadeOut)},atrim=duration=${n(durationMs / 1000)}[na]`,
    );
    audioMix.push('[na]');
    audioIndex += 1;
  }
  if (document.music) {
    const music = lookup.get(`music:${document.music.assetId}`);
    if (!music) throw new Error('Music track is missing from owned storage.');
    assertSafePath(music.path);
    inputs.push('-i', music.path);
    const fadeIn = document.music.fadeInMs / 1000;
    const fadeOut = document.music.fadeOutMs / 1000;
    const delay = Math.max(0, durationMs / 1000 - fadeOut);
    filters.push(
      `[${audioIndex}:a]volume=${n(dbToRatio(document.music.gainDb))},afade=t=in:st=0:d=${n(fadeIn)},afade=t=out:st=${n(delay)}:d=${n(fadeOut)},atrim=duration=${n(durationMs / 1000)}[mu]`,
    );
    audioMix.push('[mu]');
  }
  let audioMap = ['-an'];
  if (audioMix.length === 1) {
    filters.push(`${audioMix[0]}anull[aout]`);
    audioMap = ['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'];
  } else if (audioMix.length === 2) {
    filters.push(`${audioMix[0]}${audioMix[1]}amix=inputs=2:duration=longest:dropout_transition=0[aout]`);
    audioMap = ['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'];
  }
  assertSafePath(output.film);
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    video,
    ...audioMap,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(COMPOSITION_FPS),
    '-t',
    n(durationMs / 1000),
    '-movflags',
    '+faststart',
    output.film,
  ];
  return {
    args,
    durationMs,
    width: frame.width,
    height: frame.height,
    fps: COMPOSITION_FPS,
    filter: filters.join(';'),
  };
}

function dbToRatio(db: number) {
  return Math.round(10 ** (db / 20) * 1000) / 1000;
}

export function compileCoverArgs(film: string, cover: string) {
  assertSafePath(film);
  assertSafePath(cover);
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    film,
    '-frames:v',
    '1',
    '-update',
    '1',
    cover,
  ];
}
