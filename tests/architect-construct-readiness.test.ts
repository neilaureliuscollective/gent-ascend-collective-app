import { describe, expect, it } from 'vitest';
import {
  constructWorkerAuthorized,
  constructWorkerControlPlaneReady,
  constructWorkerMissingNames,
} from '@/domains/architect-construct/readiness';

const local = {
  APP_ENV: 'local',
  NODE_ENV: 'development',
  ARCHITECT_ORIGIN_ENABLED: 'true',
  ARCHITECT_CONSTRUCT_ENABLED: 'true',
  ARCHITECT_CONSTRUCT_WORKER_TOKEN: 'w'.repeat(32),
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test_key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-value',
} as NodeJS.ProcessEnv;

describe('construct worker readiness names', () => {
  it('lists missing control-plane names without returning values', () => {
    const missing = constructWorkerMissingNames({
      APP_ENV: 'local',
      NODE_ENV: 'development',
      ARCHITECT_ORIGIN_ENABLED: 'true',
      ARCHITECT_CONSTRUCT_ENABLED: 'true',
      ARCHITECT_CONSTRUCT_WORKER_TOKEN: 'w'.repeat(32),
    });
    expect(missing).toEqual([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
    expect(JSON.stringify(missing)).not.toMatch(/service-role-test-value|sb_publishable/);
    expect(constructWorkerControlPlaneReady(local)).toBe(true);
    expect(constructWorkerAuthorized(local)).toBe(true);
  });

  it('refuses production and Vercel even when a service role name is present', () => {
    expect(
      constructWorkerAuthorized({
        ...local,
        APP_ENV: 'production',
        VERCEL: '1',
      }),
    ).toBe(false);
    expect(
      constructWorkerMissingNames({
        ...local,
        APP_ENV: 'production',
        VERCEL: '1',
      }),
    ).toEqual(expect.arrayContaining(['APP_ENV', 'VERCEL']));
  });
});
