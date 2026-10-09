import { describe, it, expect } from 'vitest';
import { validDraft, draftLifetime, claimInput } from '../src/domains/onboarding/model';
import { accountConfig } from '../src/domains/onboarding/config';
import { funnelEvent } from '../src/domains/onboarding/events';
const now = Date.now();
const draft = {
  version: 1,
  id: '60000000-0000-4000-8000-000000000001',
  focus: 'body',
  intention: 'Train tomorrow',
  createdAt: now,
  timezone: 'America/Chicago',
};
describe('account claim boundaries', () => {
  it('expires draft state and rejects future timestamps, unknown fields and invalid zones', () => {
    expect(validDraft(draft, now)).toEqual(draft);
    for (const patch of [
      { createdAt: now - draftLifetime - 1 },
      { createdAt: now + 60001 },
      { timezone: 'not/a/zone' },
      { intention: 'x'.repeat(161) },
      { ownerId: 'other' },
    ])
      expect(validDraft({ ...draft, ...patch }, now)).toBeNull();
    expect(claimInput.safeParse({ draft, ownerId: 'other' }).success).toBe(false);
  });
  it('separates free signup readiness from billing and fails closed on hostile origins', () => {
    const env = {
      ACCOUNT_SIGNUP_ENABLED: 'true',
      ACCOUNT_AUTH_READY: 'true',
      ACCOUNT_APP_ORIGIN: 'https://gent.test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://db.test',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site',
    };
    expect(accountConfig(env)).toMatchObject({
      origin: 'https://gent.test',
      google: false,
      captchaRequired: true,
    });
    expect(accountConfig({ ...env, ACCOUNT_SIGNUP_ENABLED: 'false' })).toBeNull();
    expect(
      accountConfig({ ...env, ACCOUNT_SIGNUP_ENABLED: 'false' }, { returning: true }),
    ).not.toBeNull();
    expect(accountConfig({ ...env, ACCOUNT_AUTH_READY: 'false' }, { returning: true })).toBeNull();
    for (const patch of [
      { ACCOUNT_AUTH_READY: 'false' },
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '' },
      { ACCOUNT_APP_ORIGIN: 'https://user:pass@gent.test' },
      { ACCOUNT_APP_ORIGIN: 'https://gent.test/path' },
      { ACCOUNT_APP_ORIGIN: 'http://gent.test' },
    ])
      expect(accountConfig({ ...env, ...patch })).toBeNull();
  });
  it('rejects free text and identifiers from conversion telemetry', () => {
    const event = {
      name: 'claim_clicked',
      id: draft.id,
      journey: draft.id,
      elapsed: 1000,
      device: 'phone',
    };
    expect(funnelEvent.safeParse(event).success).toBe(true);
    expect(funnelEvent.safeParse({ ...event, email: 'private@example.test' }).success).toBe(false);
    expect(funnelEvent.safeParse({ ...event, intention: 'private' }).success).toBe(false);
  });
});
