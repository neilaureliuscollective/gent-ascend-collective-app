import { expect, it } from 'vitest';
import {
  compareTalkRevisions,
  compileTalkDocument,
  describeSelectedWork,
  describeTalkDestination,
  exportTalkDocument,
  selectionChipLabel,
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
