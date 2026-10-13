import { timingSafeEqual } from 'node:crypto';
import { parseEnvironment } from '@/platform/environment';

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

export function workerTokenMatches(request: Request, env: NodeJS.ProcessEnv = process.env) {
  const token = env.ARCHITECT_CONSTRUCT_WORKER_TOKEN;
  if (!token || token.length < 32) return false;
  const received = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${token}`;
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
