import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), owner: vi.fn() }));
vi.mock('../src/domains/health/service', () => ({
  verifyHealthOwner: mocks.owner,
  readHealthBridge: mocks.read,
}));
import { GET } from '../src/app/api/health/bridge/route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue(undefined);
});
describe('Health record bridge', () => {
  it('requires an authenticated owner and a session token', async () => {
    mocks.owner.mockRejectedValueOnce(
      Object.assign(new Error('Your account changed. Reopen Health before continuing.'), {
        status: 409,
      }),
    );
    const denied = await GET(new Request('https://aethelios.test/api/health/bridge'));
    expect(denied.status).toBeGreaterThanOrEqual(400);
    const missing = await GET(
      new Request('https://aethelios.test/api/health/bridge', {
        headers: { 'x-aethelios-health-owner': 'verified-person' },
      }),
    );
    expect(missing.status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('returns host-controlled sample observations without disguising them as personal data', async () => {
    mocks.read.mockResolvedValue({
      sample: true,
      hostControlled: true,
      notice: 'Sample workspace. These values are synthetic and are not your records.',
      observations: [
        { id: 's1000000-0000-4000-8000-000000000001', host: true, name: 'LDL cholesterol' },
      ],
    });
    const response = await GET(
      new Request('https://aethelios.test/api/health/bridge', {
        headers: {
          'x-aethelios-health-owner': 'verified-person',
          'x-aethelios-health-bridge': '00000000-0000-4000-8000-000000000044',
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body.sample).toBe(true);
    expect(body.hostControlled).toBe(true);
    expect(body.notice).toMatch(/not your records/);
  });
});
