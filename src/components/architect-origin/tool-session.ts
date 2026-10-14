import type { EstimatorConfig } from '@/domains/architect-tools/engine';
import type { ToolSaveSnapshot } from '@/domains/architect-tools/save-lifecycle';

export type ToolSessionDraft = {
  ownerId: string;
  projectId: string;
  toolId: string | null;
  name: string;
  draft: EstimatorConfig;
  expected: number;
  pending: ToolSaveSnapshot | null;
  selectedRevision: number | null;
  generation: number;
  dirty: boolean;
};

export type ToolWorkspaceState = {
  dirty: boolean;
  pending: boolean;
  expected: number;
  persist: () => Promise<void>;
  refresh?: () => Promise<void>;
  refreshNeeded?: boolean;
};

const memory = new Map<string, ToolSessionDraft>();

export function toolSessionKey(ownerId: string, projectId: string) {
  return `${ownerId}:${projectId}`;
}

export function readToolSession(ownerId: string, projectId: string): ToolSessionDraft | null {
  const key = toolSessionKey(ownerId, projectId);
  const live = memory.get(key);
  if (live) return live;
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`architect-origin-tool:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ToolSessionDraft;
    if (parsed.ownerId !== ownerId || parsed.projectId !== projectId) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeToolSession(draft: ToolSessionDraft) {
  const key = toolSessionKey(draft.ownerId, draft.projectId);
  memory.set(key, draft);
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`architect-origin-tool:${key}`, JSON.stringify(draft));
  } catch {
    // Tab storage is optional; server save is the durable record.
  }
}

export function clearToolSessionsForOwner(ownerId: string) {
  for (const [key, value] of memory) {
    if (value.ownerId !== ownerId) {
      memory.delete(key);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(`architect-origin-tool:${key}`);
    }
  }
}

export function clearToolSession(ownerId: string, projectId: string) {
  const key = toolSessionKey(ownerId, projectId);
  memory.delete(key);
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(`architect-origin-tool:${key}`);
}
