import { describe, expect, it, vi } from 'vitest';
import {
  adjustDesignSwatch,
  designAssetSource,
  designBoardContentSchema,
  legacyReserveBoard,
  lifestyleLaunchBoard,
  selectDesignDirection,
  selectedDirection,
} from '@/domains/talk-creation/design-board';
import { produceArchitectDirection } from '@/domains/talk-creation/architect-direction';
import {
  designDirectionDigest,
  designDirectionReceiptSchema,
} from '@/domains/architect-design-direction/contract';
import { supportedDirectionForGeneration } from '@/domains/architect-apps/context';
import { creationBriefForGeneration } from '@/domains/architect-origin/creation-journey';
import { compactAppStatus } from '@/domains/architect-apps/stage';
import { contrastRatio } from '@/domains/talk-creation/contrast';
import { compileTalkDocument } from '@/domains/work-items/document';

vi.mock('server-only', () => ({}));

const identity = {
  conversationId: '30000000-0000-4000-8000-000000000031',
  boardId: '50000000-0000-4000-8000-000000000031',
  version: 2,
};
describe('premium creative identity', () => {
  it('provides three compositions and honest authorized artwork without packaging fabrication', () => {
    const board = lifestyleLaunchBoard();
    expect(new Set(board.directions.map((item) => item.demo.kind)).size).toBe(3);
    expect(new Set(board.directions.map((item) => item.tokens.material)).size).toBe(3);
    for (const item of board.directions) {
      const colors = Object.fromEntries(item.tokens.colors.map((color) => [color.role, color.hex]));
      for (const role of ['text', 'accent', 'muted'])
        expect(contrastRatio(colors[role]!, colors.background!)!).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio('#050706', colors.highlight!)!).toBeGreaterThanOrEqual(4.5);
      expect(JSON.stringify(item)).not.toMatch(/Legacy Reserve|bottle/i);
      expect(designAssetSource(item.demo.image)).toBeNull();
      expect(designAssetSource(item.assets[0]!)).toBe(
        '/brand/aethelios-human-ascendance-20261015-crest.webp',
      );
    }
  });
  it('selects, revises, serializes, reloads and retains the exact direction and digest in generation', () => {
    const board = adjustDesignSwatch(selectDesignDirection(lifestyleLaunchBoard(), 'direction-c'), {
      directionId: 'direction-c',
      role: 'accent',
      hex: '#76E8C2',
    });
    const reloaded = designBoardContentSchema.parse(JSON.parse(JSON.stringify(board)));
    const receipt = produceArchitectDirection({ ...identity, board: reloaded });
    const retained = designDirectionReceiptSchema.parse(JSON.parse(JSON.stringify(receipt)));
    expect(retained.content.designSnapshot?.direction).toEqual(selectedDirection(board));
    expect(retained.identity.boardVersion).toBe(2);
    expect(retained.digest).toBe(designDirectionDigest(retained.content, retained.sourceRecords));
    const context = supportedDirectionForGeneration({
      ...retained.content,
      digest: retained.digest,
      verified: true,
      sourceKind: 'talk-authorized',
    });
    expect(context?.designSnapshot).toEqual(retained.content.designSnapshot);
    expect(context?.identity).toEqual(retained.identity);
    expect(context?.digest).toBe(retained.digest);
    const changed = produceArchitectDirection({ ...identity, version: 3, board: reloaded });
    expect(changed.digest).not.toBe(retained.digest);
  });
  it('keeps existing receipts compatible and preserves other brands’ explicit palettes', () => {
    const board = legacyReserveBoard();
    const receipt = produceArchitectDirection({ ...identity, board });
    expect(receipt.content).not.toHaveProperty('designSnapshot');
    expect(selectedDirection(board).tokens.colors[0]?.hex).toBe('#0D211B');
    expect(designDirectionReceiptSchema.parse(receipt)).toEqual(receipt);
  });
  it('refuses arbitrary asset URLs and retains private media behind the ownership route', () => {
    const asset = lifestyleLaunchBoard().directions[0]!.demo.image;
    expect(designAssetSource({ ...asset, kind: 'referenced', referenced: true })).toBeNull();
    expect(
      designAssetSource({
        ...asset,
        kind: 'referenced',
        referenced: true,
        source: 'studio-version',
        versionId: identity.boardId,
      }),
    ).toBe(`/api/studio/image?id=${identity.boardId}&kind=version`);
  });
  it('keeps audience and visual direction in separate paragraphs and imported planning in generation', () => {
    expect(
      compileTalkDocument('brief', {
        title: 'Launch',
        purpose: 'A considered launch.',
        audience: 'Founders',
        visualDirection: 'Charcoal glass',
        requirements: ['Approved identity only'],
        unresolved: [],
      }),
    ).toContain('Audience: Founders\n\nVisual direction: Charcoal glass');
    const brief = creationBriefForGeneration({
      blueprint: {
        solution: 'Imported exact plan',
        milestones: 'Review, approve',
        deliverables: 'Ink #123456',
      },
    });
    expect(brief).toContain('Imported exact plan');
    expect(brief).toContain('Ink #123456');
  });
});

it('distinguishes approval, building, preview and blocked without discarding last-good preview', () => {
  expect(compactAppStatus({ stage: 'idle', awaitingApproval: true })).toBe('Awaiting approval');
  expect(compactAppStatus({ stage: 'building', awaitingApproval: true })).toBe('Building');
  expect(compactAppStatus({ stage: 'preview-ready' })).toBe('Preview ready');
  expect(compactAppStatus({ stage: 'idle', blocked: true, retained: true })).toBe(
    'Blocked · last good preview kept',
  );
});

it('rejects marker removal for every premium-only field before producing a lossy v1 receipt', () => {
  const premium = lifestyleLaunchBoard();
  delete premium.rendererVersion;
  expect(designBoardContentSchema.safeParse(premium).success).toBe(false);
  expect(() => produceArchitectDirection({ ...identity, board: premium })).toThrow(
    /rendererVersion/,
  );
  for (const field of ['composition', 'material', 'asset-source', 'asset-version'] as const) {
    const board = legacyReserveBoard();
    const direction = board.directions[0]!;
    if (field === 'composition') direction.demo.kind = 'statement';
    if (field === 'material') direction.tokens.material = 'charcoal-glass';
    if (field === 'asset-source') direction.demo.image.source = 'official-crest';
    if (field === 'asset-version') direction.assets[0]!.versionId = identity.boardId;
    expect(designBoardContentSchema.safeParse(board).success, field).toBe(false);
    expect(() => produceArchitectDirection({ ...identity, board }), field).toThrow(
      /rendererVersion/,
    );
  }
});

it('preserves critical design requirements in the final context despite long valid imported planning sections', async () => {
  const { buildAppGenerationContext } = await import('@/domains/architect-apps/context');
  const brief = creationBriefForGeneration({
    blueprint: {
      vision: 'Vision '.repeat(400),
      solution: 'Plan '.repeat(600),
      milestones: 'Milestone '.repeat(300),
      audience: 'Founder audience sentinel',
      requirements: 'No invented packaging; preserve approved logo sentinel',
      deliverables: 'Palette sentinel #ABCDEF charcoal glass',
      next: 'Review before building sentinel',
    },
  });
  const context = buildAppGenerationContext({
    instruction: 'Prepare',
    kind: 'create',
    files: [],
    brief,
  });
  expect(context.brief!.length).toBeLessThanOrEqual(2000);
  for (const value of [
    'Founder audience sentinel',
    'preserve approved logo sentinel',
    'Palette sentinel #ABCDEF',
    'Review before building sentinel',
    'Imported plan:',
    'Milestones:',
    '[excerpt]',
  ])
    expect(context.brief).toContain(value);
  const oversized = creationBriefForGeneration({
    blueprint: {
      requirements: 'Critical requirement '.repeat(200),
      deliverables: 'Palette #123456',
    },
  });
  expect(() =>
    buildAppGenerationContext({
      instruction: 'Prepare',
      kind: 'create',
      files: [],
      brief: oversized,
    }),
  ).toThrow(/not truncated/);
});
