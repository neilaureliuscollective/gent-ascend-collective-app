import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  founder: false,
  signedIn: true,
  store: null as import('../src/domains/connections/store').ConnectionStore | null,
}));

vi.mock('server-only', () => ({}));
vi.mock('../src/domains/access/founder', () => ({
  currentFounderAccess: async () => state.founder,
}));
vi.mock('../src/domains/intelligence/service', async () => {
  const { IntelligenceError } = await vi.importActual<
    typeof import('../src/domains/intelligence/service')
  >('../src/domains/intelligence/service');
  return {
    IntelligenceError,
    intelligenceSession: async () => {
      if (!state.signedIn) throw new IntelligenceError('Sign in', 401);
      return { person: { id: '00000000-0000-4000-8000-000000000001' }, client: {} };
    },
  };
});
vi.mock('../src/domains/connections/store', async () => {
  const actual = await vi.importActual<typeof import('../src/domains/connections/store')>(
    '../src/domains/connections/store',
  );
  return {
    ...actual,
    sessionStore: () => state.store ?? actual.memoryStore(),
    founderConnectionStore: () => state.store ?? actual.memoryStore(),
  };
});

import { GET } from '../src/app/api/connections/route';
import { POST as startGithub } from '../src/app/api/connections/github/start/route';
import { memoryStore } from '../src/domains/connections/store';

function request(url: string, body: unknown = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { origin: 'https://app.test', host: 'app.test', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Connections HTTP boundaries', () => {
  beforeEach(() => {
    state.founder = false;
    state.signedIn = true;
    state.store = memoryStore();
    vi.unstubAllEnvs();
  });

  it('denies anonymous and foreign-owner reads', async () => {
    state.signedIn = false;
    expect((await GET()).status).toBe(401);
    state.signedIn = true;
    state.founder = false;
    expect((await GET()).status).toBe(403);
  });

  it('does not start GitHub authorization from a GET and requires founder access', async () => {
    const { GET: startGet } = await import('../src/app/api/connections/github/start/route');
    expect((await startGet()).status).toBe(405);
    expect(
      (await startGithub(request('https://app.test/api/connections/github/start'))).status,
    ).toBe(403);
  });

  it('reports setup required rather than connected when secrets are absent', async () => {
    state.founder = true;
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.github.status).toBe('setup_required');
    expect(body.vercel.status).toBe('setup_required');
  });
});
