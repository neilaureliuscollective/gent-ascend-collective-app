import { timingSafeEqual } from 'node:crypto';
import { parseEnvironment } from '@/platform/environment';
import { supabaseConnection } from '@/platform/supabase/connection';

export function constructReady(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.ARCHITECT_ORIGIN_ENABLED === 'true' && env.ARCHITECT_CONSTRUCT_ENABLED === 'true'
  );
}

export function constructAiReady(env: NodeJS.ProcessEnv = process.env) {
  if (!constructReady(env) || env.ARCHITECT_CONSTRUCT_AI_ENABLED !== 'true') return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  return Boolean(env.OPENAI_API_KEY);
}

/** Labelled development mock. Never paid. Closed in production. */
export function constructAiMockReady(env: NodeJS.ProcessEnv = process.env) {
  if (!constructReady(env) || env.ARCHITECT_CONSTRUCT_AI_MOCK !== 'true') return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  return true;
}

export function constructWorkerAuthorized(env: NodeJS.ProcessEnv = process.env) {
  const token = env.ARCHITECT_CONSTRUCT_WORKER_TOKEN;
  if (!token || token.trim().length < 32) return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  if (env.VERCEL || env.VERCEL_ENV) return false;
  return constructReady(env);
}

/** Name-only control-plane check. Never returns credential values. */
export function constructWorkerControlPlaneReady(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(supabaseConnection(env) && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Missing worker setting names for diagnostics. Values are never included.
 * Production and Vercel remain closed; renaming APP_ENV does not authorize a hosted worker.
 */
export function constructWorkerMissingNames(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  if (env.ARCHITECT_ORIGIN_ENABLED !== 'true') missing.push('ARCHITECT_ORIGIN_ENABLED');
  if (env.ARCHITECT_CONSTRUCT_ENABLED !== 'true') missing.push('ARCHITECT_CONSTRUCT_ENABLED');
  const token = env.ARCHITECT_CONSTRUCT_WORKER_TOKEN;
  if (!token || token.trim().length < 32) missing.push('ARCHITECT_CONSTRUCT_WORKER_TOKEN');
  try {
    if (parseEnvironment(env).mode === 'production') missing.push('APP_ENV');
  } catch {
    missing.push('APP_ENV');
  }
  if (env.VERCEL || env.VERCEL_ENV) missing.push('VERCEL');
  if (!supabaseConnection(env)) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

export function workerTokenMatches(request: Request, env: NodeJS.ProcessEnv = process.env) {
  const token = env.ARCHITECT_CONSTRUCT_WORKER_TOKEN;
  if (!token || token.length < 32) return false;
  const received = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${token}`;
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
