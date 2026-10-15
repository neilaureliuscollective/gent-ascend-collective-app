import { parseEnvironment } from '@/platform/environment';
import { supabaseConnection } from '@/platform/supabase/connection';
import { appsGenerationPolicy } from './generation-policy';
import {
  probeAppsSchemaCompatibility as probeSchemaContracts,
  requiredAppsSchemaContracts,
} from './schema-probe';

export {
  classifySchemaProbeError,
  probeAppsSchemaCompatibility,
  probeAppsSchemaFromClient,
  requiredAppsSchemaContracts,
  tableKeyColumn,
} from './schema-probe';
export type { AppsSchemaProbe, AppsSchemaProbeClassification } from './schema-probe';

export function parseAppsImageDigest(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return /^sha256:[a-f0-9]{64}$/.test(trimmed) ? trimmed : null;
}

function flagsReady(env: Env) {
  return env.ARCHITECT_ORIGIN_ENABLED === 'true' && env.ARCHITECT_APPS_ENABLED === 'true';
}

function controlPlaneReady(env: Env) {
  try {
    return Boolean(supabaseConnection(env) && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  } catch {
    return false;
  }
}

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export const APPS_DEPLOYMENT_MODES = ['local', 'preview', 'commissioned', 'closed'] as const;
export type AppsDeploymentMode = (typeof APPS_DEPLOYMENT_MODES)[number];
export const APPS_WORKER_HEALTH_STATES = ['idle', 'working', 'unavailable', 'misconfigured'] as const;
export type AppsWorkerHealthState = (typeof APPS_WORKER_HEALTH_STATES)[number];

export const requiredAppsSchemaNames = {
  tables: Object.keys(requiredAppsSchemaContracts.tables),
  rpcs: [...requiredAppsSchemaContracts.rpcs],
} as const;

const processBootId = `${process.pid.toString(16)}-${Date.now().toString(16)}`;

export function appsProcessIdentity(env: Env = process.env) {
  const named = env.ARCHITECT_APPS_PROCESS_ID?.trim();
  return {
    processId: named || `apps-web-${processBootId}`,
    bootId: env.ARCHITECT_APPS_BOOT_ID?.trim() || processBootId,
  };
}

export function appsWorkerIdentity(env: Env = process.env) {
  const named = env.ARCHITECT_APPS_WORKER_ID?.trim() || env.ARCHITECT_CONSTRUCT_WORKER_ID?.trim() || 'apps-worker';
  return `${named}-${process.pid}`;
}

export function hostedWorkerPlaneForbidden(env: Env = process.env) {
  return Boolean(env.VERCEL || env.VERCEL_ENV);
}

export function appsDeploymentMode(env: Env = process.env): AppsDeploymentMode {
  const explicit = env.ARCHITECT_APPS_DEPLOYMENT_MODE?.trim();
  try {
    const parsed = parseEnvironment(env);
    if (parsed.mode === 'production') return explicit === 'commissioned' ? 'commissioned' : 'closed';
    if (explicit === 'commissioned' || explicit === 'local' || explicit === 'preview' || explicit === 'closed')
      return explicit;
    if (parsed.mode === 'preview') return 'preview';
    return 'local';
  } catch {
    return 'closed';
  }
}

export function appsWorkerConcurrency(env: Env = process.env) {
  if (appsDeploymentMode(env) === 'commissioned') return 1;
  const raw = Number(env.ARCHITECT_APPS_MAX_CONCURRENCY ?? 1);
  return Number.isInteger(raw) && raw >= 1 && raw <= 2 ? raw : 1;
}

function workerTokenReady(env: Env) {
  const token = env.ARCHITECT_CONSTRUCT_WORKER_TOKEN?.trim();
  return Boolean(token && token.length >= 32);
}

export function appsWorkerMissingNames(env: Env = process.env): string[] {
  const missing: string[] = [];
  if (env.ARCHITECT_ORIGIN_ENABLED !== 'true') missing.push('ARCHITECT_ORIGIN_ENABLED');
  if (env.ARCHITECT_APPS_ENABLED !== 'true') missing.push('ARCHITECT_APPS_ENABLED');
  if (!workerTokenReady(env)) missing.push('ARCHITECT_CONSTRUCT_WORKER_TOKEN');
  if (!env.ARCHITECT_APPS_WORKER_ID?.trim() && !env.ARCHITECT_CONSTRUCT_WORKER_ID?.trim())
    missing.push('ARCHITECT_APPS_WORKER_ID');
  try {
    if (!supabaseConnection(env)) {
      missing.push('NEXT_PUBLIC_SUPABASE_URL');
      missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    }
  } catch {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (hostedWorkerPlaneForbidden(env)) missing.push('VERCEL');
  const mode = appsDeploymentMode(env);
  if (mode === 'closed') missing.push('ARCHITECT_APPS_DEPLOYMENT_MODE');
  const generation = appsGenerationPolicy(env);
  if (!generation.permitted) missing.push(...generation.missing.filter((name) => !missing.includes(name)));
  if (mode === 'commissioned') {
    if (env.ARCHITECT_APPS_REQUIRE_ISOLATION !== 'true') missing.push('ARCHITECT_APPS_REQUIRE_ISOLATION');
    if (!parseAppsImageDigest(env.ARCHITECT_APPS_IMAGE_DIGEST)) missing.push('ARCHITECT_APPS_IMAGE_DIGEST');
    if (env.ARCHITECT_APPS_ALLOW_HOST_FIXTURE === 'true') missing.push('ARCHITECT_APPS_ALLOW_HOST_FIXTURE');
    if (env.ARCHITECT_APPS_STORE === 'memory') missing.push('ARCHITECT_APPS_STORE');
    try {
      parseEnvironment(env);
    } catch {
      missing.push('APP_ENV');
    }
  } else {
    try {
      if (parseEnvironment(env).mode === 'production') missing.push('APP_ENV');
    } catch {
      missing.push('APP_ENV');
    }
  }
  return missing;
}

export function localAppsWorkerReady(env: Env = process.env) {
  if (!flagsReady(env) || !workerTokenReady(env) || hostedWorkerPlaneForbidden(env)) return false;
  try {
    return parseEnvironment(env).mode !== 'production';
  } catch {
    return false;
  }
}

export function commissionedAppsWorkerReady(
  env: Env = process.env,
  evidence: {
    isolationAvailable?: boolean;
    observedDigest?: string | null;
    schemaCompatible?: boolean;
  } = {},
) {
  if (appsDeploymentMode(env) !== 'commissioned') return false;
  if (!flagsReady(env) || !workerTokenReady(env) || hostedWorkerPlaneForbidden(env)) return false;
  if (env.ARCHITECT_APPS_REQUIRE_ISOLATION !== 'true') return false;
  if (env.ARCHITECT_APPS_ALLOW_HOST_FIXTURE === 'true') return false;
  if (env.ARCHITECT_APPS_STORE === 'memory') return false;
  if (!controlPlaneReady(env)) return false;
  const expected = parseAppsImageDigest(env.ARCHITECT_APPS_IMAGE_DIGEST);
  if (!expected) return false;
  if (evidence.observedDigest !== undefined && evidence.observedDigest !== expected) return false;
  if (evidence.isolationAvailable === false) return false;
  if (evidence.schemaCompatible === false) return false;
  try {
    parseEnvironment(env);
  } catch {
    return false;
  }
  return Boolean(env.ARCHITECT_APPS_WORKER_ID?.trim() || env.ARCHITECT_CONSTRUCT_WORKER_ID?.trim());
}

export function appsWorkerAuthorized(
  env: Env = process.env,
  evidence: {
    isolationAvailable?: boolean;
    observedDigest?: string | null;
    schemaCompatible?: boolean;
  } = {},
) {
  const mode = appsDeploymentMode(env);
  if (mode === 'closed' || hostedWorkerPlaneForbidden(env)) return false;
  if (mode === 'commissioned') return commissionedAppsWorkerReady(env, evidence);
  return localAppsWorkerReady(env);
}

export function classifyAppsWorkerHealth(input: {
  env?: Env;
  busy?: boolean;
  isolationAvailable?: boolean;
  observedDigest?: string | null;
  schemaCompatible?: boolean;
}): {
  state: AppsWorkerHealthState;
  mode: AppsDeploymentMode;
  ready: boolean;
  missing: string[];
  workerId: string | null;
  processId: string;
  isolation: 'docker' | 'unavailable';
  generation: ReturnType<typeof appsGenerationPolicy>;
} {
  const env = input.env ?? process.env;
  const mode = appsDeploymentMode(env);
  const missing = appsWorkerMissingNames(env);
  const generation = appsGenerationPolicy(env);
  const ready =
    appsWorkerAuthorized(env, {
      isolationAvailable: input.isolationAvailable,
      observedDigest: input.observedDigest,
      schemaCompatible: input.schemaCompatible,
    }) && generation.permitted;
  const identity = appsProcessIdentity(env);
  if (!ready || missing.length || !generation.permitted) {
    return {
      state: mode === 'closed' || hostedWorkerPlaneForbidden(env) ? 'unavailable' : 'misconfigured',
      mode,
      ready: false,
      missing,
      workerId: null,
      processId: identity.processId,
      isolation: input.isolationAvailable ? 'docker' : 'unavailable',
      generation,
    };
  }
  return {
    state: input.busy ? 'working' : 'idle',
    mode,
    ready: true,
    missing: [],
    workerId: appsWorkerIdentity(env),
    processId: identity.processId,
    isolation: input.isolationAvailable === false ? 'unavailable' : 'docker',
    generation,
  };
}

export function expectedAppsSchemaNames() {
  return requiredAppsSchemaNames;
}

export async function probeRequiredAppsSchema(
  lookup: (kind: 'table' | 'rpc', name: string, column?: string) => Promise<boolean>,
) {
  return probeSchemaContracts(lookup);
}
