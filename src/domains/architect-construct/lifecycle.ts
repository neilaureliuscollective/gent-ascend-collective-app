import {
  CONSTRUCT_ISOLATION,
  CONSTRUCT_RUN_STATUSES,
  type ConstructIsolation,
  type ConstructRunStatus,
} from '@/domains/architect-origin/preview-contract';

export const IN_FLIGHT_STATUSES = ['queued', 'claimed', 'running'] as const;
export type InFlightStatus = (typeof IN_FLIGHT_STATUSES)[number];

export type ConstructLifecyclePhase =
  | 'idle'
  | 'queued'
  | 'claimed'
  | 'running'
  | 'canceled'
  | 'failed'
  | 'completed'
  | 'blocked';

export function isConstructRunStatus(value: string | undefined): value is ConstructRunStatus {
  return !!value && (CONSTRUCT_RUN_STATUSES as readonly string[]).includes(value);
}

export function isConstructIsolation(value: string | undefined): value is ConstructIsolation {
  return !!value && (CONSTRUCT_ISOLATION as readonly string[]).includes(value);
}

export function isInFlightStatus(status: string | undefined): status is InFlightStatus {
  return !!status && (IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

export function lifecyclePhase(status: string | undefined): ConstructLifecyclePhase {
  if (status === 'queued') return 'queued';
  if (status === 'claimed') return 'claimed';
  if (status === 'running') return 'running';
  if (status === 'cancelled') return 'canceled';
  if (status === 'failed' || status === 'timed_out') return 'failed';
  if (status === 'succeeded') return 'completed';
  if (status === 'blocked') return 'blocked';
  return 'idle';
}

export function lifecycleLabel(phase: ConstructLifecyclePhase) {
  switch (phase) {
    case 'queued':
      return 'Queued. Waiting for an external worker to claim the run.';
    case 'claimed':
      return 'Claimed. A worker holds the lease and has not started isolated execution.';
    case 'running':
      return 'Running. Isolated execution is in progress.';
    case 'canceled':
      return 'Canceled. The owner requested cancellation.';
    case 'failed':
      return 'Failed. Inspect recorded checks and the blocker; the browser cannot mark this passed.';
    case 'completed':
      return 'Completed. Output is bound to the recorded revision and hashes.';
    case 'blocked':
      return 'Blocked. Missing source, isolation, or approval prevented execution.';
    default:
      return 'No Construct run is in progress for this project.';
  }
}

export function isProcessFixtureIsolation(isolation: string | undefined) {
  return isolation === 'process-fixture';
}

export function runningServerPreviewAvailable() {
  return false;
}

export function runningServerPreviewReason(isolation?: string | null) {
  if (isolation === 'process-fixture') {
    return 'Process-fixture output is labelled test output. It is not a running isolated server and is not proof of an isolated AI build.';
  }
  if (isolation === 'docker') {
    return 'Isolated Docker execution produced static files only. A running-server preview is not offered because no supported isolated application runtime exists.';
  }
  return 'Running-server preview is unavailable. Only isolated static HTML is offered when a trusted receipt exists.';
}

export function fixtureOutputCaption(revision: number) {
  return `Labelled fixture test output — not an isolated AI build · Revision ${revision}`;
}
