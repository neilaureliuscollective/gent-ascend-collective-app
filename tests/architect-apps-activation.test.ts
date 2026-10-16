import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fixture = vi.hoisted(() => ({
  signedIn: true,
  owned: true,
  founder: true,
  policy: false,
  filters: [] as string[],
  tables: [] as string[],
  calls: [] as string[],
}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: async () => fixture.founder }));
vi.mock('@/domains/intelligence/service', () => {
  class IntelligenceError extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  }
  return {
    IntelligenceError,
    intelligenceSession: async () => {
      if (!fixture.signedIn) throw new IntelligenceError('Sign in required', 401);
      return {
        person: { id: 'owner' },
        client: {
          from: (table: string) => {
            fixture.tables.push(table);
            const query = {
              select: () => query,
              eq: (key: string, value: unknown) => {
                fixture.filters.push(`${key}:${value}`);
                return query;
              },
              maybeSingle: async () => ({
                error: null,
                data:
                  table === 'architect_origin_projects'
                    ? fixture.owned
                      ? { id: 'project', person_id: 'owner', revision: 1, content: {} }
                      : null
                    : { founder_pilot: fixture.policy },
              }),
            };
            return query;
          },
          rpc: async (fn: string) => {
            fixture.calls.push(fn);
            return { data: null, error: { message: 'Missing schema' } };
          },
        },
      };
    },
  };
});
import { GET } from '@/app/api/architect-apps/route';
import { appActivationStatus } from '@/domains/architect-apps/activation';
import { classifyPaidGenerationReadiness } from '@/domains/architect-apps/pilot';
const id = '00000000-0000-4000-8000-000000000003';
const request = () =>
  new Request(`https://example.com/api/architect-apps?project=${id}&view=activation`);
const digest = `sha256:${'ab'.repeat(32)}`;
const runtime = {
  schemaCompatible: true,
  workerPresent: true,
  observedDigest: digest,
  isolation: 'docker' as const,
  queueReady: true,
  artifactsReady: true,
  ageMs: 1,
  state: 'idle' as const,
};
const env = {
  APP_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
  ARCHITECT_ORIGIN_ENABLED: 'true',
  ARCHITECT_APPS_ENABLED: 'true',
  ARCHITECT_APPS_AI_ENABLED: 'true',
  ARCHITECT_APPS_FOUNDER_PILOT: 'true',
  OPENAI_API_KEY: 'synthetic-never-use',
  ARCHITECT_APPS_IMAGE_DIGEST: digest,
  ARCHITECT_APPS_PREVIEW_SECRET: 'synthetic-secret-long',
  ARCHITECT_APPS_PREVIEW_CLUSTER: 'true',
};
beforeEach(() => {
  Object.assign(fixture, {
    signedIn: true,
    owned: true,
    founder: true,
    policy: false,
    filters: [],
    tables: [],
    calls: [],
  });
});
afterEach(() => vi.unstubAllEnvs());
it('allows an owned readiness read with Apps disabled, no model, job or presence writes', async () => {
  vi.stubEnv('ARCHITECT_APPS_ENABLED', 'false');
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  const body = await response.json();
  expect(body.ready).toBe(false);
  expect(body.note).toContain('GitHub is optional');
  expect(fixture.filters).toContain('person_id:owner');
  expect(fixture.filters).toContain(`id:${id}`);
  expect(fixture.calls).toEqual(['architect_apps_worker_readiness']);
  expect(fixture.tables).toEqual(['architect_origin_projects', 'architect_apps_execution_policy']);
});
it.each([
  ['anonymous', false, true, 401],
  ['foreign project', true, false, 404],
] as const)('denies %s before runtime queries', async (_, signedIn, owned, status) => {
  Object.assign(fixture, { signedIn, owned });
  expect((await GET(request())).status).toBe(status);
  expect(fixture.calls).toEqual([]);
  expect(fixture.tables).not.toContain('architect_apps_execution_policy');
});
it('distinguishes configured prerequisites from execution and never requires GitHub', () => {
  const status = appActivationStatus({ founder: true, runtime, executionPolicy: true, env });
  expect(status.ready).toBe(true);
  expect(JSON.stringify(status)).not.toContain('synthetic-secret');
  expect(appActivationStatus({ founder: false, runtime, executionPolicy: true, env }).ready).toBe(
    false,
  );
  expect(appActivationStatus({ founder: true, runtime, executionPolicy: false, env }).ready).toBe(
    false,
  );
  expect(
    appActivationStatus({
      founder: true,
      runtime,
      executionPolicy: true,
      env: { ...env, ARCHITECT_APPS_PREVIEW_CLUSTER: 'false' },
    }).ready,
  ).toBe(false);
});
for (const field of ['observedDigest', 'ageMs', 'state', 'queueReady', 'artifactsReady'] as const) {
  it(`denies paid generation when worker ${field} evidence is missing`, () => {
    const incomplete = { ...runtime, [field]: undefined };
    expect(classifyPaidGenerationReadiness(incomplete, env).ok).toBe(false);
  });
}
it.each([NaN, Infinity, -1, 90001])('denies invalid or stale heartbeat %s', (ageMs) => {
  expect(classifyPaidGenerationReadiness({ ...runtime, ageMs }, env).ok).toBe(false);
});

it('reports an unsupported model override as not ready using the existing admission contract', () => {
  const status = appActivationStatus({
    founder: true,
    runtime,
    executionPolicy: true,
    env: { ...env, AURELIUS_AI_MODEL: 'not-an-approved-model' },
  });
  expect(status.ready).toBe(false);
  expect(status.checks.find((check) => check.name === 'Model generation')?.ready).toBe(false);
});
