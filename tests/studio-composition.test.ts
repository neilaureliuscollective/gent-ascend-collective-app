import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import {
  emptyComposition,
  parseComposition,
  compositionDuration,
  type CompositionScene,
} from '../src/domains/studio/composition/model';
import { compileRender } from '../src/domains/studio/composition/compile';
import { compositionVtt } from '../src/domains/studio/composition/captions';
import { renderComposition } from '../src/domains/studio/render/ffmpeg';
import { inspectRenderedMp4 } from '../src/domains/studio/render/verify';

const sceneId = '40000000-0000-4000-8000-000000000001';
const assetId = '40000000-0000-4000-8000-000000000002';

function scene(overrides: Partial<CompositionScene> = {}): CompositionScene {
  return {
    id: sceneId,
    kind: 'image',
    assetId,
    assetKind: 'version',
    name: 'Opening',
    inMs: 0,
    outMs: 3000,
    durationMs: 3000,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    placement: { x: 0, y: 0, width: 1, height: 1 },
    transition: 'cut',
    stillMotion: 'none',
    ...overrides,
  };
}

describe('Studio compositions', () => {
  it('rejects films longer than 60 seconds and unstable IDs', () => {
    expect(() =>
      parseComposition({
        schema: 'studio-composition/v1',
        id: '40000000-0000-4000-8000-000000000003',
        title: 'Overlong',
        aspect: 'landscape',
        fps: 24,
        scenes: [scene({ durationMs: 61_000 })],
        titles: [],
        captions: [],
        narration: null,
        music: null,
      }),
    ).toThrow();
  });

  it('compiles trusted FFmpeg arguments without interpolating caption text into filters', () => {
    const document = emptyComposition({
      id: '40000000-0000-4000-8000-000000000003',
      title: 'Pilot',
      aspect: 'landscape',
      scene: scene(),
    });
    document.captions = [
      {
        id: '40000000-0000-4000-8000-000000000004',
        startMs: 200,
        endMs: 1800,
        text: ';rm -rf /; [0:v]hue',
      },
    ];
    const plan = compileRender(
      document,
      [{ id: assetId, kind: 'version', path: '/tmp/studio-asset.png', media: 'image' }],
      { film: '/tmp/studio-film.mp4', cover: '/tmp/studio-cover.png' },
    );
    expect(plan.filter).not.toContain('rm -rf');
    expect(plan.filter).not.toContain('hue');
    expect(plan.args).toContain('libx264');
    expect(plan.args).not.toContain('-loop');
    expect(compositionVtt(document)).toContain(';rm -rf /; [0:v]hue');
  });

  it('keeps two still scenes on the intended clock and applies crop before zoompan', () => {
    const second = '40000000-0000-4000-8000-000000000012';
    const document = parseComposition({
      schema: 'studio-composition/v1',
      id: '40000000-0000-4000-8000-000000000013',
      title: 'Two scenes',
      aspect: 'landscape',
      fps: 24,
      scenes: [
        scene({ durationMs: 1000, outMs: 1000, stillMotion: 'slow-zoom' }),
        scene({
          id: '40000000-0000-4000-8000-000000000014',
          assetId: second,
          name: 'Second',
          durationMs: 1000,
          outMs: 1000,
          crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          placement: { x: 0, y: 0, width: 1, height: 1 },
          transition: 'cut',
        }),
      ],
      titles: [{ id: '40000000-0000-4000-8000-000000000015', startMs: 0, endMs: 800, text: 'Title card', fontId: 'inter' }],
      captions: [],
      narration: null,
      music: null,
    });
    const plan = compileRender(
      document,
      [
        { id: assetId, kind: 'version', path: '/tmp/studio-red.png', media: 'image' },
        { id: second, kind: 'version', path: '/tmp/studio-blue.png', media: 'image' },
      ],
      { film: '/tmp/studio-film.mp4', cover: '/tmp/studio-cover.png', captions: '/tmp/studio-captions.vtt' },
    );
    expect(plan.durationMs).toBe(2000);
    expect(plan.filter).toContain('zoompan=');
    expect(plan.filter).toContain('d=24');
    expect(plan.filter.match(/zoompan/g)?.length).toBe(1);
    expect(plan.filter).toContain('crop=iw*0.8:ih*0.8:iw*0.1:ih*0.1');
    expect(plan.filter).toContain('subtitles=/tmp/studio-captions.vtt');
    expect(plan.filter).toContain('concat=');
    expect(plan.args.join(' ')).not.toMatch(/-loop 1 -t /);
  });

  it('renders a real H.264 MP4 from owned stills without a generation job', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'studio-film-'));
    try {
      const png = new PNG({ width: 320, height: 180, fill: true });
      for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 11;
        png.data[i + 1] = 59;
        png.data[i + 2] = 50;
        png.data[i + 3] = 255;
      }
      const still = path.join(dir, 'still.png');
      await writeFile(still, PNG.sync.write(png));
      const document = emptyComposition({
        id: '40000000-0000-4000-8000-000000000005',
        title: 'Local film',
        aspect: 'landscape',
        scene: scene({ durationMs: 2000, outMs: 2000 }),
      });
      document.captions = [
        {
          id: '40000000-0000-4000-8000-000000000006',
          startMs: 200,
          endMs: 1600,
          text: 'Studio film',
        },
      ];
      const rendered = await renderComposition(document, [
        { id: assetId, kind: 'version', path: still, media: 'image' },
      ]);
      expect(rendered.width).toBe(1920);
      expect(rendered.height).toBe(1080);
      inspectRenderedMp4(rendered.film, { seconds: 2, width: 1920, height: 1080 });
      expect(compositionDuration(document)).toBe(2000);
      expect(rendered.ffmpeg.configuration).toContain('libx264');
      expect(new TextDecoder().decode(rendered.captions)).toContain('Studio film');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('renders two still scenes without expanding the first zoompan across the whole film', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'studio-two-'));
    try {
      const still = async (r: number, g: number, b: number, name: string) => {
        const png = new PNG({ width: 320, height: 180, fill: true });
        for (let i = 0; i < png.data.length; i += 4) {
          png.data[i] = r;
          png.data[i + 1] = g;
          png.data[i + 2] = b;
          png.data[i + 3] = 255;
        }
        const file = path.join(dir, name);
        await writeFile(file, PNG.sync.write(png));
        return file;
      };
      const red = await still(200, 20, 20, 'red.png');
      const blue = await still(20, 40, 200, 'blue.png');
      const redId = '40000000-0000-4000-8000-000000000021';
      const blueId = '40000000-0000-4000-8000-000000000022';
      const document = parseComposition({
        schema: 'studio-composition/v1',
        id: '40000000-0000-4000-8000-000000000023',
        title: 'Red to blue',
        aspect: 'landscape',
        fps: 24,
        scenes: [
          scene({
            assetId: redId,
            durationMs: 1000,
            outMs: 1000,
            stillMotion: 'slow-zoom',
          }),
          scene({
            id: '40000000-0000-4000-8000-000000000024',
            assetId: blueId,
            name: 'Blue',
            durationMs: 1000,
            outMs: 1000,
            transition: 'cut',
          }),
        ],
        titles: [],
        captions: [{ id: '40000000-0000-4000-8000-000000000025', startMs: 200, endMs: 800, text: 'First scene' }],
        narration: null,
        music: null,
      });
      const rendered = await renderComposition(document, [
        { id: redId, kind: 'version', path: red, media: 'image' },
        { id: blueId, kind: 'version', path: blue, media: 'image' },
      ]);
      inspectRenderedMp4(rendered.film, { seconds: 2, width: 1920, height: 1080 });
      expect(rendered.durationMs).toBe(2000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60000);
});
