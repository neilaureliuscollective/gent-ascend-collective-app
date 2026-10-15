import { parseEnvironment } from '@/platform/environment';
import { supabaseConnection } from '@/platform/supabase/connection';
import { appsDeploymentMode, appsWorkerAuthorized as commissionedOrLocalWorkerAuthorized } from './commission';
import { appsFounderPilotConfigured, appsGenerationPolicy } from './generation-policy';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function appsReady(env: Env = process.env) {
  return env.ARCHITECT_ORIGIN_ENABLED === 'true' && env.ARCHITECT_APPS_ENABLED === 'true';
}

export function appsAiReady(env: Env = process.env) {
  const policy = appsGenerationPolicy(env);
  return policy.mode === 'openai' && policy.generationReady;
}

export function appsAiMockReady(env: Env = process.env) {
  const policy = appsGenerationPolicy(env);
  return policy.mode === 'mock' && policy.generationReady;
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
  return commissionedOrLocalWorkerAuthorized(env);
}

export function appsControlPlaneReady(env: Env = process.env) {
  try {
    return Boolean(supabaseConnection(env) && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  } catch {
    return false;
  }
}

export function founderAppModelRunBlockers(env: Env = process.env) {
  const policy = appsGenerationPolicy(env);
  const blockers = [...policy.blockers];
  if (env.ARCHITECT_ORIGIN_ENABLED !== 'true') blockers.push('ARCHITECT_ORIGIN_ENABLED is not true.');
  if (env.ARCHITECT_APPS_ENABLED !== 'true') blockers.push('ARCHITECT_APPS_ENABLED is not true.');
  if (policy.mode !== 'openai') {
    if (env.ARCHITECT_APPS_AI_ENABLED !== 'true')
      blockers.push('ARCHITECT_APPS_AI_ENABLED is not authorized. Paid model generation stays off.');
    if (!env.OPENAI_API_KEY?.trim()) blockers.push('Server-only OPENAI_API_KEY is missing.');
    if (policy.production && !appsFounderPilotConfigured(env) && env.ARCHITECT_APPS_AI_ENABLED === 'true')
      blockers.push(
        'Production model generation stays off until ARCHITECT_APPS_FOUNDER_PILOT is deliberately commissioned.',
      );
  }
  if (!appsWorkerAuthorized(env))
    blockers.push(
      appsDeploymentMode(env) === 'closed'
        ? 'Production compilation stays closed until ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned and the isolated worker host is complete. Vercel is not that host.'
        : 'Worker token, Origin/Apps flags, matching database names, and a non-Vercel plane are required to execute.',
    );
  if (env.VERCEL || env.VERCEL_ENV)
    blockers.push('Hosted Vercel cannot run the isolated app-build worker. Generation may run on the web plane; compilation cannot.');
  const unique = [...new Set(blockers)];
  return {
    ready: policy.generationReady && policy.mode === 'openai' && appsWorkerAuthorized(env) && !env.VERCEL && !env.VERCEL_ENV,
    generationReady: policy.generationReady && policy.mode === 'openai',
    workerReady: appsWorkerAuthorized(env) && !env.VERCEL && !env.VERCEL_ENV,
    founderPilot: policy.founderPilot,
    mode: policy.mode,
    blockers: unique,
  };
}
