import { expect, it } from 'vitest';
import { previewBinding } from '@/domains/live/preview-binding';
import { preflightConfiguration } from '@/domains/live/preflight';
const reference = 'abcdefghijklmnopqrst';
const env = {
  AETHELIOS_LIVE_PREVIEW_PROJECT_REF: reference,
  NEXT_PUBLIC_SUPABASE_URL: `https://${reference}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
};
it('accepts only the pinned managed project URL as configuration, not acceptance', () => {
  expect(previewBinding(env)).toBe('configuration-matched');
  const report = preflightConfiguration({ ...env, APP_ENV: 'preview' });
  expect(report.previewDatabaseBinding).toBe('configuration-matched');
  expect(report.launchAcceptance).toBe('unverified');
});
it.each(['volpzkfsnmtztrovexcw', 'tybjocxecilkmozkvuns'])(
  'blocks the known protected project %s even if URL matches',
  (ref) => {
    expect(
      previewBinding({
        ...env,
        AETHELIOS_LIVE_PREVIEW_PROJECT_REF: ref,
        NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      }),
    ).toBe('blocked-project');
  },
);
it.each([
  'http://abcdefghijklmnopqrst.supabase.co',
  'https://anotherprojectabcdef.supabase.co',
  'https://abcdefghijklmnopqrst.supabase.co.attacker.test',
  'https://user:pass@abcdefghijklmnopqrst.supabase.co',
  'https://abcdefghijklmnopqrst.supabase.co/path',
  'https://abcdefghijklmnopqrst.supabase.co?target=other',
  'https://abcdefghijklmnopqrst.supabase.co#fragment',
  'http://127.0.0.1:54321',
  'https://abcdefghijklmnopqrst.supabase.co:1234',
])('rejects alternate or decorated hosted URL %s', (url) => {
  expect(previewBinding({ ...env, NEXT_PUBLIC_SUPABASE_URL: url })).toBe('url-mismatch');
});
it('fails closed without the explicit reference or publishable configuration', () => {
  expect(previewBinding({})).toBe('not-configured');
  expect(previewBinding({ ...env, AETHELIOS_LIVE_PREVIEW_PROJECT_REF: 'malformed' })).toBe(
    'invalid-reference',
  );
  expect(previewBinding({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' })).toBe('url-mismatch');
});
it('cannot enable admission by declaring control readiness against production data', () => {
  const report = preflightConfiguration({
    ...env,
    APP_ENV: 'preview',
    AETHELIOS_LIVE_ENABLED: 'true',
    AETHELIOS_LIVE_CONTROL_READY: 'true',
    OPENAI_API_KEY: 'synthetic',
    AETHELIOS_LIVE_PREVIEW_PROJECT_REF: 'volpzkfsnmtztrovexcw',
    NEXT_PUBLIC_SUPABASE_URL: 'https://volpzkfsnmtztrovexcw.supabase.co',
  });
  expect(report.admissionConfigured).toBe(false);
  expect(report.previewDatabaseBinding).toBe('blocked-project');
  expect(JSON.stringify(report)).not.toContain('https://');
});

it('permits explicitly enabled canonical account pilot without requiring a second project', () => {
  const shared = {
    APP_ENV: 'preview',
    AETHELIOS_LIVE_CANONICAL_PILOT: 'true',
    NEXT_PUBLIC_SUPABASE_URL: 'https://volpzkfsnmtztrovexcw.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
    AETHELIOS_LIVE_ENABLED: 'true',
    AETHELIOS_LIVE_CONTROL_READY: 'true',
    AETHELIOS_LIVE_EXPIRY_ENABLED: 'true',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-worker',
    CRON_SECRET: 'synthetic-scheduler-secret-at-least-32-characters',
    OPENAI_API_KEY: 'synthetic',
  };
  expect(previewBinding(shared)).toBe('configuration-matched');
  expect(preflightConfiguration(shared)).toMatchObject({
    canonicalPilot: true,
    admissionConfigured: true,
    launchAcceptance: 'unverified',
  });
  expect(
    previewBinding({
      ...shared,
      NEXT_PUBLIC_SUPABASE_URL: 'https://tybjocxecilkmozkvuns.supabase.co',
    }),
  ).toBe('url-mismatch');
  expect(
    previewBinding({ ...shared, AETHELIOS_LIVE_PREVIEW_PROJECT_REF: 'tybjocxecilkmozkvuns' }),
  ).toBe('blocked-project');
});
