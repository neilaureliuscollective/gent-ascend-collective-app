import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const auth = vi.hoisted(() => ({ claims: vi.fn() }));
vi.mock('@/platform/supabase/connection', () => ({
  supabaseConnection: () => ({ url: 'https://synthetic.supabase.co', key: 'synthetic-public' }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: unknown[]) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([
          { name: 'synthetic-refresh', value: 'updated', options: { httpOnly: true, path: '/' } },
        ]);
        return auth.claims();
      },
    },
  }),
}));
import { proxy } from '../src/proxy';
beforeEach(() =>
  auth.claims.mockResolvedValue({ data: { claims: { sub: 'synthetic-user' } }, error: null }),
);
describe('verified direct member entry', () => {
  for (const path of ['/', '/experience', '/enter'])
    it(`sends ${path} straight to Command and preserves refreshed cookies`, async () => {
      const response = await proxy(new NextRequest(`https://gent.example${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://gent.example/app');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.cookies.get('synthetic-refresh')?.value).toBe('updated');
    });
  it('leaves signed-out visitors on the public journey', async () => {
    auth.claims.mockResolvedValue({ data: null, error: null });
    const response = await proxy(new NextRequest('https://gent.example/'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
  it('does not mistake rejected claims for a verified member', async () => {
    auth.claims.mockResolvedValue({
      data: { claims: { sub: 'unverified' } },
      error: { message: 'expired' },
    });
    const response = await proxy(new NextRequest('https://gent.example/enter'));
    expect(response.headers.get('location')).toBeNull();
  });
  for (const path of ['/app', '/app/aethelios', '/app/grooming', '/shop', '/auth/confirm'])
    it(`keeps ${path} intact without a loop`, async () => {
      const response = await proxy(new NextRequest(`https://gent.example${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });
});
