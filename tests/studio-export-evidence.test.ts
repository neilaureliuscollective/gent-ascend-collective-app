import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { PDFDocument } from 'pdf-lib';
import { emptyDocument, parseDesignDocument } from '../src/domains/studio/design/document';
import { exportSvg } from '../src/domains/studio/design/svg-export';
import { exportPdf } from '../src/domains/studio/design/pdf-export';
import { exportPng, inspectPng } from '../src/domains/studio/design/png-export';
import { pagePoints, toPixels } from '../src/domains/studio/design/units';
import { emptyComposition } from '../src/domains/studio/composition/model';
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
});
