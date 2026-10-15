import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { defaultAppGenerationTransport } from '@/domains/architect-apps/provider';
import {
  APP_GENERATION_LIMITS,
  appsGenerationAdmission,
  appsGenerationPolicy,
  classifyAppRequestFailure,
  describeAppFailure,
} from '@/domains/architect-apps/generation-policy';
import { appsAiMockReady, appsAiReady, founderAppModelRunBlockers } from '@/domains/architect-apps/readiness';
import { classifyAppsWorkerHealth } from '@/domains/architect-apps/commission';

const digest = `sha256:${'ab'.repeat(32)}`;
const token = 'w'.repeat(32);
const productionBase = {
  APP_ENV: 'production',
  ARCHITECT_ORIGIN_ENABLED: 'true',
  ARCHITECT_APPS_ENABLED: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'hosted-publishable-key',
} as const;

const commissionedWorker = {
  ...productionBase,
  ARCHITECT_APPS_DEPLOYMENT_MODE: 'commissioned',
  ARCHITECT_APPS_REQUIRE_ISOLATION: 'true',
  ARCHITECT_APPS_IMAGE_DIGEST: digest,
  ARCHITECT_CONSTRUCT_WORKER_TOKEN: token,
  ARCHITECT_APPS_WORKER_ID: 'apps-cloud',
  SUPABASE_SERVICE_ROLE_KEY: 'hosted-service-role-key',
} as const;

const founderPilot = {
  ...commissionedWorker,
  ARCHITECT_APPS_FOUNDER_PILOT: 'true',
  ARCHITECT_APPS_AI_ENABLED: 'true',
  OPENAI_API_KEY: 'sk-test',
} as const;

it('keeps production generation off until the founder pilot is commissioned', () => {
  expect(appsAiReady(productionBase)).toBe(false);
  expect(appsAiMockReady({ ...productionBase, ARCHITECT_APPS_AI_MOCK: 'true' })).toBe(false);
  expect(appsGenerationPolicy({ ...productionBase, ARCHITECT_APPS_AI_MOCK: 'true' }).mode).toBe('refused');
  expect(
    appsGenerationPolicy({
      ...productionBase,
      ARCHITECT_APPS_AI_ENABLED: 'true',
      OPENAI_API_KEY: 'sk-test',
    }).generationReady,
  ).toBe(false);
  expect(
    appsGenerationPolicy({
      ...productionBase,
      ARCHITECT_APPS_AI_ENABLED: 'true',
      OPENAI_API_KEY: 'sk-test',
    }).missing,
  ).toContain('ARCHITECT_APPS_FOUNDER_PILOT');
  const closed = founderAppModelRunBlockers({ ...productionBase, VERCEL: '1' });
  expect(closed.ready).toBe(false);
  expect(closed.generationReady).toBe(false);
  expect(closed.blockers.join(' ')).toMatch(/Vercel|FOUNDER_PILOT|commissioned/i);
});

it('permits the real OpenAI adapter only for the configured founder-pilot path', () => {
  expect(appsGenerationPolicy(founderPilot).mode).toBe('openai');
  expect(appsAiReady(founderPilot)).toBe(true);
  expect(appsAiMockReady(founderPilot)).toBe(false);
  expect(defaultAppGenerationTransport(founderPilot)).toEqual(expect.any(Function));
  expect(defaultAppGenerationTransport({ ...founderPilot, ARCHITECT_APPS_AI_MOCK: 'true' })).toBeUndefined();
  expect(appsGenerationAdmission(false, founderPilot)).toMatchObject({
    enabled: false,
    class: 'permission',
  });
  expect(appsGenerationAdmission(true, founderPilot)).toMatchObject({
    enabled: true,
    mode: 'openai',
    class: 'openai',
  });
  const journey = founderAppModelRunBlockers(founderPilot);
  expect(journey.generationReady).toBe(true);
  expect(journey.workerReady).toBe(true);
  expect(journey.ready).toBe(true);
  expect(journey.founderPilot).toBe(true);
});

it('confines mock and fixture generation to labelled local environments', () => {
  const localMock = {
    APP_ENV: 'local',
    ARCHITECT_ORIGIN_ENABLED: 'true',
    ARCHITECT_APPS_ENABLED: 'true',
    ARCHITECT_APPS_AI_MOCK: 'true',
  };
  expect(appsAiMockReady(localMock)).toBe(true);
  expect(appsAiReady(localMock)).toBe(false);
  expect(appsGenerationAdmission(false, localMock).mode).toBe('mock');
  expect(
    appsGenerationPolicy({
      APP_ENV: 'production',
      ARCHITECT_ORIGIN_ENABLED: 'true',
      ARCHITECT_APPS_ENABLED: 'true',
      ARCHITECT_APPS_AI_MOCK: 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'hosted-publishable-key',
    }).permitted,
  ).toBe(false);
});

it('refuses a commissioned worker when production mock is configured and reports policy when it is not', () => {
  const denied = classifyAppsWorkerHealth({
    env: { ...commissionedWorker, ARCHITECT_APPS_AI_MOCK: 'true' },
    isolationAvailable: true,
    observedDigest: digest,
    schemaCompatible: true,
  });
  expect(denied.ready).toBe(false);
  expect(denied.generation.mode).toBe('refused');
  expect(denied.state).toBe('misconfigured');
  const permitted = classifyAppsWorkerHealth({
    env: founderPilot,
    isolationAvailable: true,
    observedDigest: digest,
    schemaCompatible: true,
  });
  expect(permitted.ready).toBe(true);
  expect(permitted.generation.mode).toBe('openai');
  expect(permitted.generation.generationReady).toBe(true);
  const compileOnly = classifyAppsWorkerHealth({
    env: commissionedWorker,
    isolationAvailable: true,
    observedDigest: digest,
    schemaCompatible: true,
  });
  expect(compileOnly.ready).toBe(true);
  expect(compileOnly.generation.mode).toBe('disabled');
  expect(compileOnly.generation.generationReady).toBe(false);
});

it('separates permission, model, compile and worker failures and keeps retries at zero', () => {
  expect(APP_GENERATION_LIMITS.maxRetries).toBe(0);
  expect(APP_GENERATION_LIMITS.maxOutputTokens).toBe(4000);
  expect(APP_GENERATION_LIMITS.timeoutMs).toBe(30000);
  expect(classifyAppRequestFailure({ message: 'founder pilot', status: 403 }).class).toBe('permission');
  expect(classifyAppRequestFailure(new Error('OpenAI provider adapter was not wired')).class).toBe('model');
  expect(classifyAppRequestFailure(new Error('Isolated build typecheck failed')).class).toBe('compile');
  expect(classifyAppRequestFailure(new Error('Worker lost the lease')).class).toBe('worker');
  expect(describeAppFailure({ message: 'not enabled for this account', status: 403 })).toMatch(/^Not enabled:/);
});
