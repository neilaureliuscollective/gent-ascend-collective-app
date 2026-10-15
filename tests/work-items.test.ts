import { expect, it } from 'vitest';
import { describeSelectedWork, exportTalkDocument, selectionChipLabel } from '@/domains/work-items';
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
});
