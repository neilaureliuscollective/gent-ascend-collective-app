import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  founder: true,
  membership: null as unknown,
  error: null as unknown,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('../src/domains/access/founder', () => ({
  currentFounderAccess: async () => state.founder,
}));
vi.mock('../src/domains/person/current', () => ({ currentPerson: async () => ({ id: 'owner' }) }));
vi.mock('../src/platform/environment', () => ({
  parseEnvironment: () => ({ harnessEnabled: false }),
}));
vi.mock('../src/domains/identity/current', () => ({
  currentIdentity: async () => ({
    authUserId: 'auth-owner',
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: state.membership, error: state.error }) }),
        }),
      }),
    },
  }),
}));
import { currentAccess } from '../src/domains/access/current';
import {readPilot} from '../src/domains/pilot/service';
beforeEach(() => {
  state.founder = true;
  state.membership = null;
  state.error = null;
});
it('verified founder access remains available without subscription provisioning', async () => {
  const access = await currentAccess();
  expect(access.has('aurelius.context')).toBe(true);
  expect(access.has('studio.create')).toBe(true);
  expect(access.has('clinical.care')).toBe(false);
  expect(await readPilot()).toMatchObject({founder:true,beta:false});
});
it('an ordinary account cannot gain founder access from a missing membership', async () => {
  state.founder = false;
  await expect(currentAccess()).rejects.toThrow(/Membership context/);
});
