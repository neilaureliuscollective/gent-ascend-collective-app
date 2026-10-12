import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/identity/current', () => ({
  currentIdentity: async () => ({ client: {}, authUserId: 'verified-auth-user' }),
}));
vi.mock('../src/domains/person/current', () => ({
  currentPerson: async () => ({ id: 'verified-person' }),
}));
import { verifyHealthOwner } from '../src/domains/health/service';
describe('Health session-change guard', () => {
  it('checks client context against verified identity rather than authorizing from it', async () => {
    await expect(
      verifyHealthOwner(
        new Request('https://aethelios.test', {
          headers: { 'x-aethelios-health-owner': 'verified-person' },
        }),
      ),
    ).resolves.toBeUndefined();
  });
  it('denies missing or previous-account context before mutation/export', async () => {
    await expect(verifyHealthOwner(new Request('https://aethelios.test'))).rejects.toThrow(
      /account changed/,
    );
    await expect(
      verifyHealthOwner(
        new Request('https://aethelios.test', {
          headers: { 'x-aethelios-health-owner': 'previous-person' },
        }),
      ),
    ).rejects.toThrow(/account changed/);
  });
});
