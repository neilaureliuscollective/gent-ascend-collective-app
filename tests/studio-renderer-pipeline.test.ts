import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PNG } from 'pngjs';
import { emptyDocument, parseDesignDocument, type DesignLayer } from '../src/domains/studio/design/document';
import { loadDesignFont, wrapText } from '../src/domains/studio/design/measure';
import { exportPng } from '../src/domains/studio/design/png-export';
import { exportSvg } from '../src/domains/studio/design/svg-export';
import { exportPdf } from '../src/domains/studio/design/pdf-export';
import { fabricBoxFromLayer, layerBoxFromFabricCenter, layerWorldCorners } from '../src/domains/studio/design/geometry';
import { coverAfterCropSourceRect, cropPreviewStyle, cropViewBox } from '../src/domains/studio/composition/crop';
import { AMIX_FILTER, MIX_POLICY, dbToRatio } from '../src/domains/studio/composition/audio';
import { compileRender } from '../src/domains/studio/composition/compile';
import { parseComposition } from '../src/domains/studio/composition/model';
import { renderComposition } from '../src/domains/studio/render/ffmpeg';
import { proveFontRaster, rendererPreflight } from '../src/domains/studio/render/preflight';
import { classifyHealth } from '../src/domains/studio/render/health';
import { TempBudget } from '../src/domains/studio/render/limits';
import { designExportNeedsFfmpeg } from '../src/domains/studio/render/design-job';
import { designFontFaceList } from '../src/domains/studio/design/fonts';
import { PDFDocument } from 'pdf-lib';

const out = path.join(process.cwd(), 'docs/evidence/studio-renderer-pipeline');

function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code})`))));
  });
}

function text(overrides: Partial<Extract<DesignLayer, { type: 'text' }>> = {}) {
  return {
    id: '20000000-0000-4000-8000-000000000101',
    type: 'text' as const,
    name: 'Type',
    parentId: null,
    visible: true,
    locked: false,
    opacity: 1,
    x: 4,
    y: 4,
    width: 70,
    height: 18,
    rotation: 0,
    content: 'Aethelios',
    fontId: 'inter' as const,
    fontSize: 22,
    fontWeight: 400 as const,
    align: 'left' as const,
    letterSpacing: 0,
    lineHeight: 1.2,
    fill: '#C4912F',
    ...overrides,
  };
}

function goldBounds(png: PNG) {
  let minX = png.width;
  let maxX = 0;
  let minY = png.height;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i]! < 140 || png.data[i + 1]! < 90 || png.data[i + 2]! > 90) continue;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY), count };
}

describe('Studio static font faces', () => {
  it('loads distinct bundled instances and wraps from real advances', async () => {
    const regular = await loadDesignFont('inter', 400);
    const semibold = await loadDesignFont('inter', 600);
    const bold = await loadDesignFont('inter', 700);
    const soraBold = await loadDesignFont('sora', 700);
    const advance = (font: typeof regular, glyph: string) => font.layout(glyph).glyphs[0]!.advanceWidth;
    expect(advance(regular, 'A')).toBe(1413);
    expect(advance(semibold, 'A')).toBe(1490);
    expect(advance(bold, 'A')).toBe(1529);
    expect(advance(regular, 'i')).toBe(496);
    expect(advance(bold, 'i')).toBe(555);
    expect(advance(bold, 'W')).toBeGreaterThan(advance(bold, 'i') * 3);
    expect(advance(soraBold, 'A')).not.toBe(advance(bold, 'A'));
    const layer = text({
      content: 'Aethelios Studio Reserve',
      width: 18,
      fontWeight: 700,
      fontSize: 16,
    });
    const wrapped = wrapText(layer, bold, 18 / 25.4);
    expect(wrapped.lines.length).toBeGreaterThan(2);
    const wide = wrapText(text({ content: 'Hi', width: 80, fontWeight: 400 }), regular, 80 / 25.4);
    expect(wide.lines).toEqual(['Hi']);
    await expect(loadDesignFont('dejavu', 700)).rejects.toThrow(/real 700 instance/);
  });

  it('renders requested weights, wrapping and alignment into inspected PNG files', async () => {
    await mkdir(out, { recursive: true });
    const page = emptyDocument({
      id: '10000000-0000-4000-8000-000000000101',
      title: 'Face proof',
      width: 90,
      height: 28,
      unit: 'mm',
      dimensionSource: 'supplied',
      ppi: 300,
    });
    const make = (weight: 400 | 700, content: string, align: 'left' | 'center' | 'right' = 'left') =>
      parseDesignDocument({
        ...page,
        layers: [text({ content, fontWeight: weight, align, width: 82, height: 20, x: 4, y: 4, fontSize: 28 })],
      });
    const regular = await exportPng(make(400, 'iiiii'), []);
    const bold = await exportPng(make(700, 'iiiii'), []);
    const wide = await exportPng(make(700, 'WWWWW'), []);
    const centered = await exportPng(make(700, 'A', 'center'), []);
    const right = await exportPng(make(700, 'A', 'right'), []);
    await writeFile(path.join(out, 'inter-400-iiiii.png'), regular);
    await writeFile(path.join(out, 'inter-700-iiiii.png'), bold);
    await writeFile(path.join(out, 'inter-700-WWWWW.png'), wide);
    await writeFile(path.join(out, 'inter-700-A-center.png'), centered);
    await writeFile(path.join(out, 'inter-700-A-right.png'), right);
    const rInk = goldBounds(PNG.sync.read(Buffer.from(regular)));
    const bInk = goldBounds(PNG.sync.read(Buffer.from(bold)));
    const wInk = goldBounds(PNG.sync.read(Buffer.from(wide)));
    const cInk = goldBounds(PNG.sync.read(Buffer.from(centered)));
    const rightInk = goldBounds(PNG.sync.read(Buffer.from(right)));
    expect(bInk.width).toBeGreaterThan(rInk.width);
    expect(wInk.width).toBeGreaterThan(bInk.width + 80);
    expect(cInk.minX).toBeGreaterThan(rInk.minX + 40);
    expect(rightInk.minX).toBeGreaterThan(cInk.minX + 40);
    const wrapped = await exportPng(
      parseDesignDocument({
        ...page,
        layers: [text({ content: 'Aethelios Studio Reserve Gold', fontWeight: 700, width: 22, height: 22, fontSize: 14 })],
      }),
      [],
    );
    await writeFile(path.join(out, 'inter-700-wrapped.png'), wrapped);
    const wrapInk = goldBounds(PNG.sync.read(Buffer.from(wrapped)));
    expect(wrapInk.height).toBeGreaterThan(bInk.height);
    const svg = new TextDecoder().decode(await exportSvg(make(700, 'Studio'), [], 'embed'));
    expect(svg).toContain('font-weight:700');
    expect(svg).not.toContain('font-weight:100 900');
    const pdf = await exportPdf(make(700, 'Studio'), []);
    await writeFile(path.join(out, 'inter-700.pdf'), pdf);
    const loaded = await PDFDocument.load(pdf);
    const objects = loaded.context
      .enumerateIndirectObjects()
      .map(([, object]) => object.toString())
      .join('\n');
    expect(objects).toMatch(/Font/);
    expect(objects).not.toMatch(/Subtype\/Image/);
    expect(designExportNeedsFfmpeg(make(400, 'Studio'), 'svg')).toBe(false);
    expect(designExportNeedsFfmpeg(make(400, 'Studio'), 'png')).toBe(true);
  }, 60000);

  it('proves the SVG font pipeline actually rasterizes, not just that files exist', async () => {
    for (const face of designFontFaceList()) {
      await expect(readFile(face.path)).resolves.toBeTruthy();
    }
    const proof = await proveFontRaster();
    expect(proof.goldPixels).toBeGreaterThan(40);
    expect(proof.width).toBe(160);
    const report = await rendererPreflight();
    expect(report.ok).toBe(true);
    expect(report.raster?.goldPixels).toBeGreaterThan(40);
    expect(report.designExport.svg).toBe('web-runtime-static-ttf');
  }, 30000);
});

describe('Studio geometry and crop/audio parity', () => {
  it('round-trips a rotated non-square layer through the centre-origin convention', () => {
    const layer = { x: 10, y: 20, width: 8, height: 30, rotation: 90 };
    const px = (value: number) => value;
    const placed = fabricBoxFromLayer(layer, px, 2, 4);
    expect(placed).toMatchObject({ originX: 'center', originY: 'center', left: 16, top: 39, angle: 90 });
    const restored = layerBoxFromFabricCenter(
      { x: placed.left, y: placed.top },
      8,
      30,
      placed.angle,
      2,
      4,
      (value) => value,
      (value) => value,
    );
    expect(restored).toEqual(layer);
    const corners = layerWorldCorners({
      id: '1',
      type: 'rect',
      name: 'Bar',
      parentId: null,
      visible: true,
      locked: false,
      opacity: 1,
      fill: '#0B3B32',
      stroke: null,
      strokeWidth: 0,
      cornerRadius: 0,
      ...layer,
    });
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(30, 5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(8, 5);
  });

  it('uses the same crop-then-cover model in preview CSS and FFmpeg, with landmark pixels', async () => {
    const crop = { x: 0, y: 0, width: 0.5, height: 1 };
    const style = cropPreviewStyle(crop);
    expect(style.objectFit).toBe('cover');
    expect(style.objectViewBox).toBe(cropViewBox(crop));
    expect(style.objectViewBox).toBe('xywh(0% 0% 50% 100%)');
    const fullCover = coverAfterCropSourceRect(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 400, height: 200 },
      { width: 100, height: 100 },
    );
    expect(fullCover.x).toBeCloseTo(100, 5);
    expect(fullCover.width).toBeCloseTo(200, 5);
    const visible = coverAfterCropSourceRect(crop, { width: 400, height: 200 }, { width: 100, height: 100 });
    expect(visible.x).toBe(0);
    expect(visible.width).toBeCloseTo(200, 5);
    await mkdir(out, { recursive: true });
    const dir = await mkdtemp(path.join(tmpdir(), 'studio-crop-'));
    try {
      const source = path.join(dir, 'landmarks.png');
      const png = new PNG({ width: 400, height: 200 });
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 400; x++) {
          const i = (y * 400 + x) * 4;
          png.data[i] = x < 200 ? 220 : 20;
          png.data[i + 1] = y < 100 ? 30 : 200;
          png.data[i + 2] = x < 200 && y < 100 ? 30 : 220;
          png.data[i + 3] = 255;
        }
      }
      await writeFile(source, PNG.sync.write(png));
      const film = parseComposition({
        schema: 'studio-composition/v1',
        id: '40000000-0000-4000-8000-000000000201',
        title: 'Crop',
        aspect: 'square',
        fps: 24,
        scenes: [
          {
            id: '40000000-0000-4000-8000-000000000202',
            kind: 'image',
            assetId: '40000000-0000-4000-8000-000000000203',
            assetKind: 'version',
            name: 'Landmarks',
            inMs: 0,
            outMs: 1000,
            durationMs: 1000,
            crop,
            placement: { x: 0, y: 0, width: 1, height: 1 },
            transition: 'cut',
            stillMotion: 'none',
          },
        ],
        titles: [],
        captions: [],
        narration: null,
        music: null,
      });
      const plan = compileRender(
        film,
        [{ id: '40000000-0000-4000-8000-000000000203', kind: 'version', path: source, media: 'image' }],
        { film: '/tmp/studio-crop-film.mp4', cover: '/tmp/studio-crop-cover.png' },
      );
      expect(plan.filter).toContain('force_original_aspect_ratio=increase');
      expect(plan.filter).toContain('crop=iw*0.5:ih*1:iw*0:');
      const rendered = await renderComposition(film, [
        { id: '40000000-0000-4000-8000-000000000203', kind: 'version', path: source, media: 'image' },
      ]);
      await writeFile(path.join(out, 'crop-cover.png'), rendered.cover);
      const frame = PNG.sync.read(Buffer.from(rendered.cover));
      const sample = (x: number, y: number) => {
        const i = (y * frame.width + x) * 4;
        return [frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!];
      };
      const [r] = sample(Math.floor(frame.width / 2), Math.floor(frame.height / 2));
      expect(r).toBeGreaterThan(150);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('mixes without FFmpeg default normalization and inspects fades and shorter tracks', async () => {
    expect(AMIX_FILTER).toContain('normalize=0');
    expect(MIX_POLICY.ffmpeg).toContain('normalize=0');
    await mkdir(out, { recursive: true });
    const dir = await mkdtemp(path.join(tmpdir(), 'studio-mix-'));
    try {
      const narration = path.join(dir, 'voice.wav');
      const music = path.join(dir, 'score.wav');
      await run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-ac', '1', '-ar', '48000', narration]);
      await run(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=12', '-ac', '1', '-ar', '48000', music]);
      const still = path.join(dir, 'card.png');
      const card = new PNG({ width: 64, height: 36 });
      card.data.fill(255);
      await writeFile(still, PNG.sync.write(card));
      const film = parseComposition({
        schema: 'studio-composition/v1',
        id: '40000000-0000-4000-8000-000000000211',
        title: 'Mix',
        aspect: 'landscape',
        fps: 24,
        scenes: [
          {
            id: '40000000-0000-4000-8000-000000000212',
            kind: 'image',
            assetId: '40000000-0000-4000-8000-000000000213',
            assetKind: 'version',
            name: 'Card',
            inMs: 0,
            outMs: 8000,
            durationMs: 8000,
            crop: { x: 0, y: 0, width: 1, height: 1 },
            placement: { x: 0, y: 0, width: 1, height: 1 },
            transition: 'cut',
            stillMotion: 'none',
          },
        ],
        titles: [],
        captions: [],
        narration: {
          assetId: '40000000-0000-4000-8000-000000000214',
          assetKind: 'narration',
          gainDb: 0,
          fadeInMs: 0,
          fadeOutMs: 0,
        },
        music: {
          assetId: '40000000-0000-4000-8000-000000000215',
          assetKind: 'music',
          gainDb: 0,
          fadeInMs: 1000,
          fadeOutMs: 1000,
        },
      });
      const plan = compileRender(
        film,
        [
          { id: '40000000-0000-4000-8000-000000000213', kind: 'version', path: still, media: 'image' },
          { id: '40000000-0000-4000-8000-000000000214', kind: 'narration', path: narration, media: 'wav' },
          { id: '40000000-0000-4000-8000-000000000215', kind: 'music', path: music, media: 'wav' },
        ],
        { film: '/tmp/studio-mix-film.mp4', cover: '/tmp/studio-mix-cover.png' },
      );
      expect(plan.filter).toContain(AMIX_FILTER);
      expect(plan.filter).toContain('duration=longest');
      const rendered = await renderComposition(film, [
        { id: '40000000-0000-4000-8000-000000000213', kind: 'version', path: still, media: 'image' },
        { id: '40000000-0000-4000-8000-000000000214', kind: 'narration', path: narration, media: 'wav', durationMs: 4000 },
        { id: '40000000-0000-4000-8000-000000000215', kind: 'music', path: music, media: 'wav', durationMs: 12000 },
      ]);
      await writeFile(path.join(out, 'mix.mp4'), rendered.film);
      const pcm = path.join(dir, 'mix.s16');
      await run(['-i', path.join(out, 'mix.mp4'), '-ac', '1', '-ar', '48000', '-f', 's16le', pcm]);
      const samples = new Int16Array(new Uint8Array(await readFile(pcm)).buffer);
      const rms = (start: number, end: number) => {
        let sum = 0;
        const slice = samples.subarray(start, end);
        for (const sample of slice) sum += sample * sample;
        return Math.sqrt(sum / Math.max(1, slice.length));
      };
      const early = rms(0, 48000 * 0.2);
      const overlapped = rms(48000, 48000 * 2);
      const afterShort = rms(48000 * 5, 48000 * 6);
      expect(overlapped).toBeGreaterThan(early * 1.2);
      expect(afterShort).toBeGreaterThan(100);
      expect(afterShort).toBeLessThan(overlapped);
      expect(dbToRatio(0)).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60000);
});

describe('Studio worker bounds and health', () => {
  it('caps temp bytes and classifies operational health without treating a flag as commissioning', () => {
    const budget = new TempBudget(100);
    budget.add(40);
    expect(() => budget.add(80)).toThrow(/temporary disk limit/);
    expect(
      classifyHealth({
        stopping: false,
        preflightOk: true,
        lastQueueOkAt: null,
        lastQueueError: null,
        identity: 'local-test',
      }).status,
    ).toBe('degraded');
    expect(
      classifyHealth({
        stopping: false,
        preflightOk: true,
        lastQueueOkAt: Date.now(),
        lastQueueError: null,
        identity: null,
      }).http,
    ).toBe(503);
    expect(
      classifyHealth({
        stopping: false,
        preflightOk: true,
        lastQueueOkAt: Date.now(),
        lastQueueError: null,
        identity: 'fly:studio-render:abc',
      }),
    ).toMatchObject({ status: 'ok', http: 200 });
    expect(
      classifyHealth({
        stopping: false,
        preflightOk: false,
        lastQueueOkAt: Date.now(),
        lastQueueError: null,
        identity: 'fly:studio-render:abc',
      }).status,
    ).toBe('unavailable');
  });
});
