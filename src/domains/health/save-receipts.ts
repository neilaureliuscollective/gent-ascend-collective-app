import type { HealthWorkspaceRecord } from './workspace-model';

export type HealthSendResult =
  | { status: 'confirmed' }
  | { status: 'failed'; message: string }
  | { status: 'uncertain'; message: string }
  | { status: 'ignored'; message: string };

export type WorkspaceEpoch = {
  owner: string | null;
  workspaceId: string | null;
  generation: number;
};

export function nextEpoch(current: WorkspaceEpoch, workspaceId: string | null): WorkspaceEpoch {
  return { ...current, workspaceId, generation: current.generation + 1 };
}

export function sameFence(current: WorkspaceEpoch, expected: WorkspaceEpoch) {
  return (
    current.owner === expected.owner &&
    current.workspaceId === expected.workspaceId &&
    current.generation === expected.generation
  );
}

export function shouldClearDraft(
  draft: HealthWorkspaceRecord | null,
  sentId: string,
  sentGeneration: number,
  currentGeneration: number,
  result: HealthSendResult,
) {
  return (
    result.status === 'confirmed' &&
    Boolean(draft) &&
    draft!.id === sentId &&
    sentGeneration === currentGeneration
  );
}

export function copyIncludesDraft(dirty: boolean, signedIn: boolean) {
  return dirty && signedIn;
}

export function canLeaveAfterSave(result: HealthSendResult) {
  return result.status === 'confirmed';
}
