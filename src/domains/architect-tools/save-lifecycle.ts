import type { EstimatorConfig } from './engine';
import { sameJsonValue } from './json';
import { estimatorConfigSchema } from './schema';

export type ToolSaveSnapshot = {
  ownerId: string;
  projectId: string;
  toolId: string;
  expected: number;
  requestId: string;
  name: string;
  configuration: EstimatorConfig;
  note: string;
};

export type ToolSaveReceipt = {
  personId: string;
  toolId: string;
  requestId: string;
  revision: number;
};

export function normalizeEstimatorConfig(config: EstimatorConfig): EstimatorConfig {
  return estimatorConfigSchema.parse(config);
}

export function snapshotEqual(left: ToolSaveSnapshot, right: Pick<ToolSaveSnapshot, 'name' | 'configuration' | 'note'>) {
  return (
    left.name === right.name &&
    left.note === right.note &&
    sameJsonValue(left.configuration, right.configuration)
  );
}

export function beginOrRetryToolSave(input: {
  pending: ToolSaveSnapshot | null;
  ownerId: string;
  projectId: string;
  toolId: string | null;
  expected: number;
  name: string;
  configuration: EstimatorConfig;
  note: string;
  nextIds: { toolId: string; requestId: string };
}): { snapshot: ToolSaveSnapshot; reused: boolean } {
  if (input.pending) {
    if (input.pending.ownerId !== input.ownerId || input.pending.projectId !== input.projectId)
      throw new Error('Pending save belongs to another owner or project.');
    return { snapshot: input.pending, reused: true };
  }
  return {
    reused: false,
    snapshot: {
      ownerId: input.ownerId,
      projectId: input.projectId,
      toolId: input.toolId ?? input.nextIds.toolId,
      expected: input.expected,
      requestId: input.nextIds.requestId,
      name: input.name.trim(),
      configuration: normalizeEstimatorConfig(input.configuration),
      note: input.note.trim(),
    },
  };
}

export function findCommittedToolSave(
  versions: Array<{ id: string; tool_id: string; project_id: string; person_id: string; revision: number; name: string; configuration: EstimatorConfig; note: string }>,
  pending: ToolSaveSnapshot,
) {
  return (
    versions.find(
      (version) =>
        version.id === pending.requestId &&
        version.tool_id === pending.toolId &&
        version.project_id === pending.projectId &&
        version.person_id === pending.ownerId &&
        version.revision === pending.expected + 1 &&
        version.name === pending.name &&
        version.note === pending.note &&
        sameJsonValue(version.configuration, pending.configuration),
    ) ?? null
  );
}

export function acceptToolSaveReceipt(input: {
  pending: ToolSaveSnapshot;
  receipt: ToolSaveReceipt;
  currentOwnerId: string;
  currentProjectId: string;
  currentName: string;
  currentConfiguration: EstimatorConfig;
}): { status: 'applied' | 'ignored-stale-scope'; pendingCleared: boolean; draftStillUnsaved: boolean; expected: number } {
  const scoped =
    input.receipt.personId === input.pending.ownerId &&
    input.receipt.toolId === input.pending.toolId &&
    input.receipt.requestId === input.pending.requestId &&
    input.currentOwnerId === input.pending.ownerId &&
    input.currentProjectId === input.pending.projectId;
  if (!scoped) return { status: 'ignored-stale-scope', pendingCleared: false, draftStillUnsaved: true, expected: input.pending.expected };
  return {
    status: 'applied',
    pendingCleared: true,
    expected: input.receipt.revision,
    draftStillUnsaved:
      input.currentName !== input.pending.name ||
      !sameJsonValue(input.currentConfiguration, input.pending.configuration),
  };
}

export function replayPayloadChanged(pending: ToolSaveSnapshot, next: { name: string; configuration: EstimatorConfig; note: string }) {
  return !snapshotEqual(pending, next);
}

export function isToolDraftDirty(input: {
  pending: boolean;
  hydrated: boolean;
  baseline: { name: string; configuration: EstimatorConfig } | null;
  name: string;
  configuration: EstimatorConfig;
  restoredDirty: boolean;
}) {
  if (input.pending) return true;
  if (!input.hydrated) return false;
  if (input.baseline)
    return input.name !== input.baseline.name || !sameJsonValue(input.configuration, input.baseline.configuration);
  return input.restoredDirty;
}

export function toolLibraryRefreshFollowUp(input: { writeConfirmed: boolean; libraryRefreshed: boolean }) {
  if (!input.writeConfirmed) return { pending: true, refreshNeeded: false, retryCommittedWrite: true };
  if (!input.libraryRefreshed) return { pending: false, refreshNeeded: true, retryCommittedWrite: false };
  return { pending: false, refreshNeeded: false, retryCommittedWrite: false };
}
