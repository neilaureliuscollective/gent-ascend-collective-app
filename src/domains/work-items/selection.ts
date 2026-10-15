import type { TalkCreation, TalkCreationWorkspace } from '@/domains/talk-creation/schema';
import { creationTitle } from '@/domains/talk-creation/schema';
import { selectedDirection } from '@/domains/talk-creation/design-board';
import type { WorkItemRef } from './kinds';
import { talkFieldLabel } from './document';

export function describeSelectedWork(
  workspace: TalkCreationWorkspace | null,
  target?: { creationId: string; field: string } | null,
): WorkItemRef | null {
  if (!workspace) return null;
  const selectedId =
    workspace.selected.board ||
    workspace.selected.brief ||
    workspace.selected.plan ||
    workspace.selected.palette;
  const creation = workspace.creations.find((item) => item.id === selectedId && !item.superseded_by);
  if (creation) {
    const described = describeCreation(creation);
    if (target?.creationId === described.id) return { ...described, element: talkFieldLabel(target.field) };
    return described;
  }
  const image = workspace.images.find((item) => item.id === workspace.selectedImageId);
  if (!image) return null;
  return {
    source: 'artifact',
    kind: 'image',
    id: image.id,
    conversationId: image.conversation_id,
    title: image.prompt.slice(0, 80) || 'Talk image',
    element: image.status,
  };
}

export function describeCreation(creation: TalkCreation): WorkItemRef {
  const title = creationTitle(creation);
  const element =
    creation.kind === 'board' && 'directions' in creation.content
      ? selectedDirection(creation.content).name
      : undefined;
  return {
    source: 'talk',
    kind: creation.kind === 'handoff' ? 'handoff' : creation.kind,
    id: creation.id,
    lineageId: creation.lineage_id,
    version: creation.version,
    conversationId: creation.conversation_id,
    title,
    element,
  };
}

export function selectionChipLabel(item: WorkItemRef) {
  const version = item.version ? ` · v${item.version}` : '';
  const element = item.element ? ` · ${item.element}` : '';
  return `${item.title}${version}${element}`;
}
