import { describe, it, expect } from 'vitest';
import { calculateCapabilities } from '../src/domains/access/policy';
import { parseEnvironment } from '../src/platform/environment';
import { defaultScenario, readScenario, signScenario } from '../src/domains/development/scenario';
const now = new Date('2026-09-20T12:00:00Z');
const local = {
  NODE_ENV: 'development',
  APP_ENV: 'local',
  AURELIUS_DEV_HARNESS: 'true',
  AURELIUS_DEV_TOKEN: 'x'.repeat(40),
  AURELIUS_FOUNDER_PASSWORD: 'y'.repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-test-key',
};
describe('capabilities', () => {
  it('grants paid context only within valid paid access', () => {
    expect(
      calculateCapabilities(
        { tier: 'aurelius', billing: 'active', beta: false, accessUntil: '2026-10-01' },
        now,
      ).has('aurelius.context'),
    ).toBe(true);
    expect(
      calculateCapabilities(
        { tier: 'aurelius', billing: 'active', beta: false, accessUntil: '2026-09-01' },
        now,
      ).has('aurelius.context'),
    ).toBe(false);
  });
  it('expires trials and denies delinquent paid access', () => {
    expect(
      calculateCapabilities(
        { tier: 'health', billing: 'trialing', beta: false, trialEndsAt: '2026-09-01' },
        now,
      ).has('health.navigation'),
    ).toBe(false);
    expect(
      calculateCapabilities({ tier: 'health', billing: 'past_due', beta: false }, now).has(
        'aurelius.context',
      ),
    ).toBe(false);
  });
  it('preserves prepaid canceled access until expiry', () => {
    expect(
      calculateCapabilities(
        { tier: 'aurelius', billing: 'canceled', beta: false, accessUntil: '2026-10-01' },
        now,
      ).has('aurelius.context'),
    ).toBe(true);
  });
  it('separates beta and clinical authorization', () => {
    const c = calculateCapabilities({ tier: 'health', billing: 'none', beta: true }, now);
    expect(c.has('aurelius.context')).toBe(true);
    expect(c.has('clinical.care')).toBe(false);
    expect(c.has('health.navigation')).toBe(false);
  });
});
describe('environment isolation', () => {
  it('allows explicit configured local developer access', () =>
    expect(parseEnvironment(local).harnessEnabled).toBe(true));
  it.each([
    { NODE_ENV: 'production' },
    { APP_ENV: 'production' },
    { APP_ENV: 'preview' },
    { VERCEL: '1' },
    { VERCEL_ENV: 'preview' },
    { VERCEL_ENV: 'production' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' },
    { AURELIUS_DEV_TOKEN: undefined },
  ])('rejects unsafe harness settings %j', (change) =>
    expect(() => parseEnvironment({ ...local, ...change })).toThrow(),
  );
  it('rejects production without required service config', () =>
    expect(() => parseEnvironment({ APP_ENV: 'production' })).toThrow());
  it('does not require integrations for shell', () =>
    expect(parseEnvironment({ NODE_ENV: 'production' }).harnessEnabled).toBe(false));
});
describe('signed developer scenarios', () => {
  const key = 'local-secret'.repeat(4);
  it('validates signature, owner payload and expiration', () => {
    const value = signScenario(defaultScenario, key, now.getTime());
    expect(readScenario(value, key, now.getTime())).toEqual(defaultScenario);
    expect(readScenario(value, 'wrong', now.getTime())).toBeNull();
    expect(readScenario(value, key, now.getTime() + 9 * 3600000)).toBeNull();
    expect(readScenario(value + 'a', key, now.getTime())).toBeNull();
  });
  it('rejects arbitrary unsigned client state', () =>
    expect(readScenario(JSON.stringify({ membership: 'admin' }), key)).toBeNull());
});
