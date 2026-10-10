import { beforeEach, describe, it, expect, vi } from 'vitest';
import { scaffold } from '@/domains/architect/project';
const s = vi.hoisted(() => ({
  authenticated: true,
  reserveError: null as string | null,
  finishError: false,
  modelError: false,
  revision: 1,
  huge: false,
}));
const provider = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/domains/architect/model', () => ({ generateWebsite: provider }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => {
    if (!s.authenticated) throw new Error('No identity');
    return {
      person: { id: 'owner' },
      client: {
        rpc,
        from: (table: string) => {
          const query = {
            select: () => query,
            eq: () => query,
            order: () => query,
            limit: () => query,
            maybeSingle: async () => ({
              data: { id: 'project', person_id: 'owner', revision: s.revision },
              error: null,
            }),
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve(
                resolve({
                  data:
                    table === 'architect_versions'
                      ? [
                          {
                            content: {
                              ...scaffold('Example', 'Small project'),
                              ...(s.huge ? { html: 'x'.repeat(17000) } : {}),
                            },
                            html: '',
                          },
                        ]
                      : [],
                  error: null,
                }),
              ),
          };
          return query;
        },
      },
    };
  },
}));
import { generateProject, saveProject } from '@/domains/architect/service';
const input = {
  projectId: 'project',
  requestId: 'request',
  expected: 1,
  instruction: 'Improve the typography',
};
beforeEach(() => {
  vi.stubEnv('ARCHITECT_STORAGE_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_AI_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_AI_BUDGET_APPROVED', 'true');
  vi.stubEnv('ARCHITECT_AI_MODEL', 'gpt-4.1-mini');
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  s.authenticated = true;
  s.reserveError = null;
  s.finishError = false;
  s.modelError = false;
  s.revision = 1;
  s.huge = false;
  provider.mockReset();
  rpc.mockReset();
  provider.mockResolvedValue(scaffold('Example', 'Proposed source'));
  rpc.mockImplementation(async (name: string) => ({
    data: 1,
    error:
      name === 'architect_reserve' && s.reserveError
        ? { code: s.reserveError }
        : name === 'architect_finish' && s.finishError
          ? { code: '503' }
          : null,
  }));
});
describe('Architect request lifecycle (mock provider, not live acceptance)', () => {
  it('reserves before a single model call, saves a draft receipt and never replaces canonical source', async () => {
    const result = await generateProject(input, new AbortController().signal);
    expect(result.draft.name).toBe('Example');
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['architect_reserve', 'architect_finish']);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(provider.mock.invocationCallOrder[0]!);
  });
  it('makes no model call without configuration, permission, a current version or identity', async () => {
    vi.stubEnv('ARCHITECT_AI_BUDGET_APPROVED', 'false');
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow(
      /configured/,
    );
    vi.stubEnv('ARCHITECT_AI_BUDGET_APPROVED', 'true');
    s.reserveError = '42501';
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow(
      /permission/,
    );
    s.reserveError = null;
    s.revision = 2;
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow(/changed/);
    s.authenticated = false;
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled();
  });
  it('never retries a duplicate reservation and retains failed jobs', async () => {
    s.reserveError = '23505';
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow(
      /already reserved/,
    );
    expect(provider).not.toHaveBeenCalled();
    s.reserveError = null;
    provider.mockRejectedValue(new Error('provider failed'));
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow(
      /remains counted/,
    );
    expect(rpc).toHaveBeenLastCalledWith('architect_finish', { p_id: 'request', p_output: null });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('does not report success after an uncertain receipt write', async () => {
    s.finishError = true;
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow(/receipt/);
    expect(rpc.mock.calls.some((c) => c[0] === 'architect_save')).toBe(false);
  });
  it('rejects oversized model input before reservation or inference', async () => {
    s.huge = true;
    await expect(generateProject(input, new AbortController().signal)).rejects.toThrow(/16 KB/);
    expect(rpc).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
  it('fails closed when storage is disabled', async () => {
    vi.stubEnv('ARCHITECT_STORAGE_ENABLED', 'false');
    await expect(saveProject('p', 'v', 0, scaffold('Example', 'brief'))).rejects.toThrow(
      /not enabled/,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects oversized UTF-8 cloud source before an ambiguous database write', async () => {
    const source = {
      ...scaffold('Example', 'brief'),
      html: '界'.repeat(40000),
      css: '界'.repeat(40000),
    };
    await expect(saveProject('p', 'v', 0, source)).rejects.toThrow(/180 KB/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
