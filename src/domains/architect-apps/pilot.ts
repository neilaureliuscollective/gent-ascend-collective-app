import { parseAppsImageDigest } from './commission';
import { APP_ACCEPTANCE_BUDGET } from './budget';
import { appsFounderPilotConfigured, appsGenerationPolicy } from './generation-policy';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type AppsPaidRuntimeEvidence = {
  schemaCompatible: boolean;
  workerPresent: boolean;
  observedDigest?: string | null;
  isolation?: 'docker' | 'unavailable';
  queueReady?: boolean;
  artifactsReady?: boolean;
  ageMs?: number | null;
  state?: 'idle' | 'working' | 'unavailable' | 'misconfigured';
};

export function appsPilotExecutionRequired(env: Env = process.env) {
  const policy = appsGenerationPolicy(env);
  return policy.production || policy.founderPilot || policy.mode === 'openai';
}

export function appsPilotExecutionBlockers(env: Env = process.env) {
  const policy = appsGenerationPolicy(env);
  const blockers: string[] = [];
  if (policy.mode === 'refused') blockers.push(policy.reason);
  if (policy.production && !appsFounderPilotConfigured(env))
    blockers.push(
      'Architect executable work stays off until ARCHITECT_APPS_FOUNDER_PILOT is commissioned. Ownership of a project is not founder entitlement.',
    );
  return blockers;
}

const closedPaidRuntime = (): AppsPaidRuntimeEvidence => ({
  schemaCompatible: false,
  workerPresent: false,
  observedDigest: null,
  isolation: 'unavailable',
  queueReady: false,
  artifactsReady: false,
  ageMs: null,
  state: 'unavailable',
});

export function paidRuntimeFromWorkerReadiness(row: unknown): AppsPaidRuntimeEvidence {
  if (!row || typeof row !== 'object') return closedPaidRuntime();
  const data = row as Record<string, unknown>;
  const missing = Array.isArray(data.missing) ? data.missing.map(String) : [];
  const digest = typeof data.digest === 'string' ? data.digest : null;
  const state =
    data.state === 'idle' || data.state === 'working' || data.state === 'unavailable' || data.state === 'misconfigured'
      ? data.state
      : missing.includes('worker')
        ? 'unavailable'
        : undefined;
  return {
    schemaCompatible: data.schema_ok === true,
    workerPresent: Boolean(digest) && !missing.includes('worker'),
    observedDigest: digest,
    isolation: data.isolation === 'docker' ? 'docker' : 'unavailable',
    queueReady: data.queue_ok === true,
    artifactsReady: data.artifacts_ok === true,
    ageMs: typeof data.age_ms === 'number' ? data.age_ms : typeof data.ageMs === 'number' ? data.ageMs : null,
    state,
  };
}

export async function readPaidGenerationRuntime(client: {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}): Promise<AppsPaidRuntimeEvidence> {
  try {
    const probed = await client.rpc('architect_apps_worker_readiness', {
      p_max_age: Math.floor(APP_ACCEPTANCE_BUDGET.heartbeatMaxAgeMs / 1000),
    });
    if (probed.error || !probed.data) return closedPaidRuntime();
    return paidRuntimeFromWorkerReadiness(probed.data);
  } catch {
    return closedPaidRuntime();
  }
}

export function classifyPaidGenerationReadiness(
  evidence: AppsPaidRuntimeEvidence,
  env: Env = process.env,
): { ok: boolean; reason: string; missing: string[]; class: 'worker' } {
  const missing: string[] = [];
  const expected = parseAppsImageDigest(env.ARCHITECT_APPS_IMAGE_DIGEST);
  if (!evidence.schemaCompatible) missing.push('schema');
  if (!evidence.workerPresent) missing.push('worker');
  if (evidence.isolation !== 'docker') missing.push('isolation');
  if (evidence.queueReady !== true) missing.push('queue');
  if (evidence.artifactsReady !== true) missing.push('artifacts');
  if (!expected) missing.push('ARCHITECT_APPS_IMAGE_DIGEST');
  else if (parseAppsImageDigest(evidence.observedDigest) !== expected) missing.push('image-digest');
  if (typeof evidence.ageMs !== 'number' || !Number.isFinite(evidence.ageMs) || evidence.ageMs < 0 || evidence.ageMs > APP_ACCEPTANCE_BUDGET.heartbeatMaxAgeMs) missing.push('heartbeat');
  if (evidence.state !== 'idle' && evidence.state !== 'working') missing.push('worker-state');
  if (missing.length) {
    return {
      ok: false,
      class: 'worker',
      missing,
      reason: `Paid generation is unavailable until the commissioned worker is ready (${missing.join(', ')}). No model request was sent.`,
    };
  }
  return { ok: true, class: 'worker', missing: [], reason: 'Commissioned worker is present for compile and artifact retention.' };
}
