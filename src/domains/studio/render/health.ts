import { RENDER_LIMITS } from './limits';

export type WorkerHealthStatus = 'ok' | 'degraded' | 'unavailable' | 'stopping';

export function workerIdentity(env: Record<string, string | undefined> = process.env) {
  const value = env.STUDIO_RENDER_IDENTITY?.trim();
  return value ? value.slice(0, 120) : null;
}

export function classifyHealth(input: {
  stopping: boolean;
  preflightOk: boolean;
  lastQueueOkAt: number | null;
  lastQueueError: string | null;
  identity: string | null;
  now?: number;
}): { status: WorkerHealthStatus; http: number; reason: string } {
  if (input.stopping) return { status: 'stopping', http: 503, reason: 'Worker is draining.' };
  if (!input.preflightOk) return { status: 'unavailable', http: 503, reason: 'Renderer preflight failed.' };
  const now = input.now ?? Date.now();
  const recent = Boolean(input.lastQueueOkAt && now - input.lastQueueOkAt <= RENDER_LIMITS.queueFreshMs);
  if (!recent && input.lastQueueError)
    return {
      status: 'unavailable',
      http: 503,
      reason: 'Queue/database connectivity has not succeeded recently.',
    };
  if (!recent)
    return {
      status: 'degraded',
      http: 503,
      reason: 'No recent queue/database contact. Startup binaries alone are not readiness.',
    };
  if (input.lastQueueError)
    return { status: 'degraded', http: 503, reason: 'Recent queue/database error.' };
  if (!input.identity)
    return {
      status: 'degraded',
      http: 503,
      reason: 'STUDIO_RENDER_IDENTITY is unset. A commissioned flag is not a deployment identity.',
    };
  return {
    status: 'ok',
    http: 200,
    reason: 'Preflight and recent queue contact succeeded. Hosted commissioning remains a separate founder action.',
  };
}
