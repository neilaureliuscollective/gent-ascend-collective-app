import {
  decideFromLibrary,
  selectTrustedConstructReceipt,
  type ConstructLibraryEnvelope,
} from './construct-preview-adapter';
import {
  IN_FLIGHT_STATUSES,
  isInFlightStatus,
  lifecycleLabel,
  lifecyclePhase,
  type ConstructLifecyclePhase,
} from '@/domains/architect-construct/lifecycle';
import {
  bindPreviewIdentity,
  retainHeldPreview,
  type PreviewDecision,
} from '@/domains/architect-origin/preview-contract';

export type ConstructLifecycleLibrary = ConstructLibraryEnvelope & {
  events?: Record<string, Array<{ id?: string; kind?: string; detail?: string }>>;
  briefs?: Array<{ id?: string; scope?: { intended_change?: string; project_revision?: number } }>;
  sources?: Array<{ id?: string; kind?: string; label?: string; repository?: string | null }>;
};

export type ConstructSourceReadiness = {
  access: 'read-only';
  publishing: false;
  deployment: false;
  github: {
    ready: boolean;
    repository: { fullName: string } | null;
    reason: string;
  };
  vercel: {
    ready: boolean;
    project: { name: string } | null;
    reason: string;
  };
};

export type ConstructLifecycleView = {
  phase: ConstructLifecyclePhase;
  building: boolean;
  label: string;
  requestId: string | null;
  current: NonNullable<ConstructLifecycleLibrary['runs']>[number] | null;
  lastSuccess: NonNullable<ConstructLifecycleLibrary['runs']>[number] | null;
  decision: PreviewDecision | null;
  generation: number;
};

type FetchLike = typeof fetch;

async function constructJson<T>(
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const response = await fetchImpl(url, { cache: 'no-store', ...init });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.error || 'Construct request unavailable.',
      };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Construct request unavailable.',
    };
  }
}

export async function readConstructLibrary(
  projectId: string,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
) {
  return constructJson<ConstructLifecycleLibrary>(
    `/api/architect-construct?project=${encodeURIComponent(projectId)}`,
    { signal: signal ?? AbortSignal.timeout(15000) },
    fetchImpl,
  );
}

export async function startConstructFixture(
  input: { projectId: string; requestId: string; expected: number },
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
) {
  return constructJson<{ run: NonNullable<ConstructLifecycleLibrary['runs']>[number] }>(
    '/api/architect-construct',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal ?? AbortSignal.timeout(20000),
      body: JSON.stringify({
        action: 'start-fixture',
        projectId: input.projectId,
        requestId: input.requestId,
        expected: input.expected,
      }),
    },
    fetchImpl,
  );
}

export async function startConstructRun(
  input: { projectId: string; briefId: string; requestId: string; expected: number },
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
) {
  return constructJson<{ run: NonNullable<ConstructLifecycleLibrary['runs']>[number] }>(
    '/api/architect-construct',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal ?? AbortSignal.timeout(20000),
      body: JSON.stringify({
        action: 'start',
        projectId: input.projectId,
        briefId: input.briefId,
        requestId: input.requestId,
        expected: input.expected,
      }),
    },
    fetchImpl,
  );
}

export async function cancelConstructRun(
  input: { projectId: string; runId: string },
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
) {
  return constructJson<{ run: NonNullable<ConstructLifecycleLibrary['runs']>[number] }>(
    '/api/architect-construct',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal ?? AbortSignal.timeout(20000),
      body: JSON.stringify({
        action: 'cancel',
        projectId: input.projectId,
        runId: input.runId,
      }),
    },
    fetchImpl,
  );
}

export async function readConstructSource(
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
) {
  return constructJson<ConstructSourceReadiness>(
    '/api/architect-construct/source',
    { signal: signal ?? AbortSignal.timeout(15000) },
    fetchImpl,
  );
}

export function selectCurrentRun(
  library: ConstructLifecycleLibrary | null,
  projectId: string,
  ownerId: string | null,
) {
  const runs = (library?.runs ?? []).filter(
    (run) => run.project_id === projectId && (!ownerId || run.person_id === ownerId),
  );
  const inFlight = runs.find((run) => isInFlightStatus(run.status));
  return inFlight ?? runs[0] ?? null;
}

export function selectLastSuccessfulRun(
  library: ConstructLifecycleLibrary | null,
  projectId: string,
  ownerId: string | null,
) {
  return (
    (library?.runs ?? []).find(
      (run) =>
        run.project_id === projectId &&
        (!ownerId || run.person_id === ownerId) &&
        run.status === 'succeeded' &&
        run.result?.result_hash,
    ) ?? null
  );
}

export function viewConstructLifecycle(input: {
  library: ConstructLifecycleLibrary | null;
  projectId: string;
  ownerId: string | null;
  revision: number;
  generation: number;
  held?: PreviewDecision | null;
}): ConstructLifecycleView {
  const identity = bindPreviewIdentity({
    projectId: input.projectId,
    ownerId: input.ownerId,
    revision: input.revision,
    persisted: true,
  });
  const current = selectCurrentRun(input.library, input.projectId, input.ownerId);
  const lastSuccess = selectLastSuccessfulRun(input.library, input.projectId, input.ownerId);
  const phase = lifecyclePhase(current?.status);
  let decision: PreviewDecision | null = null;
  if (input.library && identity) {
    const selected = selectTrustedConstructReceipt(input.library, identity);
    if (selected.status === 'ready') decision = selected.decision;
    else
      decision = decideFromLibrary(input.library, identity);
  }
  decision = retainHeldPreview(decision ?? input.held, input.projectId, input.ownerId) ?? decision;
  return {
    phase,
    building: IN_FLIGHT_STATUSES.includes(phase as (typeof IN_FLIGHT_STATUSES)[number]),
    label: lifecycleLabel(phase),
    requestId: current?.id ?? null,
    current,
    lastSuccess,
    decision,
    generation: input.generation,
  };
}

export function newerGeneration(previous: number, incoming: number) {
  return incoming >= previous;
}
