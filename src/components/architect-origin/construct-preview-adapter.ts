import {
  bindPreviewIdentity,
  decideConstructPreview,
  type ConstructPreviewShape,
  type PreviewDecision,
  type PreviewIdentity,
} from '@/domains/architect-origin/preview-contract';

/**
 * Narrow client adapter for PR #116 Construct receipts.
 * Missing route, 404 or malformed payload → unavailable. No second backend.
 */
export type ConstructLibraryEnvelope = {
  project?: { id?: string; revision?: number; name?: string };
  runs?: Array<{
    id?: string;
    person_id?: string;
    project_id?: string;
    project_revision?: number;
    source_tree_hash?: string;
    status?: string;
    result?: {
      source_hash?: string;
      result_hash?: string | null;
      isolation?: string;
      runtime_available?: boolean;
      sandbox?: boolean;
      blocker?: string | null;
      checks?: Array<{
        name: string;
        status: string;
        command: string;
        exit_code: number;
        log: string;
      }>;
      changed_files?: string[];
      diff?: string;
      preview?: ConstructPreviewShape | null;
    } | null;
  }>;
};

export type ConstructAdapterStatus =
  | { state: 'idle' }
  | { state: 'unavailable'; reason: string }
  | { state: 'ready'; library: ConstructLibraryEnvelope; decision: PreviewDecision };

export async function readConstructPreview(input: {
  projectId: string;
  ownerId: string | null;
  revision: number;
  signal?: AbortSignal;
}): Promise<ConstructAdapterStatus> {
  const identity = bindPreviewIdentity({
    projectId: input.projectId,
    ownerId: input.ownerId,
    revision: input.revision,
  });
  if (!identity) return { state: 'unavailable', reason: 'Preview identity is incomplete.' };
  try {
    const response = await fetch(
      `/api/architect-construct?project=${encodeURIComponent(input.projectId)}`,
      { cache: 'no-store', signal: input.signal ?? AbortSignal.timeout(15000) },
    );
    if (response.status === 404) {
      return {
        state: 'unavailable',
        reason: 'Construct execution is not in this checkout. Preview uses Origin artifacts only.',
      };
    }
    const data = (await response.json()) as ConstructLibraryEnvelope & { error?: string };
    if (!response.ok) {
      return { state: 'unavailable', reason: data.error || 'Construct receipts unavailable.' };
    }
    return { state: 'ready', library: data, decision: decideFromLibrary(data, identity) };
  } catch (error) {
    return {
      state: 'unavailable',
      reason: error instanceof Error ? error.message : 'Construct receipts unavailable.',
    };
  }
}

export function decideFromLibrary(
  library: ConstructLibraryEnvelope,
  identity: PreviewIdentity,
): PreviewDecision {
  const run = library.runs?.[0];
  const ownerMatches = !run?.person_id || run.person_id === identity.ownerId;
  const projectMatches = !run?.project_id || run.project_id === identity.projectId;
  return decideConstructPreview({
    identity: {
      ...identity,
      sourceHash: run?.result?.source_hash ?? run?.source_tree_hash ?? identity.sourceHash,
      resultHash: run?.result?.result_hash ?? identity.resultHash,
      revision: run?.project_revision ?? identity.revision,
    },
    preview: run?.result?.preview,
    ownerMatches,
    projectMatches,
  });
}
