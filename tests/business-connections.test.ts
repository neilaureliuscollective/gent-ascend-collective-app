import { describe, it, expect } from 'vitest';
import { seal, unseal, nonce, challenge, equalState } from '@/domains/business-connections/crypto';
import { askSchema, scheduleSchema, windowSchema } from '@/domains/business-connections/schema';
import { connectionConfig } from '@/domains/business-connections/config';
import { calculateCapabilities } from '@/domains/access/policy';
import { consumeReply } from '@/domains/intelligence/consume';
const key = 'ab'.repeat(32);
describe('business connection security boundaries', () => {
  it('encrypts credentials and binds both owner and connection', () => {
    const input = { access: 'private-token', refresh: 'private-refresh' };
    const value = seal(input, key, 'owner:link');
    expect(value).not.toContain('private');
    expect(unseal(value, key, 'owner:link')).toEqual(input);
    expect(() => unseal(value, key, 'other:link')).toThrow();
    expect(() => unseal(value, 'cd'.repeat(32), 'owner:link')).toThrow();
    expect(() => unseal(value.slice(0, -5), key, 'owner:link')).toThrow();
    expect(seal(input, key, 'owner:link')).not.toBe(value);
  });
  it('uses random PKCE/state values and constant-time state equality', () => {
    const state = nonce();
    expect(state).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    expect(nonce()).not.toBe(state);
    expect(challenge(state)).toHaveLength(43);
    expect(equalState(state, state)).toBe(true);
    expect(equalState(state, state + 'x')).toBe(false);
  });
  it('requires trusted HTTPS origins, credentials and feature activation', () => {
    const env = {
      BUSINESS_CONNECTIONS_ENABLED: 'true',
      RESERVE_BUSINESS_ORIGIN: 'https://reserve.example',
      RESERVE_AUTH_ORIGIN: 'https://auth.example',
      BUSINESS_APP_ORIGIN: 'https://aethelios.example',
      RESERVE_OAUTH_CLIENT_ID: 'client',
      RESERVE_OAUTH_CLIENT_SECRET: 'secret',
      BUSINESS_CONNECTION_KEY: key,
    };
    expect(connectionConfig(env).callback).toBe(
      'https://aethelios.example/api/business-connections/callback',
    );
    for (const origin of [
      'http://reserve.example',
      'https://localhost',
      'https://user:pass@reserve.example',
      'https://reserve.example/api',
      'https://reserve.example?token=secret',
    ])
      expect(() => connectionConfig({ ...env, RESERVE_BUSINESS_ORIGIN: origin })).toThrow();
    expect(() => connectionConfig({ ...env, BUSINESS_CONNECTIONS_ENABLED: 'false' })).toThrow();
  });
  it('bounds windows and refuses personal context, Council and extra private data', () => {
    expect(windowSchema.safeParse({ date: '2026-10-10', days: 8 }).success).toBe(false);
    expect(windowSchema.safeParse({ date: '2026-02-30', days: 1 }).success).toBe(false);
    const input = {
      connectionId: '10000000-0000-4000-8000-000000000001',
      conversationId: '10000000-0000-4000-8000-000000000002',
      requestId: '10000000-0000-4000-8000-000000000003',
      text: 'Review',
      window: { date: '2026-10-10', days: 1 },
      consent: true,
    };
    expect(askSchema.safeParse(input).success).toBe(true);
    for (const extra of [
      { includeContext: true },
      { council: {} },
      { companyId: input.connectionId },
      { consent: false },
    ])
      expect(askSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    const safe = {
      version: 1,
      source: 'Legacy Reserve',
      fetchedAt: '2026-10-10T12:00:00Z',
      providerId: 'katie',
      timezone: 'America/Chicago',
      date: '2026-10-10',
      days: 1,
      page: 0,
      hasMore: false,
      appointments: [],
    };
    expect(scheduleSchema.safeParse(safe).success).toBe(true);
    expect(
      scheduleSchema.safeParse({ ...safe, clientEmail: 'private@example.invalid' }).success,
    ).toBe(false);
    expect(
      scheduleSchema.safeParse({
        ...safe,
        appointments: [
          {
            id: 'x',
            starts_at: safe.fetchedAt,
            ends_at: safe.fetchedAt,
            status: 'confirmed',
            service: 'Consultation',
            location: 'House',
            timezone: safe.timezone,
            notes: 'private',
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('sponsored personal membership expires and never grants health or clinical authority', () => {
    const state = {
      tier: 'free' as const,
      billing: 'none' as const,
      beta: false,
      professionalUntil: '2026-11-01T00:00:00Z',
    };
    const granted = calculateCapabilities(state, new Date('2026-10-10'));
    expect(granted.has('aurelius.context')).toBe(true);
    expect(granted.has('studio.create')).toBe(true);
    expect(granted.has('health.navigation')).toBe(false);
    expect(granted.has('clinical.care')).toBe(false);
    expect(calculateCapabilities(state, new Date('2026-11-02')).has('aurelius.context')).toBe(
      false,
    );
  });
  it('does not claim persistence when a stream ends without acknowledgement', async () => {
    const response = new Response('{"type":"delta","text":"partial"}\n');
    await expect(consumeReply(response, () => {})).rejects.toThrow(/not confirmed saved/);
    const events: string[] = [];
    await consumeReply(
      new Response('{"type":"delta","text":"reply"}\n{"type":"saved","turn":{}}\n'),
      (e) => events.push(e.type),
    );
    expect(events).toEqual(['delta', 'saved']);
  });
});
