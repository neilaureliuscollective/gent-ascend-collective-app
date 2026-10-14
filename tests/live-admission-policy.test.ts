import { expect, it } from 'vitest';
import { liveAdmissionPolicy, liveShellAvailability } from '@/domains/live/admission-policy';
import { preflightConfiguration } from '@/domains/live/preflight';

const hosted = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  VERCEL: '1',
  VERCEL_ENV: 'production',
  AURELIUS_DEV_HARNESS: 'false',
  AETHELIOS_LIVE_ENABLED: 'true',
  AETHELIOS_LIVE_FOUNDER_PILOT: 'true',
  AETHELIOS_LIVE_CANONICAL_PILOT: 'true',
  AETHELIOS_LIVE_CONTROL_READY: 'true',
  AETHELIOS_LIVE_EXPIRY_ENABLED: 'true',
  AETHELIOS_LIVE_MODEL: 'gpt-realtime',
  OPENAI_API_KEY: 'synthetic-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-worker',
  CRON_SECRET: 'synthetic-scheduler-secret-at-least-32-characters',
  NEXT_PUBLIC_SUPABASE_URL: 'https://volpzkfsnmtztrovexcw.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable-key',
};

it('keeps production closed without the explicit founder-pilot gate', () => {
  expect(liveAdmissionPolicy({ ...hosted, AETHELIOS_LIVE_FOUNDER_PILOT: 'false' }).error).toMatch(
    /not enabled/,
  );
  expect(liveShellAvailability({ ...hosted, AETHELIOS_LIVE_ENABLED: 'false' }, true).enabled).toBe(
    false,
  );
});

it('admits a fully configured production founder pilot to the founder only', () => {
  expect(liveAdmissionPolicy(hosted)).toMatchObject({
    mode: 'production',
    founderOnly: true,
    error: null,
  });
  expect(liveShellAvailability(hosted, true)).toEqual({
    enabled: true,
    founderOnly: true,
    reason: null,
  });
  expect(liveShellAvailability(hosted, false)).toEqual({
    enabled: false,
    founderOnly: true,
    reason: 'This voice pilot is limited to the founder account.',
  });
  expect(preflightConfiguration(hosted)).toMatchObject({
    admissionConfigured: true,
    canonicalPilot: true,
    founderOnly: true,
    launchAcceptance: 'unverified',
  });
});

it('admits production using the pinned Gent connection when the preview canonical flag is unset', () => {
  const production = { ...hosted, AETHELIOS_LIVE_CANONICAL_PILOT: 'false' };
  expect(liveAdmissionPolicy(production)).toMatchObject({
    mode: 'production',
    founderOnly: true,
    error: null,
  });
  expect(liveShellAvailability(production, true).enabled).toBe(true);
  expect(preflightConfiguration(production)).toMatchObject({
    admissionConfigured: true,
    canonicalPilot: false,
    founderOnly: true,
    previewDatabaseBinding: 'configuration-matched',
  });
});

it('does not treat harness or beta membership as hosted founder authority', () => {
  expect(liveShellAvailability(hosted, false).enabled).toBe(false);
  expect(liveShellAvailability({ ...hosted, AURELIUS_DEV_HARNESS: 'true' }, false).reason).toMatch(
    /founder account/,
  );
});

it('fails closed on invalid hosted configuration instead of throwing into the shell', () => {
  expect(
    liveAdmissionPolicy({
      APP_ENV: 'local',
      VERCEL_ENV: 'production',
      AETHELIOS_LIVE_ENABLED: 'true',
    }).error,
  ).toMatch(/not enabled/);
  expect(liveShellAvailability({ APP_ENV: 'production', VERCEL_ENV: 'production' }, true)).toEqual({
    enabled: false,
    founderOnly: true,
    reason: 'Aethelios Live is not enabled on this deployment.',
  });
});

it('exposes an understandable unavailable reason when cleanup or binding is missing', () => {
  expect(
    liveShellAvailability({ ...hosted, AETHELIOS_LIVE_EXPIRY_ENABLED: 'false' }, true).reason,
  ).toMatch(/cleanup is not configured/);
  expect(
    liveShellAvailability(
      { ...hosted, NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' },
      true,
    ).enabled,
  ).toBe(true);
  expect(
    liveShellAvailability(
      { ...hosted, AETHELIOS_LIVE_PREVIEW_PROJECT_REF: 'abcdefghijklmnopqrst' },
      true,
    ).reason,
  ).toMatch(/database binding/);
  expect(liveShellAvailability({ ...hosted, OPENAI_API_KEY: ' ' }, true).reason).toMatch(
    /not configured/,
  );
});
