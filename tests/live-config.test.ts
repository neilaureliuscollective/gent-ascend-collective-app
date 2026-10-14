import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
import { liveConfig } from '@/domains/live/config';
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('AURELIUS_DEV_HARNESS', 'false');
  vi.stubEnv('AETHELIOS_LIVE_ENABLED', 'true');
  vi.stubEnv('AETHELIOS_LIVE_CONTROL_READY', 'false');
  vi.stubEnv('AETHELIOS_LIVE_CANONICAL_PILOT', 'false');
  vi.stubEnv('AETHELIOS_LIVE_FOUNDER_PILOT', undefined);
  vi.stubEnv('AETHELIOS_LIVE_EXPIRY_ENABLED', 'true');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-worker');
  vi.stubEnv('CRON_SECRET', 'synthetic-scheduler-secret-at-least-32-characters');
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key');
  vi.stubEnv('AETHELIOS_LIVE_MODEL', 'gpt-realtime');
});
afterEach(() => vi.unstubAllEnvs());
it('uses an explicit supported native model and fails closed on an undocumented GPT-Live identifier', () => {
  expect(liveConfig().model).toBe('gpt-realtime');
  vi.stubEnv('AETHELIOS_LIVE_MODEL', 'gpt-live');
  expect(() => liveConfig()).toThrow();
});
it('requires the separate control readiness gate for hosted previews', () => {
  vi.stubEnv('APP_ENV', 'preview');
  expect(() => liveConfig()).toThrow(/hosting controls/);
  vi.stubEnv('AETHELIOS_LIVE_CONTROL_READY', 'true');
  expect(() => liveConfig()).toThrow(/database binding/);
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', 'abcdefghijklmnopqrst');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable');
  expect(liveConfig().model).toBe('gpt-realtime');
});
it('keeps production closed without the new explicit founder pilot policy', () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key');
  vi.stubEnv('AETHELIOS_LIVE_CONTROL_READY', 'true');
  expect(() => liveConfig()).toThrow(/not enabled/);
});

it('requires every production founder prerequisite; old flags cannot activate it', () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('AETHELIOS_LIVE_CONTROL_READY', 'true');
  vi.stubEnv('AETHELIOS_LIVE_CANONICAL_PILOT', 'true');
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', undefined);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://volpzkfsnmtztrovexcw.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable');
  expect(() => liveConfig()).toThrow(/not enabled/);
  vi.stubEnv('AETHELIOS_LIVE_FOUNDER_PILOT', 'true');
  expect(liveConfig().canonicalPilot).toBe(true);
  for (const [name, value] of [
    ['AETHELIOS_LIVE_ENABLED', 'false'],
    ['AETHELIOS_LIVE_CONTROL_READY', 'false'],
    ['AETHELIOS_LIVE_EXPIRY_ENABLED', 'false'],
    ['SUPABASE_SERVICE_ROLE_KEY', ''],
    ['CRON_SECRET', 'short'],
    ['OPENAI_API_KEY', ' '],
    ['AETHELIOS_LIVE_PREVIEW_PROJECT_REF', 'abcdefghijklmnopqrst'],
  ]) {
    const previous = process.env[name!];
    vi.stubEnv(name!, value!);
    expect(() => liveConfig(), name).toThrow();
    vi.stubEnv(name!, previous);
  }
  vi.stubEnv('AETHELIOS_LIVE_CANONICAL_PILOT', 'false');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co');
  expect(liveConfig().canonicalPilot).toBe(true);
});

it('recognizes founder-only canonical pilot without another database while retaining readiness', () => {
  vi.stubEnv('APP_ENV', 'preview');
  vi.stubEnv('AETHELIOS_LIVE_CANONICAL_PILOT', 'true');
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://volpzkfsnmtztrovexcw.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable');
  expect(() => liveConfig()).toThrow(/hosting controls/);
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', undefined);
  vi.stubEnv('AETHELIOS_LIVE_CONTROL_READY', 'true');
  expect(liveConfig()).toMatchObject({ canonicalPilot: true, model: 'gpt-realtime' });
});

it('rejects a declared-ready hosted preview without each independent cleanup requirement', () => {
  vi.stubEnv('APP_ENV', 'preview');
  vi.stubEnv('AETHELIOS_LIVE_CANONICAL_PILOT', 'true');
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', undefined);
  vi.stubEnv('AETHELIOS_LIVE_CONTROL_READY', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://volpzkfsnmtztrovexcw.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable');
  for (const [name, missing] of [
    ['SUPABASE_SERVICE_ROLE_KEY', ' '],
    ['CRON_SECRET', 'short'],
    ['AETHELIOS_LIVE_EXPIRY_ENABLED', 'false'],
  ] as const) {
    const original = process.env[name];
    vi.stubEnv(name, missing);
    expect(() => liveConfig()).toThrow(/cleanup is not configured/);
    vi.stubEnv(name, original);
  }
  expect(liveConfig().canonicalPilot).toBe(true);
});
