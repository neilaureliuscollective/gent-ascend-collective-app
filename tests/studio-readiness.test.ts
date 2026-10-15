import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  founder: false,
  calls: [] as unknown[][],
  error: null as null | { code: string },
  session: vi.fn(),
}));
vi.mock('../src/domains/access/founder', () => ({
  currentFounderAccess: async () => state.founder,
}));
vi.mock('../src/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: state.session,
}));
import { studioConfiguration } from '../src/domains/studio/readiness';
import { studioReadiness } from '../src/domains/studio/readiness-service';
beforeEach(() => {
  state.founder = false;
  state.calls = [];
  state.error = null;
  state.session.mockImplementation(async () => ({
    person: { id: 'owner' },
    client: {
      from: (table: string) => {
        const q = {
          select: (columns: string) => {
            state.calls.push([table, 'select', columns]);
            return q;
          },
          eq: (...args: unknown[]) => {
            state.calls.push([table, ...args]);
            return q;
          },
          limit: async (count: number) => {
            state.calls.push([table, 'limit', count]);
            return { data: [], error: state.error };
          },
        };
        return q;
      },
    },
  }));
});
afterEach(() => vi.unstubAllEnvs());
it('reports configuration presence without secrets or claiming provider acceptance', () => {
  const env = {
    OPENAI_API_KEY: 'private-openai-value',
    RUNWAYML_API_SECRET: 'private-runway-value',
    STUDIO_FOOTAGE_SIGNING_KEY: 'private-signing-value-at-least-32-characters',
    STUDIO_FOOTAGE_ENABLED: 'true',
  };
  const report = studioConfiguration(env),
    serialized = JSON.stringify(report);
  for (const value of Object.values(env).filter((v) => v.startsWith('private')))
    expect(serialized).not.toContain(value);
  expect(report.find((c) => c.name === 'Live acceptance')?.status).toBe('unverified');
  expect(studioConfiguration({}).filter((c) => c.status === 'missing')).toHaveLength(3);
});
it('denies nonfounder and anonymous contexts before schema or session probes', async () => {
  await expect(studioReadiness()).rejects.toThrow('Founder access');
  expect(state.calls).toHaveLength(0);
  expect(state.session).not.toHaveBeenCalled();
});
it('uses only session-bound owner-filtered zero-row probes and never declares live readiness', async () => {
  state.founder = true;
  const report = await studioReadiness();
  expect(report.liveAccepted).toBe(false);
  expect(report.schemas).toHaveLength(12);
  for (const table of new Set(state.calls.map((c) => c[0]))) {
    expect(state.calls).toContainEqual([table, 'person_id', 'owner']);
    expect(state.calls).toContainEqual([table, 'limit', 0]);
  }
  expect(state.calls).toContainEqual(['ai_studio_finishes', 'select', 'id,format,treatment']);
});
it('distinguishes absent schema from inconclusive permissions or network failures', async () => {
  state.founder = true;
  state.error = { code: 'PGRST205' };
  expect((await studioReadiness()).schemas.every((c) => c.status === 'missing')).toBe(true);
  state.error = { code: '42501' };
  expect((await studioReadiness()).schemas.every((c) => c.status === 'unavailable')).toBe(true);
});
