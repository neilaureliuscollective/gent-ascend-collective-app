import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
import {
  commitDesign,
  emptyHistory,
  redoDesign,
  undoDesign,
  alignLayers,
} from '../src/domains/studio/design/commands';
import {
  convertDocumentUnits,
  emptyDocument,
  parseDesignDocument,
  type DesignLayer,
} from '../src/domains/studio/design/document';
import { glyphScale } from '../src/domains/studio/design/units';
import { loadDesignFont } from '../src/domains/studio/design/measure';
import { designPresets, finishLayoutPreset, presetDocument } from '../src/domains/studio/design/presets';
import { sanitizeSvg } from '../src/domains/studio/design/sanitize';
import { toInches, toPixels, pagePoints } from '../src/domains/studio/design/units';
import { exportSvg } from '../src/domains/studio/design/svg-export';
import { exportPdf } from '../src/domains/studio/design/pdf-export';
import { exportPng, inspectPng } from '../src/domains/studio/design/png-export';
import { validateDesign } from '../src/domains/studio/design/validate';
import { studioProviderStates } from '../src/domains/studio/provider-states';
import { acknowledgedSave } from '../src/domains/studio/design/save-ack';
import {
  allStudioProductionTablesMissing,
  missingStudioSchema,
} from '../src/domains/studio/schema-absence';

const id = '10000000-0000-4000-8000-000000000001';

function textLayer(overrides: Partial<Extract<DesignLayer, { type: 'text' }>> = {}) {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    type: 'text' as const,
    name: 'Headline',
    parentId: null,
    visible: true,
    locked: false,
    opacity: 1,
    x: 8,
    y: 8,
    width: 70,
    height: 20,
    rotation: 0,
    content: 'Reserve Gold',
    fontId: 'inter' as const,
    fontSize: 18,
    fontWeight: 600 as const,
    align: 'left' as const,
    letterSpacing: 0,
    lineHeight: 1.2,
    fill: '#C4912F',
    ...overrides,
  };
}

describe('Studio design documents', () => {
  it('keeps physical units independent of screen pixel density', () => {
    expect(toInches(25.4, 'mm', 300)).toBeCloseTo(1, 8);
    expect(toPixels(1, 'in', 300)).toBe(300);
    expect(toPixels(1080, 'px', 72)).toBe(1080);
    expect(pagePoints({ width: 8.5, height: 11, unit: 'in', ppi: 300 })).toEqual({
      width: 612,
      height: 792,
    });
  });

  it('labels unverified label sizes and preserves verified ISO geometry', () => {
    const label = presetDocument('unconfirmed-label', id);
    expect(label.page.dimensionSource).toBe('unconfirmed');
    expect(label.page.dimensionNote).toMatch(/verified die size/i);
    const card = presetDocument('iso-id1', crypto.randomUUID());
    expect(card.page.width).toBeCloseTo(85.6, 5);
    expect(card.page.height).toBeCloseTo(53.98, 5);
    expect(card.page.dimensionSource).toBe('verified');
    expect(designPresets.some((preset) => preset.id === 'finish-portrait')).toBe(true);
  });

  it('converts Finish layouts into editable text layers instead of flattening them', () => {
    const document = finishLayoutPreset(id, {
      format: 'portrait',
      treatment: 'editorial',
      brand: 'GENT ASCEND',
      headline: 'A clearer way',
      supporting: 'Private studio type',
      footer: 'Review before print',
    });
    expect(document.layers.some((layer) => layer.type === 'text' && layer.content === 'A clearer way')).toBe(
      true,
    );
  });

  it('undoes and redoes command-based edits without losing layer IDs', () => {
    let document = emptyDocument({
      id,
      title: 'Mark',
      width: 100,
      height: 70,
      unit: 'mm',
      dimensionSource: 'supplied',
    });
    let history = emptyHistory();
    const layer = textLayer();
    const added = commitDesign(document, history, { type: 'add', layer });
    document = added.document;
    history = added.history;
    const moved = commitDesign(document, history, { type: 'update', id: layer.id, patch: { x: 12 } });
    document = moved.document;
    history = moved.history;
    expect(document.layers[0]?.x).toBe(12);
    const undone = undoDesign(document, history);
    expect(undone.document.layers[0]?.x).toBe(8);
    const redone = redoDesign(undone.document, undone.history);
    expect(redone.document.layers[0]?.x).toBe(12);
    expect(redone.document.layers[0]?.id).toBe(layer.id);
  });

  it('aligns unlocked layers', () => {
    const a = textLayer();
    const b = textLayer({
      id: '20000000-0000-4000-8000-000000000002',
      x: 40,
      name: 'Support',
    });
    const document = parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'Align',
        width: 100,
        height: 70,
        unit: 'mm',
        dimensionSource: 'supplied',
      }),
      layers: [a, b],
    });
    const aligned = alignLayers(document, [a.id, b.id], 'left');
    expect(aligned.layers.every((layer) => layer.x === 8)).toBe(true);
  });

  it('rejects scripted SVG imports and external hrefs', () => {
    expect(() => sanitizeSvg('<svg><script>alert(1)</script></svg>')).toThrow(/unsafe/i);
    expect(() =>
      sanitizeSvg('<svg><path d="M0 0" onclick="alert(1)"/></svg>'),
    ).toThrow(/event/i);
    expect(() => sanitizeSvg('<svg><path href="https://evil.test"/></svg>')).toThrow(/External/i);
    expect(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10"/></svg>')).toContain(
      '<path',
    );
  });

  it('refuses hostile SVG on the saved-document path, not only the helper', () => {
    const base = emptyDocument({
      id,
      title: 'Unsafe',
      width: 100,
      height: 70,
      unit: 'mm',
      dimensionSource: 'supplied',
    });
    expect(() =>
      parseDesignDocument({
        ...base,
        layers: [
          {
            id: '20000000-0000-4000-8000-000000000009',
            type: 'svg',
            name: 'Attack',
            parentId: null,
            visible: true,
            locked: false,
            opacity: 1,
            x: 1,
            y: 1,
            width: 20,
            height: 20,
            rotation: 0,
            markup: '<svg><script>alert(1)</script></svg>',
          },
        ],
      }),
    ).toThrow(/unsafe|not allowed/i);
  });

  it('converts physical geometry when units change instead of relabeling', () => {
    const mm = parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'Units',
        width: 25.4,
        height: 12.7,
        unit: 'mm',
        dimensionSource: 'supplied',
      }),
      layers: [textLayer({ x: 25.4, y: 0, width: 12.7, height: 5 })],
    });
    const inches = convertDocumentUnits(mm, 'in');
    expect(inches.page.unit).toBe('in');
    expect(inches.page.width).toBeCloseTo(1, 3);
    expect(inches.page.height).toBeCloseTo(0.5, 3);
    expect(inches.layers[0]?.x).toBeCloseTo(1, 3);
    expect(inches.layers[0]?.width).toBeCloseTo(0.5, 3);
    expect(inches.layers[0] && inches.layers[0].type === 'text' ? inches.layers[0].fontSize : 0).toBe(18);
  });

  it('keeps newer local edits when an older save acknowledgement arrives', () => {
    expect(
      acknowledgedSave({
        requestSeq: 4,
        latestSeq: 7,
        requestId: id,
        currentId: id,
        serverRevision: 2,
        serverUpdatedAt: '2026-10-15T00:00:00.000Z',
      }),
    ).toEqual({
      apply: true,
      keepLocalEdits: true,
      revision: 2,
      updatedAt: '2026-10-15T00:00:00.000Z',
    });
    expect(
      acknowledgedSave({
        requestSeq: 3,
        latestSeq: 3,
        requestId: id,
        currentId: '20000000-0000-4000-8000-000000000099',
        serverRevision: 3,
        serverUpdatedAt: '2026-10-15T00:00:00.000Z',
      }),
    ).toEqual({ apply: false });
  });

  it('treats missing Design/Film tables as a gated setup state, not a Studio history failure', () => {
    expect(missingStudioSchema({ code: 'PGRST205' })).toBe(true);
    expect(missingStudioSchema({ code: '42P01' })).toBe(true);
    expect(missingStudioSchema({ code: '42501' })).toBe(false);
    expect(
      allStudioProductionTablesMissing({ code: 'PGRST205' }, { code: '42P01' }, { code: '42703' }),
    ).toBe(true);
    expect(
      allStudioProductionTablesMissing({ code: 'PGRST205' }, { code: '42501' }, { code: 'PGRST205' }),
    ).toBe(false);
  });

  it('does not silently substitute missing fonts', async () => {
    const document = parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'Type',
        width: 100,
        height: 70,
        unit: 'mm',
        dimensionSource: 'supplied',
      }),
      layers: [textLayer({ content: 'Hello' })],
    });
    const issues = await validateDesign(document, []);
    expect(issues.some((issue) => issue.code === 'unsupported-prepress')).toBe(true);
    expect(studioProviderStates({}).prepressCmyk).toBe('unavailable');
    expect(studioProviderStates({}).filmRenderHosted).toBe('unavailable');
  });
});

describe('Studio design exports', () => {
  async function sample() {
    return parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'Label proof',
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
        textLayer({ content: 'Aethelios Studio', x: 8, y: 16, width: 70, height: 18 }),
      ],
    });
  }

  it('writes SVG with escaped text and PDF with vector page geometry plus embedded Inter', async () => {
    const document = await sample();
    const svg = new TextDecoder().decode(await exportSvg(document, [], 'embed'));
    expect(svg).toContain('Aethelios Studio');
    expect(svg).toContain('font-family="Inter"');
    expect(svg).not.toContain('<script');
    const pdfBytes = await exportPdf(document, []);
    const pdf = await PDFDocument.load(pdfBytes);
    const page = pdf.getPages()[0]!;
    const size = page.getSize();
    const expected = pagePoints(document.page);
    expect(size.width).toBeCloseTo(expected.width, 2);
    expect(size.height).toBeCloseTo(expected.height, 2);
    const objects = pdf.context
      .enumerateIndirectObjects()
      .map(([, object]) => object.toString())
      .join('\n');
    expect(objects).toMatch(/Font/);
    expect(objects).toMatch(/Inter/);
    expect(objects).not.toMatch(/Subtype\/Image/);
  });

  it('rasterizes PNG at document PPI, not screen density', async () => {
    const document = await sample();
    const png = await exportPng(document, []);
    const info = inspectPng(png);
    expect(info).toEqual({
      width: toPixels(document.page.width, 'mm', 300),
      height: toPixels(document.page.height, 'mm', 300),
    });
    const decoded = PNG.sync.read(Buffer.from(png));
    let gold = 0;
    for (let i = 0; i < decoded.data.length; i += 4) {
      if (decoded.data[i]! > 140 && decoded.data[i + 1]! > 90 && decoded.data[i + 1]! < 180 && decoded.data[i + 2]! < 90)
        gold += 1;
    }
    expect(gold).toBeGreaterThan(400);
  });

  it('outlines SVG text at PPI-scaled glyph size, not raw point size', async () => {
    const document = await sample();
    const font = await loadDesignFont('inter');
    const svg = new TextDecoder().decode(await exportSvg(document, [], 'outline'));
    const expected = glyphScale(18, 300, font.unitsPerEm);
    expect(svg).toContain(`scale(${expected}`);
    expect(svg).toMatch(/width="[0-9.]+in"/);
    expect(svg).not.toContain(`scale(${18 / font.unitsPerEm}`);
  });

  it('does not inject unsanitized SVG markup into exports', async () => {
    const document = await sample();
    document.layers.push({
      id: '20000000-0000-4000-8000-000000000008',
      type: 'svg',
      name: 'Mark',
      parentId: null,
      visible: true,
      locked: false,
      opacity: 1,
      x: 10,
      y: 10,
      width: 12,
      height: 12,
      rotation: 15,
      markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#C4912F"/></svg>',
    });
    const svg = new TextDecoder().decode(await exportSvg(parseDesignDocument(document), [], 'embed'));
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<script');
    const pdf = await exportPdf(parseDesignDocument(document), []);
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
