import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  intelligence: vi.fn(),
  founder: vi.fn(),
  access: vi.fn(),
  originReady: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: session.intelligence,
}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: session.founder }));
vi.mock('@/domains/access/current', () => ({ currentAccess: session.access }));
vi.mock('@/domains/architect-origin/service', () => ({ originReady: session.originReady }));

import { GET } from '../src/app/api/command-home/route';
import { IntelligenceError } from '../src/domains/intelligence/service';
import { readCommandHome } from '../src/domains/command-home/service';

const owner = '60000000-0000-4000-8000-000000000001';
const tables: Record<string, unknown[]> = {};

function from(table: string) {
  const rows = tables[table] ?? [];
  const filters: { column: string; value: unknown }[] = [];
  const query = {
    select() {
      return query;
    },
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return query;
    },
    is() {
      return query;
    },
    in() {
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    maybeSingle() {
      const data = apply()[0] ?? null;
      return Promise.resolve({ data, error: null });
    },
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      return Promise.resolve({ data: apply(), error: null }).then(resolve);
    },
  };
  function apply() {
    return rows.filter((row) =>
      filters.every((filter) => (row as Record<string, unknown>)[filter.column] === filter.value),
    ) as unknown[];
  }
  return query;
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  session.intelligence.mockResolvedValue({
    person: { id: owner },
    client: { from },
  });
  session.founder.mockResolvedValue(false);
  session.access.mockResolvedValue(new Set(['aurelius.context']));
  session.originReady.mockReturnValue(true);
  tables.architect_origin_projects = [];
  tables.architect_origin_runs = [];
  tables.companies = [];
  tables.company_jobs = [];
  tables.company_work_versions = [];
  tables.ai_studio_projects = [];
  tables.ai_studio_versions = [];
  tables.ai_conversations = [];
});

describe('Command home access', () => {
  it('returns 401 JSON for anonymous API reads and never calls founder office data', async () => {
    session.intelligence.mockRejectedValue(new IntelligenceError('Sign in to use your Aethelios workspace.', 401));
    const response = await GET(new Request('http://127.0.0.1/api/command-home'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Sign in to use your Aethelios workspace.' });
  });

  it('keeps ordinary users on owner-scoped home data without founder records', async () => {
    tables.architect_origin_projects = [
      {
        id: '61000000-0000-4000-8000-000000000001',
        person_id: owner,
        updated_at: '2026-10-14T15:00:00.000Z',
        content: { name: 'Owned project', description: 'Saved', status: 'active', documents: [] },
      },
    ];
    const home = await readCommandHome();
    expect(home.ownerId).toBe(owner);
    expect(home.founderOffice).toBe(false);
    expect(home.items[0]?.title).toBe('Owned project');
    expect(session.founder).toHaveBeenCalledTimes(1);
  });

  it('marks founder office availability without loading founder-only tables', async () => {
    session.founder.mockResolvedValue(true);
    const home = await readCommandHome();
    expect(home.founderOffice).toBe(true);
    expect(home.items).toEqual([]);
    expect(Object.keys(tables)).not.toContain('founder_access');
  });

  it('does not query Architect tables when Origin is awaiting setup', async () => {
    session.originReady.mockReturnValue(false);
    const home = await readCommandHome();
    expect(home.sources.find((source) => source.id === 'architect')?.state).toBe('awaiting');
    expect(tables.architect_origin_projects).toEqual([]);
  });
});
