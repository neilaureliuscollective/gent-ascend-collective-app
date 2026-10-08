import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const cookieSet = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ cookies: async () => ({ set: cookieSet }) }));
import { GET as cartGet, POST as cartPost } from '@/app/api/commerce/cart/route';
import { GET as bridgeStart } from '@/app/api/aethelios-link/start/route';
import { GET as bridgeCallback } from '@/app/api/aethelios-link/callback/route';
import { legacyReserveDestination } from '@/platform/ecosystem';
import { companyJob } from '@/domains/company-work/starters';
describe('company platform boundaries', () => {
  it('retires checkout and private founder linking without provider calls', async () => {
    for (const handle of [cartGet, cartPost, bridgeStart, bridgeCallback]) {
      const response = await handle();
      expect(response.status).toBe(410);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });
  it('expires the historical bridge cookies at their original paths', async () => {
    cookieSet.mockClear();
    await bridgeStart();
    expect(cookieSet).toHaveBeenCalledWith('aethelios-founder-link', '', {
      path: '/app',
      maxAge: 0,
    });
    for (const name of ['aethelios-link-state', 'aethelios-link-verifier'])
      expect(cookieSet).toHaveBeenCalledWith(name, '', { path: '/api/aethelios-link', maxAge: 0 });
  });
  it('does not invent an external shop and rejects unsafe destination configuration', () => {
    for (const value of [
      undefined,
      '',
      'javascript:alert(1)',
      'http://example.com',
      'https://user:pass@example.com',
      'https://localhost',
      'https://127.0.0.1',
      'https://example.com?token=secret',
    ])
      expect(legacyReserveDestination(value)).toBeNull();
    expect(legacyReserveDestination('https://reserve.example/shop')).toBe(
      'https://reserve.example/shop',
    );
  });
  it('unknown jobs do not stage an unintended engagement and briefs do not claim execution', () => {
    expect(companyJob('unknown')).toBeUndefined();
    expect(companyJob('client-engagement')?.draft).toContain('No proposal is sent');
    expect(companyJob('company-brief')?.draft).toContain(
      'Do not claim to create a saved company workspace',
    );
  });
});
