import { expect, it } from 'vitest';
import {
  appsDeploymentMode,
  appsWorkerAuthorized,
  appsWorkerConcurrency,
  appsWorkerMissingNames,
  classifyAppsWorkerHealth,
  classifySchemaProbeError,
  commissionedAppsWorkerReady,
  expectedAppsSchemaNames,
  hostedWorkerPlaneForbidden,
  localAppsWorkerReady,
  probeAppsSchemaCompatibility,
  requiredAppsSchemaContracts,
} from '@/domains/architect-apps/commission';
import { parseAppsImageDigest } from '@/domains/architect-apps/commission';
import { founderAppModelRunBlockers } from '@/domains/architect-apps/readiness';

const digest = `sha256:${'ab'.repeat(32)}`;
const token = 'w'.repeat(32);
const local = {
  APP_ENV: 'local',
  NODE_ENV: 'development',
  ARCHITECT_ORIGIN_ENABLED: 'true',
  ARCHITECT_APPS_ENABLED: 'true',
  ARCHITECT_CONSTRUCT_WORKER_TOKEN: token,
  ARCHITECT_APPS_WORKER_ID: 'apps-local',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
} as const;

const commissioned = {
  APP_ENV: 'production',
  ARCHITECT_APPS_DEPLOYMENT_MODE: 'commissioned',
  ARCHITECT_ORIGIN_ENABLED: 'true',
  ARCHITECT_APPS_ENABLED: 'true',
  ARCHITECT_APPS_REQUIRE_ISOLATION: 'true',
  ARCHITECT_APPS_IMAGE_DIGEST: digest,
  ARCHITECT_CONSTRUCT_WORKER_TOKEN: token,
  ARCHITECT_APPS_WORKER_ID: 'apps-cloud',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'hosted-publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'hosted-service-role-key',
} as const;

it('keeps production closed unless an explicit commissioned worker is complete', () => {
  expect(appsDeploymentMode({ APP_ENV: 'production' })).toBe('closed');
  expect(appsDeploymentMode({ APP_ENV: 'production', ARCHITECT_APPS_DEPLOYMENT_MODE: 'local' })).toBe('closed');
  expect(localAppsWorkerReady({ ...local, VERCEL: '1' })).toBe(false);
  expect(appsWorkerAuthorized({ ...commissioned, VERCEL: '1' })).toBe(false);
  expect(hostedWorkerPlaneForbidden({ VERCEL_ENV: 'production' })).toBe(true);
  expect(commissionedAppsWorkerReady({ APP_ENV: 'production' })).toBe(false);
  expect(appsWorkerMissingNames({ APP_ENV: 'production' })).toContain('ARCHITECT_APPS_DEPLOYMENT_MODE');
});

it('authorizes a commissioned worker only with isolation, digest, identity and a non-Vercel plane', () => {
  expect(
    commissionedAppsWorkerReady(commissioned, {
      isolationAvailable: true,
      observedDigest: digest,
      schemaCompatible: true,
    }),
  ).toBe(true);
  expect(
    commissionedAppsWorkerReady(commissioned, {
      isolationAvailable: false,
      observedDigest: digest,
      schemaCompatible: true,
    }),
  ).toBe(false);
  expect(
    commissionedAppsWorkerReady(
      { ...commissioned, ARCHITECT_APPS_ALLOW_HOST_FIXTURE: 'true' },
      { isolationAvailable: true, observedDigest: digest, schemaCompatible: true },
    ),
  ).toBe(false);
  expect(
    commissionedAppsWorkerReady(commissioned, {
      isolationAvailable: true,
      observedDigest: `sha256:${'cd'.repeat(32)}`,
      schemaCompatible: true,
    }),
  ).toBe(false);
  expect(appsWorkerConcurrency(commissioned)).toBe(1);
  expect(parseAppsImageDigest(digest)).toBe(digest);
  expect(parseAppsImageDigest('sha256:nope')).toBeNull();
});

it('reports idle, working, unavailable and misconfigured without printing secrets', () => {
  const idle = classifyAppsWorkerHealth({
    env: commissioned,
    isolationAvailable: true,
    observedDigest: digest,
    schemaCompatible: true,
  });
  expect(idle.state).toBe('idle');
  expect(idle.ready).toBe(true);
  expect(JSON.stringify(idle)).not.toMatch(/hosted-service-role-key|wwww/);
  expect(
    classifyAppsWorkerHealth({
      env: commissioned,
      busy: true,
      isolationAvailable: true,
      observedDigest: digest,
      schemaCompatible: true,
    }).state,
  ).toBe('working');
  expect(classifyAppsWorkerHealth({ env: { APP_ENV: 'production', VERCEL: '1' } }).state).toBe('unavailable');
  expect(
    classifyAppsWorkerHealth({
      env: { ...commissioned, ARCHITECT_APPS_IMAGE_DIGEST: '' },
    }).state,
  ).toBe('misconfigured');
});

it('keeps paid generation closed and lists required schema names', async () => {
  const blockers = founderAppModelRunBlockers({ APP_ENV: 'production', VERCEL: '1' });
  expect(blockers.ready).toBe(false);
  expect(blockers.blockers.join(' ')).toMatch(/commissioned|Vercel/i);
  expect(expectedAppsSchemaNames().tables).toContain('architect_app_jobs');
  expect(requiredAppsSchemaContracts.tables.architect_app_artifacts).toEqual(['revision_id']);
  expect(requiredAppsSchemaContracts.tables.architect_app_artifacts).not.toContain('id');
  expect(classifySchemaProbeError({ code: '42703', message: 'column id does not exist' })).toBe('misconfigured');
  expect(classifySchemaProbeError({ code: '42P01', message: 'relation architect_app_jobs does not exist' })).toBe(
    'unavailable',
  );
  expect(classifySchemaProbeError({ code: '42501', message: 'permission denied' })).toBe('denied');
  const probe = await probeAppsSchemaCompatibility(async (kind, name) => kind === 'table' && name === 'architect_apps');
  expect(probe.ok).toBe(false);
  expect(probe.missing).toContain('architect_apps_claim');
  expect(probe.missing).toContain('architect_app_artifacts');
  expect(probe.classification).toBe('unavailable');
});
