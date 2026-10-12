import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: vi.fn() }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
import { requireCanonicalPilotAccess } from '@/domains/live/pilot-access';
it('denies ordinary accounts on shared previews before reservation or provider work', async () => {
  await expect(requireCanonicalPilotAccess(true, async () => false)).rejects.toMatchObject({
    status: 403,
  });
  await expect(requireCanonicalPilotAccess(true, async () => true)).resolves.toBeUndefined();
});
it('fails closed on unavailable founder verification and leaves isolated/local policy intact', async () => {
  const verify = vi.fn().mockRejectedValue(new Error('Grant unavailable'));
  await expect(requireCanonicalPilotAccess(true, verify)).rejects.toThrow('Grant unavailable');
  verify.mockClear();
  await requireCanonicalPilotAccess(false, verify);
  expect(verify).not.toHaveBeenCalled();
});
