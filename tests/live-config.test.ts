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
it('does not enable production even when pilot flags are enabled', () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key');
  vi.stubEnv('AETHELIOS_LIVE_CONTROL_READY', 'true');
  expect(() => liveConfig()).toThrow(/not enabled/);
});
