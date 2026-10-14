import { parseEnvironment } from '@/platform/environment';
import { supabaseConnection } from '@/platform/supabase/connection';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function appsReady(env: Env = process.env) {
  return env.ARCHITECT_ORIGIN_ENABLED === 'true' && env.ARCHITECT_APPS_ENABLED === 'true';
}

export function appsAiReady(env: Env = process.env) {
  if (!appsReady(env) || env.ARCHITECT_APPS_AI_ENABLED !== 'true') return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  return Boolean(env.OPENAI_API_KEY);
}

export function appsAiMockReady(env: Env = process.env) {
  if (!appsReady(env) || env.ARCHITECT_APPS_AI_MOCK !== 'true') return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  return true;
}

export function appsFixtureReady(env: Env = process.env) {
  return appsReady(env) || env.ARCHITECT_APPS_STORE === 'memory';
}

export function memoryAppStoreAllowed(env: Env = process.env) {
  if (env.ARCHITECT_APPS_STORE !== 'memory') return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  if (env.VERCEL || env.VERCEL_ENV) return false;
  return true;
}

export function appsWorkerAuthorized(env: Env = process.env) {
  const token = env.ARCHITECT_CONSTRUCT_WORKER_TOKEN;
  if (!token || token.trim().length < 32) return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  if (env.VERCEL || env.VERCEL_ENV) return false;
  return appsReady(env);
}

export function appsControlPlaneReady(env: Env = process.env) {
  return Boolean(supabaseConnection(env) && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function founderAppModelRunBlockers(env: Env = process.env) {
  const blockers: string[] = [];
  if (env.ARCHITECT_ORIGIN_ENABLED !== 'true') blockers.push('ARCHITECT_ORIGIN_ENABLED is not true.');
  if (env.ARCHITECT_APPS_ENABLED !== 'true') blockers.push('ARCHITECT_APPS_ENABLED is not true.');
  if (env.ARCHITECT_APPS_AI_ENABLED !== 'true')
    blockers.push('ARCHITECT_APPS_AI_ENABLED is not authorized. Paid model generation stays off.');
  if (!env.OPENAI_API_KEY) blockers.push('Server-only OPENAI_API_KEY is missing.');
  try {
    if (parseEnvironment(env).mode === 'production')
      blockers.push('Production refuses model-generated applications.');
  } catch {
    blockers.push('APP_ENV is missing or unsafe.');
  }
  if (!appsWorkerAuthorized(env))
    blockers.push('Local worker token, Origin/Apps flags, and a non-hosted plane are required to execute.');
  if (env.VERCEL || env.VERCEL_ENV) blockers.push('Hosted Vercel cannot run the isolated app-build worker.');
  blockers.push('Additive Architect Apps migrations are unapplied on hosted projects until founder-approved.');
  blockers.push(
    'A versioned Docker image with pinned React/TypeScript/Vite is required for isolated builds. Host-fixture compilation cannot mark a normal app as isolated success.',
  );
  return { ready: false, blockers };
}
