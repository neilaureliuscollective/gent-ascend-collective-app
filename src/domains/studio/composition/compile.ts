import { compositionDuration, compositionFrame, type CompositionDocument } from './model';

export type MediaKind = 'image' | 'video' | 'audio' | 'wav';
export type LocalAsset = {
  id: string;
  kind: 'version' | 'reference' | 'footage' | 'narration' | 'music';
  path: string;
  media: MediaKind;
};

export type RenderPlan = {
  args: string[];
  durationMs: number;
  width: number;
  height: number;
  fps: 24;
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

export function compileRender(
  document: CompositionDocument,
  assets: LocalAsset[],
  output: { film: string; cover: string },
): RenderPlan {
  const frame = compositionFrame(document.aspect);
  const durationMs = compositionDuration(document);
  const lookup = new Map(assets.map((asset) => [`${asset.kind}:${asset.id}`, asset]));
  const inputs: string[] = [];
  const filters: string[] = [];
  document.scenes.forEach((scene, index) => {
    const asset = lookup.get(`${scene.assetKind}:${scene.assetId}`);
    if (!asset) throw new Error(`Composition is missing owned media for scene ${scene.name}.`);
    assertSafePath(asset.path);
    const seconds = scene.durationMs / 1000;
    if (scene.kind === 'image') {
      inputs.push('-loop', '1', '-t', n(seconds), '-i', asset.path);
      const zoom =
        scene.stillMotion === 'slow-zoom'
          ? `,zoompan=z='min(zoom+0.0008,1.08)':d=${Math.round((scene.durationMs / 1000) * 24)}:s=${frame.width}x${frame.height}:fps=24`
          : `,fps=24,trim=duration=${n(seconds)},setpts=PTS-STARTPTS`;
      filters.push(
        `[${index}:v]scale=${frame.width}:${frame.height}:force_original_aspect_ratio=increase,crop=${frame.width}:${frame.height}${zoom}[v${index}]`,
      );
    } else {
      inputs.push('-ss', n(scene.inMs / 1000), '-t', n((scene.outMs - scene.inMs) / 1000), '-i', asset.path);
      filters.push(
        `[${index}:v]trim=duration=${n(seconds)},setpts=PTS-STARTPTS,scale=${frame.width}:${frame.height}:force_original_aspect_ratio=increase,crop=${frame.width}:${frame.height},fps=24[v${index}]`,
      );
    }
  });
  let video = '[v0]';
  if (document.scenes.length === 1) {
    filters.push('[v0]copy[vout]');
    video = '[vout]';
  } else {
    let last = 'v0';
    let offset = document.scenes[0]!.durationMs / 1000;
    for (let index = 1; index < document.scenes.length; index++) {
      const scene = document.scenes[index]!;
      const label = `vx${index}`;
      if (scene.transition === 'dissolve') {
        const fade = 0.25;
        filters.push(
          `[${last}][v${index}]xfade=transition=fade:duration=${n(fade)}:offset=${n(Math.max(0, offset - fade))}[${label}]`,
        );
      } else {
        filters.push(`[${last}][v${index}]concat=n=2:v=1:a=0[${label}]`);
      }
      last = label;
      offset += scene.durationMs / 1000;
    }
    video = `[${last}]`;
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
      `[${audioIndex}:a]volume=${n(dbToRatio(document.narration.gainDb))},afade=t=in:st=0:d=${n(fadeIn)},afade=t=out:st=${n(delay)}:d=${n(fadeOut)}[na]`,
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
      `[${audioIndex}:a]volume=${n(dbToRatio(document.music.gainDb))},afade=t=in:st=0:d=${n(fadeIn)},afade=t=out:st=${n(delay)}:d=${n(fadeOut)}[mu]`,
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
    video === '[vout]' ? '[vout]' : video,
    ...audioMap,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '24',
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
    fps: 24,
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
