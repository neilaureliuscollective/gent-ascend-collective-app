import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { interpretLocalDraft, rebaseDraftForExplicitKeep } from '../src/domains/studio/design/local-draft';
import { applyLayerPatches, createGroupLayer, groupWorldBounds } from '../src/domains/studio/design/geometry';
import { nestedSvg } from '../src/domains/studio/design/svg-export';
import { emptyDocument, parseDesignDocument } from '../src/domains/studio/design/document';
import { exportPdf } from '../src/domains/studio/design/pdf-export';
import { exportPng } from '../src/domains/studio/design/png-export';
import { exportSvg } from '../src/domains/studio/design/svg-export';
import { loadDesignFont } from '../src/domains/studio/design/measure';
import { mediaPixels, pagePoints, toPixels } from '../src/domains/studio/design/units';
import { commitDesign, emptyHistory, redoDesign, undoDesign } from '../src/domains/studio/design/commands';
import {
  attemptObjectKeys,
  cleanupAttemptObjects,
  publishOrReconcileAttempt,
  queueErrorBackoffMs,
  shouldRecoverWhileIdle,
} from '../src/domains/studio/render/attempt-storage';
import { dbToRatio, trackGainAt } from '../src/domains/studio/composition/audio';
import { compileRender, coverScaleFilter } from '../src/domains/studio/composition/compile';
import { compositionAss } from '../src/domains/studio/composition/captions';
import { parseComposition } from '../src/domains/studio/composition/model';

const id = '10000000-0000-4000-8000-000000000041';

describe('Studio draft recovery', () => {
  it('keeps the recovered draft’s original base revision instead of the latest server revision', () => {
    const recovered = interpretLocalDraft(
      { document: { title: 'older' }, revision: 1 },
      { document: { title: 'newer session' }, revision: 4 },
    );
    expect(recovered).toEqual({
      document: { title: 'older' },
      baseRevision: 1,
      updatedAt: null,
      kind: 'reconcile',
    });
    expect(recovered?.baseRevision).not.toBe(4);
    expect(interpretLocalDraft({ document: { title: 'same' }, revision: 2 }, { document: { title: 'same' }, revision: 2 })).toBeNull();
    expect(interpretLocalDraft({ document: { title: 'ahead' }, revision: 5 }, { document: { title: 'server' }, revision: 2 })).toBeNull();
    const kept = rebaseDraftForExplicitKeep({
      document: { title: 'older' },
      updatedAt: null,
      serverRevision: 4,
      serverUpdatedAt: '2026-10-15T12:00:00.000Z',
    });
    expect(kept.revision).toBe(4);
    expect(kept.document).toEqual({ title: 'older' });
  });
});

describe('Studio canvas geometry', () => {
  it('groups, transforms, undoes and ungroups in world coordinates', () => {
    let document = parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'Group proof',
        width: 100,
        height: 70,
        unit: 'mm',
        dimensionSource: 'supplied',
      }),
      layers: [
        {
          id: '20000000-0000-4000-8000-000000000041',
          type: 'rect',
          name: 'A',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: 10,
          y: 12,
          width: 20,
          height: 8,
          rotation: 0,
          fill: '#0B3B32',
          stroke: null,
          strokeWidth: 0,
          cornerRadius: 0,
        },
        {
          id: '20000000-0000-4000-8000-000000000042',
          type: 'ellipse',
          name: 'B',
          parentId: null,
          visible: true,
          locked: false,
          opacity: 1,
          x: 40,
          y: 14,
          width: 12,
          height: 10,
          rotation: 0,
          fill: '#C4912F',
          stroke: null,
          strokeWidth: 0,
          cornerRadius: 0,
        },
      ],
    });
    const group = createGroupLayer(document, document.layers.map((layer) => layer.id), '30000000-0000-4000-8000-000000000041');
    expect(group.x).toBe(10);
    expect(group.y).toBe(12);
    expect(group.width).toBe(42);
    expect(group.height).toBe(12);
    expect(group.x).not.toBe(0);
    expect(group.width).not.toBe(100);
    let history = emptyHistory();
    const grouped = commitDesign(document, history, { type: 'group', ids: document.layers.map((layer) => layer.id), group });
    document = grouped.document;
    history = grouped.history;
    const moved = applyLayerPatches(document, {
      [group.id]: { x: 16, y: 18, width: 42, height: 12, rotation: 12 },
      '20000000-0000-4000-8000-000000000041': { x: 16, y: 18, width: 20, height: 8, rotation: 12 },
      '20000000-0000-4000-8000-000000000042': { x: 46, y: 20, width: 12, height: 10, rotation: 12 },
    });
    const baked = moved.layers.find((layer) => layer.id === group.id)!;
    expect(baked.rotation).toBe(0);
    expect(groupWorldBounds(moved.layers.filter((layer) => layer.parentId === group.id))).toMatchObject({
      x: baked.x,
      y: baked.y,
      width: baked.width,
      height: baked.height,
    });
    const resized = commitDesign(document, history, {
      type: 'update',
      id: '20000000-0000-4000-8000-000000000041',
      patch: { width: 28, height: 14 },
    });
    const undone = undoDesign(resized.document, resized.history);
    expect(undone.document.layers.find((layer) => layer.id === '20000000-0000-4000-8000-000000000041')?.width).toBe(20);
    const redone = redoDesign(undone.document, undone.history);
    expect(redone.document.layers.find((layer) => layer.id === '20000000-0000-4000-8000-000000000041')?.width).toBe(28);
    const ungrouped = commitDesign(grouped.document, grouped.history, { type: 'ungroup', groupId: group.id });
    expect(ungrouped.document.layers.some((layer) => layer.type === 'group')).toBe(false);
    expect(ungrouped.document.layers.every((layer) => layer.parentId === null)).toBe(true);
  });
});

describe('Studio faithful exports', () => {
  it('preserves SVG viewBox when embedding a logo', () => {
    const nested = nestedSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" preserveAspectRatio="xMinYMin meet"><circle cx="12" cy="12" r="9"/></svg>',
      120,
      80,
    );
    expect(nested).toContain('viewBox="0 0 24 24"');
    expect(nested).toContain('preserveAspectRatio="xMinYMin meet"');
    expect(nested).toContain('width="120"');
  });

  it('uses real variable font weights instead of drawing regular twice', async () => {
    await expect(loadDesignFont('dejavu', 700)).rejects.toThrow(/real 700 instance|does not include/);
    const base = {
      ...emptyDocument({
        id,
        title: 'Weight proof',
        width: 80,
        height: 24,
        unit: 'mm',
        dimensionSource: 'supplied',
        ppi: 300,
      }),
    };
    const make = (weight: 400 | 700) =>
      parseDesignDocument({
        ...base,
        layers: [
          {
            id: '20000000-0000-4000-8000-000000000044',
            type: 'text',
            name: 'Weight',
            parentId: null,
            visible: true,
            locked: false,
            opacity: 1,
            x: 4,
            y: 4,
            width: 72,
            height: 16,
            rotation: 0,
            content: 'Studio',
            fontId: 'inter',
            fontSize: 28,
            fontWeight: weight,
            align: 'left',
            letterSpacing: 0,
            lineHeight: 1.2,
            fill: '#C4912F',
          },
        ],
      });
    const regular = await exportPng(make(400), []);
    const bold = await exportPng(make(700), []);
    expect(Buffer.from(regular).equals(Buffer.from(bold))).toBe(false);
    const svg = new TextDecoder().decode(await exportSvg(make(700), [], 'embed'));
    expect(svg).toContain('font-weight="700"');
    await expect(exportSvg(make(700), [], 'outline')).rejects.toThrow(/will not simulate bold/i);
  });

  it('keeps trim 85.6 mm after 1.5 mm outward bleed', async () => {
    const document = parseDesignDocument({
      ...emptyDocument({
        id,
        title: 'Bleed proof',
        width: 85.6,
        height: 53.98,
        unit: 'mm',
        dimensionSource: 'verified',
        ppi: 300,
      }),
      page: {
        width: 85.6,
        height: 53.98,
        unit: 'mm',
        ppi: 300,
        bleed: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
        safe: { top: 2, right: 2, bottom: 2, left: 2 },
        dimensionSource: 'verified',
        dimensionNote: 'ISO/IEC 7810 ID-1',
        background: '#080A0B',
      },
    });
    const pdf = await PDFDocument.load(await exportPdf(document, []));
    const page = pdf.getPages()[0]!;
    const trim = page.getTrimBox();
    const expected = pagePoints(document.page);
    expect(trim.width).toBeCloseTo(expected.width, 2);
    expect(trim.height).toBeCloseTo(expected.height, 2);
    expect(page.getSize().width).toBeGreaterThan(trim.width + 1);
    expect(mediaPixels(document.page).width).toBe(toPixels(85.6 + 3, 'mm', 300));
    const svg = new TextDecoder().decode(await exportSvg(document, [], 'embed'));
    expect(svg).toContain('viewBox="0 0');
    expect(pdf.getSubject()).toMatch(/rasterized to PNG/i);
  });

  it('fails PNG export instead of returning a degraded rectangle fallback', async () => {
    const document = emptyDocument({
      id,
      title: 'PNG fail',
      width: 40,
      height: 20,
      unit: 'mm',
      dimensionSource: 'supplied',
    });
    await expect(exportPng(document, [], '/this/ffmpeg/does-not-exist')).rejects.toThrow(/will not return|requires FFmpeg/i);
  });
});

describe('Studio render attempts and idle recovery', () => {
  it('cannot let a losing attempt overwrite or delete the winning objects', async () => {
    const winner = attemptObjectKeys({
      uid: 'user',
      projectId: 'proj',
      jobId: 'job',
      token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const loser = attemptObjectKeys({
      uid: 'user',
      projectId: 'proj',
      jobId: 'job',
      token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(winner.film).not.toBe(loser.film);
    const store = new Map<string, string>([
      [winner.film, 'winner-mp4'],
      [winner.cover, 'winner-png'],
      [winner.captions, 'winner-vtt'],
      [loser.film, 'loser-mp4'],
    ]);
    const removed: string[] = [];
    const outcome = await publishOrReconcileAttempt({
      finish: async () => ({ error: new Error('uncertain'), data: null }),
      readJob: async () => ({
        status: 'complete',
        lease_token: null,
        storage_film: winner.film,
        storage_cover: winner.cover,
        storage_captions: winner.captions,
      }),
      uploaded: [loser.film, loser.cover, loser.captions],
      remove: async (keys) => {
        for (const key of keys) {
          removed.push(key);
          store.delete(key);
        }
      },
    });
    expect(outcome.ours).toBe(false);
    expect(store.get(winner.film)).toBe('winner-mp4');
    expect(removed).toContain(loser.film);
    expect(removed).not.toContain(winner.film);
    const extra = await cleanupAttemptObjects(
      async (keys) => keys.forEach((key) => store.delete(key)),
      [loser.film],
      new Set([winner.film]),
    );
    expect(extra).toEqual([loser.film]);
    expect(store.get(winner.film)).toBe('winner-mp4');
  });

  it('cannot let a delayed losing completion overwrite the winner', async () => {
    const winner = attemptObjectKeys({
      uid: 'user',
      projectId: 'proj',
      jobId: 'job',
      token: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    const loser = attemptObjectKeys({
      uid: 'user',
      projectId: 'proj',
      jobId: 'job',
      token: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    const store = new Map<string, string>([
      [winner.film, 'winner-mp4'],
      [winner.cover, 'winner-png'],
      [winner.captions, 'winner-vtt'],
      [loser.film, 'loser-mp4'],
      [loser.cover, 'loser-png'],
      [loser.captions, 'loser-vtt'],
    ]);
    const winnerToken = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    let published: { film: string; cover: string; captions: string } | null = null;
    let releaseWinner!: () => void;
    const winnerGate = new Promise<void>((resolve) => {
      releaseWinner = resolve;
    });
    const winnerOutcome = publishOrReconcileAttempt({
      finish: async () => {
        await winnerGate;
        published = { film: winner.film, cover: winner.cover, captions: winner.captions };
        return { error: null, data: true };
      },
      readJob: async () => ({
        status: published ? 'complete' : 'running',
        lease_token: published ? null : winnerToken,
        storage_film: published?.film ?? null,
        storage_cover: published?.cover ?? null,
        storage_captions: published?.captions ?? null,
      }),
      uploaded: [winner.film, winner.cover, winner.captions],
      remove: async (keys) => {
        for (const key of keys) store.delete(key);
      },
      token: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    const loserOutcome = publishOrReconcileAttempt({
      finish: async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { error: new Error('uncertain completion'), data: null };
      },
      readJob: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          status: published ? 'complete' : 'running',
          lease_token: published ? null : 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          storage_film: published?.film ?? null,
          storage_cover: published?.cover ?? null,
          storage_captions: published?.captions ?? null,
        };
      },
      uploaded: [loser.film, loser.cover, loser.captions],
      remove: async (keys) => {
        for (const key of keys) store.delete(key);
      },
      token: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    releaseWinner();
    const [winnerResult, loserResult] = await Promise.all([winnerOutcome, loserOutcome]);
    expect(winnerResult.published).toBe(true);
    expect(loserResult.ours).toBe(false);
    expect(store.get(winner.film)).toBe('winner-mp4');
    expect(store.has(loser.film)).toBe(false);
  });

  it('recovers during idle polling after a restart before lease expiry', () => {
    expect(shouldRecoverWhileIdle(0)).toBe(false);
    expect(shouldRecoverWhileIdle(5)).toBe(true);
    expect(shouldRecoverWhileIdle(10)).toBe(true);
    expect(shouldRecoverWhileIdle(1)).toBe(false);
    expect(queueErrorBackoffMs(0)).toBe(1000);
    expect(queueErrorBackoffMs(3)).toBeGreaterThan(queueErrorBackoffMs(1));
  });
});

describe('Studio preview/export contract', () => {
  it('uses cover scaling, placement-bound zoom and distinct title/caption styles', () => {
    expect(coverScaleFilter(1920, 1080)).toContain('force_original_aspect_ratio=increase');
    const document = parseComposition({
      schema: 'studio-composition/v1',
      id: '40000000-0000-4000-8000-000000000080',
      title: 'Contract',
      aspect: 'landscape',
      fps: 24,
      scenes: [
        {
          id: '40000000-0000-4000-8000-000000000081',
          kind: 'image',
          assetId: '40000000-0000-4000-8000-000000000082',
          assetKind: 'version',
          name: 'Still',
          inMs: 0,
          outMs: 1000,
          durationMs: 1000,
          crop: { x: 0, y: 0, width: 1, height: 1 },
          placement: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          transition: 'cut',
          stillMotion: 'slow-zoom',
        },
      ],
      titles: [{ id: '40000000-0000-4000-8000-000000000083', startMs: 0, endMs: 400, text: 'Title card', fontId: 'inter' }],
      captions: [{ id: '40000000-0000-4000-8000-000000000084', startMs: 400, endMs: 900, text: 'Caption line' }],
      narration: { assetId: '40000000-0000-4000-8000-000000000085', assetKind: 'narration', gainDb: -6, fadeInMs: 100, fadeOutMs: 100 },
      music: null,
    });
    const plan = compileRender(
      document,
      [
        { id: '40000000-0000-4000-8000-000000000082', kind: 'version', path: '/tmp/studio-red.png', media: 'image' },
        { id: '40000000-0000-4000-8000-000000000085', kind: 'narration', path: '/tmp/studio-narration.wav', media: 'wav' },
      ],
      { film: '/tmp/studio-film.mp4', cover: '/tmp/studio-cover.png', captions: '/tmp/studio-overlay.ass' },
    );
    expect(plan.filter).toContain('force_original_aspect_ratio=increase');
    expect(plan.filter).toMatch(/zoompan=.*s=1536x864/);
    expect(plan.filter).not.toMatch(/scale=1536:864:flags=lanczos,/);
    expect(plan.filter).toContain('subtitles=/tmp/studio-overlay.ass');
    const ass = compositionAss(document);
    expect(ass).toContain('Style: Title');
    expect(ass).toContain('Style: Caption');
    expect(ass).toContain('Title card');
    expect(ass).toContain('Caption line');
    expect(trackGainAt(0, 1000, document.narration!)).toBe(0);
    expect(trackGainAt(500, 1000, document.narration!)).toBeCloseTo(dbToRatio(-6), 3);
  });
});
