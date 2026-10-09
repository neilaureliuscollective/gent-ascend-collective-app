import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  client: vi.fn(),
  identity: vi.fn(),
  config: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
  google: vi.fn(),
}));
vi.mock('../src/platform/supabase/server', () => ({ serverClient: mock.client }));
vi.mock('../src/domains/identity/current', () => ({ currentIdentity: mock.identity }));
vi.mock('../src/domains/onboarding/config', () => ({ accountConfig: mock.config }));
vi.mock('../src/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
import { GET, POST } from '../src/app/api/account/auth/route';
const request = (body: unknown, origin = 'https://gent.test') =>
  new Request('https://gent.test/api/account/auth', {
    method: 'POST',
    headers: { host: 'gent.test', origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.config.mockReturnValue({
    origin: 'https://gent.test',
    captchaRequired: true,
    siteKey: 'public',
    google: true,
  });
  mock.identity.mockResolvedValue(null);
  mock.client.mockResolvedValue({
    auth: { signInWithOtp: mock.send, verifyOtp: mock.verify, signInWithOAuth: mock.google },
  });
  mock.send.mockResolvedValue({ error: null });
  mock.verify.mockResolvedValue({ error: null });
  mock.google.mockResolvedValue({
    data: { url: 'https://auth.example.test/authorize' },
    error: null,
  });
});
describe('free account auth boundary', () => {
  it('fails closed before provider configuration and requires same-origin requests', async () => {
    mock.config.mockReturnValue(null);
    expect((await POST(request({ action: 'send', email: 'synthetic@example.test' }))).status).toBe(
      503,
    );
    expect(mock.send).not.toHaveBeenCalled();
    expect((await POST(request({ action: 'google' }, 'https://foreign.test'))).status).toBe(403);
    expect(mock.google).not.toHaveBeenCalled();
  });
  it('retains CAPTCHA and sends an OTP without a password or billing dependency', async () => {
    expect((await POST(request({ action: 'send', email: 'synthetic@example.test' }))).status).toBe(
      400,
    );
    expect(
      (
        await POST(
          request({ action: 'send', email: 'synthetic@example.test', captchaToken: 'proof' }),
        )
      ).status,
    ).toBe(200);
    expect(mock.send).toHaveBeenCalledWith({
      email: 'synthetic@example.test',
      options: {
        shouldCreateUser: true,
        captchaToken: 'proof',
        emailRedirectTo: 'https://gent.test/auth/confirm?entry=claim',
      },
    });
  });
  it('recovers an existing account without creating users, while signup stays closed', async () => {
    mock.config.mockImplementation((_env: unknown, options?: { returning?: boolean }) =>
      options?.returning
        ? { origin: 'https://gent.test', captchaRequired: true, siteKey: 'public', google: false }
        : null,
    );
    const config = await GET();
    expect(await config.json()).toMatchObject({ ready: false, recoveryReady: true });
    const result = await POST(
      request({
        action: 'send',
        entry: 'recover',
        email: 'synthetic@example.test',
        captchaToken: 'proof',
      }),
    );
    expect(result.status).toBe(200);
    expect(mock.send).toHaveBeenCalledWith({
      email: 'synthetic@example.test',
      options: {
        shouldCreateUser: false,
        captchaToken: 'proof',
        emailRedirectTo: 'https://gent.test/auth/confirm?entry=recover',
      },
    });
    expect(
      (
        await POST(
          request({
            action: 'send',
            entry: 'account',
            email: 'synthetic@example.test',
            captchaToken: 'proof',
          }),
        )
      ).status,
    ).toBe(503);
    expect(mock.send).toHaveBeenCalledTimes(1);
    expect(
      await (
        await POST(
          request({
            action: 'verify',
            entry: 'recover',
            email: 'synthetic@example.test',
            code: '123456',
          }),
        )
      ).json(),
    ).toEqual({ destination: '/app/welcome' });
  });
  it('accepts verified email only and returns a fixed world destination', async () => {
    mock.verify.mockResolvedValueOnce({ error: { message: 'Expired' } });
    expect(
      (await POST(request({ action: 'verify', email: 'synthetic@example.test', code: '123456' })))
        .status,
    ).toBe(400);
    const result = await POST(
      request({ action: 'verify', email: 'synthetic@example.test', code: '123456' }),
    );
    expect(await result.json()).toEqual({ destination: '/experience/world?claim=1' });
    expect(result.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects arbitrary destinations and uses SSR OAuth with a fixed callback', async () => {
    expect((await POST(request({ action: 'google', next: 'https://evil.test' }))).status).toBe(400);
    expect((await POST(request({ action: 'google' }))).status).toBe(200);
    expect(mock.google).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://gent.test/auth/confirm?entry=claim',
        skipBrowserRedirect: true,
      },
    });
    const config = await GET();
    expect(await config.json()).toMatchObject({ authenticated: false, ready: true, google: true });
  });
});
