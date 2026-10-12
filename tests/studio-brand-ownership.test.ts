import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ logo: false, filters: [] as unknown[][], update: vi.fn() }));
vi.mock('../src/domains/studio/service', async (original) => {
  const actual = await original<typeof import('../src/domains/studio/service')>();
  return {
    ...actual,
    studioSession: async () => ({
      person: { id: 'owner' },
      client: {
        from: (table: string) => {
          const q = {
            select: () => q,
            eq: (...args: unknown[]) => {
              state.filters.push([table, ...args]);
              return q;
            },
            is: (...args: unknown[]) => {
              state.filters.push([table, ...args]);
              return q;
            },
            update: (value: unknown) => {
              state.update(value);
              return q;
            },
            maybeSingle: async () => ({
              data: table === 'ai_studio_references' && !state.logo ? null : { id: 'owned' },
              error: null,
            }),
          };
          return q;
        },
      },
    }),
  };
});
import { PATCH } from '../src/app/api/studio/route';
import { defaultBrandKit } from '../src/domains/studio/brand';
const project = '10000000-0000-4000-8000-000000000001',
  logo = '10000000-0000-4000-8000-000000000002';
function request() {
  return new Request('https://app.test/api/studio', {
    method: 'PATCH',
    headers: { origin: 'https://app.test', host: 'app.test', 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: project,
      updatedAt: '2026-10-12T00:00:00Z',
      title: 'Brand',
      creativeType: 'campaign',
      brief: {
        purpose: '',
        audience: '',
        direction: '',
        palette: '',
        avoid: '',
        brand: { ...defaultBrandKit, logoReferenceId: logo },
      },
    }),
  });
}
beforeEach(() => {
  state.logo = false;
  state.filters = [];
  vi.clearAllMocks();
});
describe('Studio brand original ownership', () => {
  it('refuses a logo outside the owned project before writing its brand kit', async () => {
    const response = await PATCH(request());
    expect(response.status).toBe(422);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.filters).toEqual(
      expect.arrayContaining([
        ['ai_studio_references', 'id', logo],
        ['ai_studio_references', 'project_id', project],
        ['ai_studio_references', 'person_id', 'owner'],
      ]),
    );
  });
  it('keeps person, personal-project and stale-write boundaries on an accepted logo', async () => {
    state.logo = true;
    expect((await PATCH(request())).status).toBe(200);
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.filters).toEqual(
      expect.arrayContaining([
        ['ai_studio_projects', 'person_id', 'owner'],
        ['ai_studio_projects', 'company_id', null],
        ['ai_studio_projects', 'updated_at', '2026-10-12T00:00:00Z'],
      ]),
    );
  });
});
