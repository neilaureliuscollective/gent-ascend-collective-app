import {
  bindPreviewIdentity,
  CONSTRUCT_ISOLATION,
  CONSTRUCT_RUN_STATUSES,
  decideConstructPreview,
  isPreviewHash,
  isPreviewUuid,
  type ConstructIsolation,
  type ConstructPreviewShape,
  type ConstructRunStatus,
  type PreviewDecision,
  type PreviewIdentity,
} from '@/domains/architect-origin/preview-contract';

/**
 * Narrow client adapter for Construct receipts.
 * Missing route, 404 or malformed payload → unavailable. No second backend.
 * Start / poll / cancel live in `construct-lifecycle.ts`.
 */
export type ConstructLibraryEnvelope = {
  project?: { id?: string; revision?: number; name?: string };
  runs?: Array<{
    id?: string;
    person_id?: string;
    project_id?: string;
    project_revision?: number;
    source_tree_hash?: string;
    source_kind?: string;
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

type ConstructRunRecord = NonNullable<ConstructLibraryEnvelope['runs']>[number];

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
    persisted: true,
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

function isRunStatus(value: string | undefined): value is ConstructRunStatus {
  return !!value && (CONSTRUCT_RUN_STATUSES as readonly string[]).includes(value);
}

function isIsolation(value: string | undefined): value is ConstructIsolation {
  return !!value && (CONSTRUCT_ISOLATION as readonly string[]).includes(value);
}

function hasRequiredIdentity(run: ConstructRunRecord): boolean {
  return (
    isPreviewUuid(run.id) &&
    isPreviewUuid(run.person_id) &&
    isPreviewUuid(run.project_id) &&
    Number.isInteger(run.project_revision) &&
    (run.project_revision ?? 0) >= 1 &&
    (run.project_revision ?? 0) <= 500 &&
    isRunStatus(run.status) &&
    isPreviewHash(run.source_tree_hash)
  );
}

function matchesRequestedOwnerProject(run: ConstructRunRecord, identity: PreviewIdentity): boolean {
  return run.person_id === identity.ownerId && run.project_id === identity.projectId;
}

function trustedPreviewFromRun(
  run: ConstructRunRecord,
  identity: PreviewIdentity,
): PreviewDecision | null {
  if (!hasRequiredIdentity(run) || !matchesRequestedOwnerProject(run, identity)) return null;
  if (run.status !== 'succeeded' || !run.result) return null;
  if (!isIsolation(run.result.isolation) || run.result.isolation === 'unavailable') return null;
  if (!isPreviewHash(run.result.source_hash)) return null;
  if (run.result.result_hash && !isPreviewHash(run.result.result_hash)) return null;
  if (run.source_tree_hash && !isPreviewHash(run.source_tree_hash)) return null;
  if (run.source_tree_hash && run.source_tree_hash !== run.result.source_hash) return null;
  const bound = bindPreviewIdentity({
    projectId: identity.projectId,
    ownerId: identity.ownerId,
    revision: run.project_revision!,
    artifactId: run.id,
    sourceHash: run.result.source_hash,
    resultHash: run.result.result_hash ?? null,
    persisted: true,
  });
  if (!bound) return null;
  const decided = decideConstructPreview({
    identity: bound,
    preview: run.result.preview,
    ownerMatches: true,
    projectMatches: true,
    isolation: run.result.isolation,
    staleSuccess: run.project_revision !== identity.revision,
  });
  return decided.kind === 'unavailable' ? null : decided;
}

/**
 * Pick a Construct receipt by required identity, status, isolation and hashes.
 * Never treat missing IDs as a match, never stamp caller hashes onto a foreign run,
 * and never default to runs[0].
 */
export function selectTrustedConstructReceipt(
  library: ConstructLibraryEnvelope,
  identity: PreviewIdentity,
):
  | { status: 'ready'; decision: PreviewDecision }
  | { status: 'pending'; reason: string }
  | { status: 'rejected'; reason: string } {
  if (!identity.ownerId) {
    return { status: 'rejected', reason: 'Preview owner is unknown; Construct receipt ignored.' };
  }
  if (!library.project?.id || library.project.id !== identity.projectId) {
    return { status: 'rejected', reason: 'Construct library is not bound to this project.' };
  }
  const runs = library.runs ?? [];
  if (!runs.length) return { status: 'rejected', reason: 'No Construct preview is attached.' };

  const identified = runs.filter(hasRequiredIdentity);
  if (!identified.length) {
    return { status: 'rejected', reason: 'Construct receipt is missing required identity.' };
  }

  const owned = identified.filter((run) => matchesRequestedOwnerProject(run, identity));
  if (!owned.length) {
    return {
      status: 'rejected',
      reason: identified.some((run) => run.person_id !== identity.ownerId)
        ? 'Preview is bound to another owner.'
        : 'Preview is bound to a different project.',
    };
  }

  const atRevision = owned.filter((run) => run.project_revision === identity.revision);
  const exact = atRevision
    .map((run) => trustedPreviewFromRun(run, identity))
    .find((decision): decision is PreviewDecision => !!decision);
  if (exact) return { status: 'ready', decision: exact };

  const inFlight = atRevision.find((run) =>
    ['queued', 'claimed', 'running'].includes(run.status ?? ''),
  );
  const older = owned
    .filter((run) => (run.project_revision ?? 0) < identity.revision)
    .sort((a, b) => (b.project_revision ?? 0) - (a.project_revision ?? 0))
    .map((run) => trustedPreviewFromRun(run, identity))
    .find((decision): decision is PreviewDecision => !!decision);
  if (older) return { status: 'ready', decision: older };
  if (inFlight) {
    return {
      status: 'pending',
      reason: `Construct run is recorded as ${inFlight.status}. Progress comes from durable events; the browser cannot mark checks passed.`,
    };
  }
  return { status: 'rejected', reason: 'No trusted Construct preview matches this revision.' };
}

export function decideFromLibrary(
  library: ConstructLibraryEnvelope,
  identity: PreviewIdentity,
): PreviewDecision {
  const selected = selectTrustedConstructReceipt(library, identity);
  if (selected.status === 'ready') return selected.decision;
  return {
    kind: 'unavailable',
    reason: selected.reason,
    identity,
  };
}
