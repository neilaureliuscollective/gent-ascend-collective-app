import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const fake = vi.hoisted(() => ({
  signup: vi.fn(),
  signout: vi.fn(),
  verify: vi.fn(),
  exchange: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/platform/supabase/server', () => ({
  serverClient: async () => ({
    auth: {
      signUp: fake.signup,
      signOut: fake.signout,
      verifyOtp: fake.verify,
      exchangeCodeForSession: fake.exchange,
    },
  }),
}));
import { registrationConfig } from '../src/domains/identity/registration-config';
import { registerMembership } from '../src/domains/identity/registration';
import { POST } from '../src/app/api/membership/registration/route';
import { GET } from '../src/app/auth/confirm/route';
const env = {
  APP_ENV: 'local',
  BILLING_APP_ORIGIN: 'http://127.0.0.1:3100',
  MEMBERSHIP_SIGNUP_ENABLED: 'true',
  MEMBERSHIP_AUTH_READY: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key',
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  fake.signup.mockResolvedValue({ data: { session: null }, error: null });
  fake.signout.mockResolvedValue({ error: null });
  fake.verify.mockResolvedValue({ error: null });
  fake.exchange.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe('membership registration without invitation privileges', () => {
  it('requires configured public registration and hosted bot protection', () => {
    expect(registrationConfig(env)?.captchaRequired).toBe(false);
    expect(registrationConfig({ ...env, MEMBERSHIP_AUTH_READY: 'false' })).toBeNull();
    expect(
      registrationConfig({
        ...env,
        APP_ENV: 'production',
        BILLING_APP_ORIGIN: 'https://gent.example',
      }),
    ).toBeNull();
    expect(
      registrationConfig({
        ...env,
        APP_ENV: 'production',
        BILLING_APP_ORIGIN: 'https://gent.example',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'synthetic-site-key',
      })?.captchaRequired,
    ).toBe(true);
  });
  it('creates only an Auth account with a fixed return path and no client-controlled grants', async () => {
    const result = await registerMembership({
      email: 'synthetic@example.test',
      password: 'synthetic-password',
    });
    expect(result.status).toBe(200);
    expect(fake.signup.mock.calls[0]![0]).toEqual({
      email: 'synthetic@example.test',
      password: 'synthetic-password',
      options: { emailRedirectTo: 'http://127.0.0.1:3100/auth/confirm', captchaToken: undefined },
    });
    expect(
      (
        await registerMembership({
          email: 'synthetic@example.test',
          password: 'synthetic-password',
          role: 'founder',
        })
      ).status,
    ).toBe(400);
  });
  it('rejects short passwords and missing hosted CAPTCHA, and redacts provider errors', async () => {
    expect(
      (await registerMembership({ email: 'synthetic@example.test', password: 'short' })).status,
    ).toBe(400);
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'synthetic-site-key');
    expect(
      (
        await registerMembership({
          email: 'synthetic@example.test',
          password: 'synthetic-password',
        })
      ).status,
    ).toBe(400);
    fake.signup.mockResolvedValue({
      data: { session: null },
      error: { message: 'sensitive provider error' },
    });
    const result = await registerMembership({
      email: 'synthetic@example.test',
      password: 'synthetic-password',
      captchaToken: 'synthetic-token',
    });
    expect(result.status).toBe(503);
    expect(result.message).not.toContain('sensitive');
    expect(fake.signup.mock.calls[0]![0].options.captchaToken).toBe('synthetic-token');
  });
  it('does not retain an auto-confirmed sign-up session', async () => {
    fake.signup.mockResolvedValue({
      data: { session: { access_token: 'synthetic-token' } },
      error: null,
    });
    await registerMembership({ email: 'synthetic@example.test', password: 'synthetic-password' });
    expect(fake.signout).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('rejects foreign origins before contacting Auth', async () => {
    const result = await POST(
      new NextRequest('http://127.0.0.1:3100/api/membership/registration', {
        method: 'POST',
        headers: { origin: 'https://attacker.example' },
        body: '{}',
      }),
    );
    expect(result.status).toBe(403);
    expect(fake.signup).not.toHaveBeenCalled();
  });
  it('keeps invitation callbacks separate from membership email callbacks and blocks arbitrary redirect destinations', async () => {
    for (const type of ['invite', 'email']) {
      const response = await GET(
        new NextRequest(
          `http://127.0.0.1:3100/auth/confirm?token_hash=synthetic&type=${type}&next=https://attacker.example`,
        ),
      );
      expect(new URL(response.headers.get('location')!).pathname).toBe(
        type === 'invite' ? '/app/welcome' : '/app/membership',
      );
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    }
    const denied = await GET(
      new NextRequest('http://127.0.0.1:3100/auth/confirm?token_hash=synthetic&type=recovery'),
    );
    expect(new URL(denied.headers.get('location')!).pathname).toBe('/app/welcome');
    expect(fake.verify).toHaveBeenCalledTimes(2);
  });
  it('supports the default PKCE email callback without accepting unverified browser identity', async () => {
    const response = await GET(
      new NextRequest('http://127.0.0.1:3100/auth/confirm?code=synthetic'),
    );
    expect(fake.exchange).toHaveBeenCalledWith('synthetic');
    expect(new URL(response.headers.get('location')!).pathname).toBe('/app/membership');
    fake.exchange.mockResolvedValue({ error: { message: 'invalid' } });
    const denied = await GET(new NextRequest('http://127.0.0.1:3100/auth/confirm?code=bad'));
    expect(new URL(denied.headers.get('location')!).pathname).toBe('/join');
  });
});
