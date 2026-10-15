import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';
import { convertDocumentUnits, emptyDocument, parseDesignDocument } from '../src/domains/studio/design/document';
import { compositionPlaybackMs } from '../src/domains/studio/composition/timing';
import { parseComposition } from '../src/domains/studio/composition/model';
import { exportSvg } from '../src/domains/studio/design/svg-export';
import { exportPdf } from '../src/domains/studio/design/pdf-export';
import { exportPng, inspectPng } from '../src/domains/studio/design/png-export';
import { pagePoints, toPixels } from '../src/domains/studio/design/units';
import { emptyComposition } from '../src/domains/studio/composition/model';
import { compileRender } from '../src/domains/studio/composition/compile';
import { renderComposition } from '../src/domains/studio/render/ffmpeg';
import { inspectRenderedMp4 } from '../src/domains/studio/render/verify';

const out = process.env.STUDIO_EVIDENCE_DIR || '/opt/cursor/artifacts/studio-exports';

describe('Studio export evidence', () => {
  it('writes inspected PNG, SVG, vector PDF and H.264 film artifacts', async () => {
    await mkdir(out, { recursive: true });
    const id = '10000000-0000-4000-8000-000000000001';
    const document = parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'ISO ID-1 proof',
        width: 85.6,
        height: 53.98,
        unit: 'mm',
        dimensionSource: 'verified',
        dimensionNote: 'ISO/IEC 7810 ID-1',
        ppi: 300,
      }),
      layers: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          type: 'rect',
          name: 'Plate',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: 4,
          y: 4,
          width: 77,
          height: 45,
          rotation: 0,
          fill: '#0B3B32',
          stroke: '#C4912F',
          strokeWidth: 0.6,
          cornerRadius: 2,
        },
        {
          id: '20000000-0000-4000-8000-000000000001',
          type: 'text',
          name: 'Headline',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: 8,
          y: 16,
          width: 70,
          height: 18,
          rotation: 0,
          content: 'Aethelios Studio',
          fontId: 'inter',
          fontSize: 18,
          fontWeight: 600,
          align: 'left',
          letterSpacing: 0,
          lineHeight: 1.2,
          fill: '#C4912F',
        },
      ],
    });
    const svg = await exportSvg(document, [], 'embed');
    const pdf = await exportPdf(document, []);
    const png = await exportPng(document, []);
    await writeFile(path.join(out, 'label-id1.svg'), svg);
    await writeFile(path.join(out, 'label-id1.pdf'), pdf);
    await writeFile(path.join(out, 'label-id1.png'), png);
    const loaded = await PDFDocument.load(pdf);
    const size = loaded.getPages()[0]!.getSize();
    const expected = pagePoints(document.page);
    expect(size.width).toBeCloseTo(expected.width, 2);
    expect(size.height).toBeCloseTo(expected.height, 2);
    expect(inspectPng(png)).toEqual({
      width: toPixels(document.page.width, 'mm', 300),
      height: toPixels(document.page.height, 'mm', 300),
    });
    const dir = await mkdtemp(path.join(tmpdir(), 'studio-evidence-'));
    try {
      const stillPng = new PNG({ width: 320, height: 180, fill: true });
      for (let i = 0; i < stillPng.data.length; i += 4) {
        stillPng.data[i] = 11;
        stillPng.data[i + 1] = 59;
        stillPng.data[i + 2] = 50;
        stillPng.data[i + 3] = 255;
      }
      const still = path.join(dir, 'still.png');
      await writeFile(still, PNG.sync.write(stillPng));
      const assetId = '40000000-0000-4000-8000-000000000002';
      const film = emptyComposition({
        id: '40000000-0000-4000-8000-000000000005',
        title: 'Local film',
        aspect: 'landscape',
        scene: {
          id: '40000000-0000-4000-8000-000000000001',
          kind: 'image',
          assetId,
          assetKind: 'version',
          name: 'Opening',
          inMs: 0,
          outMs: 2000,
          durationMs: 2000,
          crop: { x: 0, y: 0, width: 1, height: 1 },
          placement: { x: 0, y: 0, width: 1, height: 1 },
          transition: 'cut',
          stillMotion: 'none',
        },
      });
      film.captions = [
        { id: '40000000-0000-4000-8000-000000000006', startMs: 200, endMs: 1600, text: 'Studio film' },
      ];
      const rendered = await renderComposition(film, [
        { id: assetId, kind: 'version', path: still, media: 'image' },
      ]);
      await writeFile(path.join(out, 'film-landscape.mp4'), rendered.film);
      await writeFile(path.join(out, 'film-cover.png'), rendered.cover);
      await writeFile(path.join(out, 'film-captions.vtt'), rendered.captions);
      inspectRenderedMp4(rendered.film, { seconds: 2, width: 1920, height: 1080 });
      await writeFile(
        path.join(out, 'inspection.json'),
        JSON.stringify(
          {
            png: inspectPng(png),
            pdfPagePoints: size,
            pdfExpectedPoints: expected,
            film: {
              width: rendered.width,
              height: rendered.height,
              durationMs: rendered.durationMs,
              ffmpeg: rendered.ffmpeg,
            },
          },
          null,
          2,
        ),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('exports a physical label with type, SVG mark and rotation, and a 32s mixed still film', async () => {
    await mkdir(out, { recursive: true });
    const id = '10000000-0000-4000-8000-000000000031';
    const document = parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'ISO ID-1 completion label',
        width: 85.6,
        height: 53.98,
        unit: 'mm',
        dimensionSource: 'verified',
        dimensionNote: 'ISO/IEC 7810 ID-1',
        ppi: 300,
      }),
      layers: [
        {
          id: '30000000-0000-4000-8000-000000000039',
          type: 'group',
          name: 'Masthead',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: 4,
          y: 4,
          width: 77,
          height: 24,
          rotation: 0,
        },
        {
          id: '30000000-0000-4000-8000-000000000031',
          type: 'rect',
          name: 'Plate',
          parentId: '30000000-0000-4000-8000-000000000039',
          visible: true,
          locked: false,
          opacity: 1,
          x: 4,
          y: 4,
          width: 77,
          height: 45,
          rotation: 0,
          fill: '#0B3B32',
          stroke: '#C4912F',
          strokeWidth: 0.6,
          cornerRadius: 3,
        },
        {
          id: '20000000-0000-4000-8000-000000000031',
          type: 'text',
          name: 'Headline',
          parentId: '30000000-0000-4000-8000-000000000039',
          visible: true,
          locked: false,
          opacity: 1,
          x: 10,
          y: 12,
          width: 52,
          height: 16,
          rotation: 0,
          content: 'Aethelios Studio',
          fontId: 'inter',
          fontSize: 18,
          fontWeight: 600,
          align: 'left',
          letterSpacing: 0.4,
          lineHeight: 1.15,
          fill: '#C4912F',
        },
        {
          id: '20000000-0000-4000-8000-000000000032',
          type: 'svg',
          name: 'Mark',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: 64,
          y: 10,
          width: 12,
          height: 12,
          rotation: 12,
          markup:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#C4912F"/></svg>',
        },
        {
          id: '20000000-0000-4000-8000-000000000033',
          type: 'image',
          name: 'Seal',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: 10,
          y: 32,
          width: 18,
          height: 12,
          rotation: -8,
          assetId: '40000000-0000-4000-8000-000000000070',
          assetKind: 'version',
          crop: { x: 0.15, y: 0.1, width: 0.7, height: 0.8 },
        },
      ],
    });
    const seal = new PNG({ width: 80, height: 80, fill: true });
    for (let i = 0; i < seal.data.length; i += 4) {
      seal.data[i] = 196;
      seal.data[i + 1] = 145;
      seal.data[i + 2] = 47;
      seal.data[i + 3] = 255;
    }
    const assets = [
      {
        id: '40000000-0000-4000-8000-000000000070',
        kind: 'version' as const,
        bytes: new Uint8Array(PNG.sync.write(seal)),
        mediaType: 'image/png' as const,
        widthPx: 80,
        heightPx: 80,
      },
    ];
    const inches = convertDocumentUnits(document, 'in');
    expect(inches.page.width).toBeCloseTo(85.6 / 25.4, 3);
    const svg = await exportSvg(document, assets, 'outline');
    const pdf = await exportPdf(document, assets);
    const png = await exportPng(document, assets);
    await writeFile(path.join(out, 'label-complete.svg'), svg);
    await writeFile(path.join(out, 'label-complete.pdf'), pdf);
    await writeFile(path.join(out, 'label-complete.png'), png);
    expect(new TextDecoder().decode(svg)).toMatch(/width="[0-9.]+in"/);
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPages()[0]!.getSize().width).toBeCloseTo(pagePoints(document.page).width, 2);
    expect(inspectPng(png)).toEqual({
      width: toPixels(document.page.width, 'mm', 300),
      height: toPixels(document.page.height, 'mm', 300),
    });
    const dir = await mkdtemp(path.join(tmpdir(), 'studio-complete-film-'));
    try {
      const still = async (r: number, g: number, b: number, name: string) => {
        const image = new PNG({ width: 640, height: 360, fill: true });
        for (let i = 0; i < image.data.length; i += 4) {
          image.data[i] = r;
          image.data[i + 1] = g;
          image.data[i + 2] = b;
          image.data[i + 3] = 255;
        }
        const file = path.join(dir, name);
        await writeFile(file, PNG.sync.write(image));
        return file;
      };
      const files = [
        await still(180, 24, 24, 'red.png'),
        await still(11, 59, 50, 'green.png'),
        await still(196, 145, 47, 'gold.png'),
        await still(12, 28, 64, 'navy.png'),
      ];
      const assets = files.map((file, index) => ({
        id: `40000000-0000-4000-8000-00000000005${index}`,
        kind: 'version' as const,
        path: file,
        media: 'image' as const,
      }));
      const film = parseComposition({
        schema: 'studio-composition/v1',
        id: '40000000-0000-4000-8000-000000000060',
        title: 'Thirty-two second studio film',
        aspect: 'landscape',
        fps: 24,
        scenes: assets.map((asset, index) => ({
          id: `40000000-0000-4000-8000-00000000004${index}`,
          kind: 'image',
          assetId: asset.id,
          assetKind: 'version',
          name: `Scene ${index + 1}`,
          inMs: 0,
          outMs: 8000,
          durationMs: 8000,
          crop: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
          placement: { x: 0, y: 0, width: 1, height: 1 },
          transition: index === 0 ? 'cut' : 'dissolve',
          stillMotion: index % 2 === 0 ? 'slow-zoom' : 'none',
        })),
        titles: [
          {
            id: '40000000-0000-4000-8000-000000000061',
            startMs: 400,
            endMs: 3200,
            text: 'Aethelios Studio',
            fontId: 'inter',
          },
        ],
        captions: [
          {
            id: '40000000-0000-4000-8000-000000000062',
            startMs: 4000,
            endMs: 9000,
            text: 'Owned stills, crop and dissolves',
          },
        ],
        narration: {
          assetId: '40000000-0000-4000-8000-000000000071',
          assetKind: 'narration',
          gainDb: -2,
          fadeInMs: 200,
          fadeOutMs: 400,
        },
        music: {
          assetId: '40000000-0000-4000-8000-000000000072',
          assetKind: 'music',
          gainDb: -8,
          fadeInMs: 400,
          fadeOutMs: 800,
        },
      });
      const tone = (file: string, frequency: number, seconds: number) =>
        new Promise<void>((resolve, reject) => {
          const child = spawn('ffmpeg', [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=${frequency}:duration=${seconds}`,
            '-ac',
            '1',
            '-ar',
            '48000',
            file,
          ]);
          child.on('error', reject);
          child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg tone failed (${code})`))));
        });
      const narration = path.join(dir, 'narration.wav');
      const music = path.join(dir, 'music.wav');
      await tone(narration, 440, 8);
      await tone(music, 220, 32);
      const media = [
        ...assets,
        { id: '40000000-0000-4000-8000-000000000071', kind: 'narration' as const, path: narration, media: 'wav' as const },
        { id: '40000000-0000-4000-8000-000000000072', kind: 'music' as const, path: music, media: 'wav' as const },
      ];
      const plan = compileRender(film, media, {
        film: '/tmp/studio-complete-film.mp4',
        cover: '/tmp/studio-complete-cover.png',
        captions: '/tmp/studio-complete.vtt',
      });
      expect(plan.durationMs).toBeGreaterThan(28_000);
      expect(plan.filter).toContain('xfade=');
      expect(plan.filter.match(/xfade=/g)?.length).toBe(3);
      expect(plan.filter).toMatch(/offset=7\.75/);
      expect(plan.filter).toContain('amix=');
      const rendered = await renderComposition(film, media);
      await writeFile(path.join(out, 'film-complete.mp4'), rendered.film);
      await writeFile(path.join(out, 'film-complete-cover.png'), rendered.cover);
      await writeFile(path.join(out, 'film-complete.vtt'), rendered.captions);
      inspectRenderedMp4(rendered.film, {
        seconds: compositionPlaybackMs(film) / 1000,
        width: 1920,
        height: 1080,
        audio: true,
      });
      expect(rendered.durationMs).toBeGreaterThan(28_000);
      expect(rendered.durationMs).toBeLessThan(33_000);
      await writeFile(
        path.join(out, 'completion-inspection.json'),
        JSON.stringify(
          {
            png: inspectPng(png),
            convertedInchesWidth: inches.page.width,
            film: { width: rendered.width, height: rendered.height, durationMs: rendered.durationMs, ffmpeg: rendered.ffmpeg },
          },
          null,
          2,
        ),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 120000);
});
