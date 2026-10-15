import { expect, it } from 'vitest';
import {
  compareTalkRevisions,
  compileTalkDocument,
  describeSelectedWork,
  describeTalkDestination,
  exportTalkDocument,
  resolveWorkTarget,
  selectionChipLabel,
  spokenWorkTargetUpdate,
  workTargetVoiceText,
} from '@/domains/work-items';
import { lifestyleLaunchBoard, selectDesignDirection } from '@/domains/talk-creation/design-board';
import type { TalkCreation, TalkCreationWorkspace } from '@/domains/talk-creation/schema';

it('names the selected board direction for conversational targeting', () => {
  const board = selectDesignDirection(lifestyleLaunchBoard(), 'direction-c');
  const creation: TalkCreation = {
    id: '50000000-0000-4000-8000-000000000401',
    person_id: '00000000-0000-4000-8000-000000000001',
    conversation_id: '30000000-0000-4000-8000-000000000401',
    source_turn_id: null,
    lineage_id: '50000000-0000-4000-8000-000000000401',
    version: 4,
    kind: 'board',
    content: board,
    predecessor_id: null,
    superseded_by: null,
    created_at: '2026-10-15T03:00:00Z',
  };
  const workspace: TalkCreationWorkspace = {
    creations: [creation],
    selected: { board: creation.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  const selected = describeSelectedWork(workspace);
  expect(selectionChipLabel(selected!)).toBe('Aethelios Lifestyle launch directions · v4 · Emerald Glass');
});

it('exports a Lifestyle launch brief as Markdown, not a JSON blob', () => {
  const exported = exportTalkDocument('brief', {
    title: 'Aethelios Lifestyle launch',
    purpose: 'Introduce the line.',
    audience: 'Founders',
    visualDirection: 'Obsidian and emerald',
    requirements: ['Phone-first'],
    unresolved: ['Merchandising copy'],
  });
  expect(exported?.mime).toBe('text/markdown');
  expect(exported?.body).toContain('# Aethelios Lifestyle launch');
  expect(exported?.body).toContain('Browser Print/PDF is a separate control');
  expect(exported?.filename).toMatch(/\.md$/);
  expect(exported?.body).toContain('Native DOCX/PPTX/XLSX and stored-file PDF are not implemented');
});

it('compiles a brief for the Talk preview and compares a later revision', () => {
  const first = {
    title: 'Aethelios Lifestyle launch',
    purpose: 'Introduce the line.',
    audience: 'Founders',
    visualDirection: 'Obsidian and emerald',
    requirements: ['Phone-first'],
    unresolved: ['Merchandising copy'],
  };
  const next = { ...first, purpose: 'Introduce the line with Emerald Glass.' };
  expect(compileTalkDocument('brief', first)).toContain('# Aethelios Lifestyle launch');
  expect(compareTalkRevisions(first, next)).toEqual([
    { field: 'Purpose', from: 'Introduce the line.', to: 'Introduce the line with Emerald Glass.' },
  ]);
});

it('names a targeted brief field for conversational change-this', () => {
  const creation: TalkCreation = {
    id: '50000000-0000-4000-8000-000000000402',
    person_id: '00000000-0000-4000-8000-000000000001',
    conversation_id: '30000000-0000-4000-8000-000000000402',
    source_turn_id: null,
    lineage_id: '50000000-0000-4000-8000-000000000402',
    version: 2,
    kind: 'brief',
    content: {
      title: 'Aethelios Lifestyle launch',
      purpose: 'Introduce the line.',
      audience: 'Founders',
      visualDirection: 'Obsidian and emerald',
      requirements: [],
      unresolved: [],
    },
    predecessor_id: null,
    superseded_by: null,
    created_at: '2026-10-15T03:00:00Z',
  };
  const workspace: TalkCreationWorkspace = {
    creations: [creation],
    selected: { brief: creation.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  expect(selectionChipLabel(describeSelectedWork(workspace, { creationId: creation.id, field: 'purpose' })!)).toBe(
    'Aethelios Lifestyle launch · v2 · Purpose',
  );
  expect(
    describeSelectedWork(workspace, { creationId: '50000000-0000-4000-8000-000000000499', field: 'purpose' })?.element,
  ).toBeUndefined();
});

it('keeps a brief Purpose target when a design board is also selected', () => {
  const board = selectDesignDirection(lifestyleLaunchBoard(), 'direction-c');
  const brief: TalkCreation = {
    id: '50000000-0000-4000-8000-000000000404',
    person_id: '00000000-0000-4000-8000-000000000001',
    conversation_id: '30000000-0000-4000-8000-000000000404',
    source_turn_id: null,
    lineage_id: '50000000-0000-4000-8000-000000000404',
    version: 2,
    kind: 'brief',
    content: {
      title: 'Aethelios Lifestyle launch',
      purpose: 'Introduce the line.',
      audience: 'Founders',
      visualDirection: 'Obsidian and emerald',
      requirements: [],
      unresolved: [],
    },
    predecessor_id: null,
    superseded_by: null,
    created_at: '2026-10-15T03:00:00Z',
  };
  const boardRow: TalkCreation = {
    ...brief,
    id: '50000000-0000-4000-8000-000000000405',
    lineage_id: '50000000-0000-4000-8000-000000000405',
    kind: 'board',
    version: 4,
    content: board,
  };
  const workspace: TalkCreationWorkspace = {
    creations: [brief, boardRow],
    selected: { brief: brief.id, board: boardRow.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  const resolved = resolveWorkTarget(workspace, { creationId: brief.id, field: 'purpose' });
  expect(resolved.status).toBe('active');
  expect(selectionChipLabel(resolved.item!)).toBe('Aethelios Lifestyle launch · v2 · Purpose');
  expect(workTargetVoiceText('Make this warmer.', resolved)).toBe(
    'Changing this: Aethelios Lifestyle launch · v2 · Purpose\nMake this warmer.',
  );
  expect(
    resolveWorkTarget(workspace, { creationId: '50000000-0000-4000-8000-000000000499', field: 'purpose' })
      .status,
  ).toBe('stale');
  expect(describeSelectedWork(workspace, null, brief.id)?.kind).toBe('brief');
});

it('treats a field target from another conversation as stale instead of rewriting local work', () => {
  const brief: TalkCreation = {
    id: '50000000-0000-4000-8000-000000000406',
    person_id: '00000000-0000-4000-8000-000000000001',
    conversation_id: '30000000-0000-4000-8000-000000000406',
    source_turn_id: null,
    lineage_id: '50000000-0000-4000-8000-000000000406',
    version: 1,
    kind: 'brief',
    content: {
      title: 'Aethelios Lifestyle launch',
      purpose: 'Introduce the line.',
      audience: 'Founders',
      visualDirection: 'Obsidian and emerald',
      requirements: [],
      unresolved: [],
    },
    predecessor_id: null,
    superseded_by: null,
    created_at: '2026-10-15T03:00:00Z',
  };
  const workspace: TalkCreationWorkspace = {
    creations: [brief],
    selected: { brief: brief.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  const resolved = resolveWorkTarget(
    workspace,
    { creationId: brief.id, field: 'purpose' },
    brief.id,
    '30000000-0000-4000-8000-000000000499',
  );
  expect(resolved.status).toBe('stale');
  expect(resolved.target).toBeNull();
  expect(resolved.reason).toMatch(/no longer current/);
});

it('rebinds a field target onto the current same-lineage version', () => {
  const prior: TalkCreation = {
    id: '50000000-0000-4000-8000-000000000407',
    person_id: '00000000-0000-4000-8000-000000000001',
    conversation_id: '30000000-0000-4000-8000-000000000407',
    source_turn_id: null,
    lineage_id: '50000000-0000-4000-8000-000000000407',
    version: 1,
    kind: 'brief',
    content: {
      title: 'Aethelios Lifestyle launch',
      purpose: 'Introduce the line.',
      audience: 'Founders',
      visualDirection: 'Obsidian and emerald',
      requirements: [],
      unresolved: [],
    },
    predecessor_id: null,
    superseded_by: '50000000-0000-4000-8000-000000000408',
    created_at: '2026-10-15T03:00:00Z',
  };
  const current: TalkCreation = {
    ...prior,
    id: '50000000-0000-4000-8000-000000000408',
    version: 2,
    predecessor_id: prior.id,
    superseded_by: null,
    content: { ...prior.content, purpose: 'Introduce the line with Emerald Glass.' },
  };
  const workspace: TalkCreationWorkspace = {
    creations: [prior, current],
    selected: { brief: current.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  const resolved = resolveWorkTarget(workspace, { creationId: prior.id, field: 'purpose' });
  expect(resolved.status).toBe('active');
  expect(resolved.target).toEqual({ creationId: current.id, field: 'purpose' });
  expect(selectionChipLabel(resolved.item!)).toBe('Aethelios Lifestyle launch · v2 · Purpose');
});

it('replaces a spoken field target instead of leaving the previous field in force', () => {
  const brief: TalkCreation = {
    id: '50000000-0000-4000-8000-000000000409',
    person_id: '00000000-0000-4000-8000-000000000001',
    conversation_id: '30000000-0000-4000-8000-000000000409',
    source_turn_id: null,
    lineage_id: '50000000-0000-4000-8000-000000000409',
    version: 2,
    kind: 'brief',
    content: {
      title: 'Aethelios Lifestyle launch',
      purpose: 'Introduce the line.',
      audience: 'Founders',
      visualDirection: 'Obsidian and emerald',
      requirements: [],
      unresolved: [],
    },
    predecessor_id: null,
    superseded_by: null,
    created_at: '2026-10-15T03:00:00Z',
  };
  const workspace: TalkCreationWorkspace = {
    creations: [brief],
    selected: { brief: brief.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  const purpose = spokenWorkTargetUpdate(
    resolveWorkTarget(workspace, { creationId: brief.id, field: 'purpose' }),
  );
  const audience = spokenWorkTargetUpdate(
    resolveWorkTarget(workspace, { creationId: brief.id, field: 'audience' }),
  );
  expect(purpose.status).toBe('active');
  expect(purpose.context).toContain('Exact target: purpose');
  expect(purpose.context).not.toContain('Exact target: audience');
  expect(audience.context).toContain('Exact target: audience');
  expect(audience.context).not.toContain('Exact target: purpose');
  expect(spokenWorkTargetUpdate(resolveWorkTarget(workspace, { creationId: '50000000-0000-4000-8000-000000000499', field: 'purpose' })).context).toMatch(/Ask which field/);
});

it('describes a bound Architect direction handoff without claiming unsupported work', () => {
  expect(
    describeTalkDestination({
      kind: 'architect-direction',
      sourceId: '50000000-0000-4000-8000-000000000403',
      sourceKind: 'board',
      sourceVersion: 4,
      sourceTitle: 'Emerald Glass',
      destination: 'Private Architect project',
      unsupported: ['Hero-product demonstration stays in Talk'],
      status: 'reviewable',
      snapshotBound: true,
    }),
  ).toBe(
    'Emerald Glass · board v4 → Private Architect project. Status: reviewable. Accepted snapshot is bound to this task. Unsupported: Hero-product demonstration stays in Talk.',
  );
});
