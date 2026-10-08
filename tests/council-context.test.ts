import { describe, it, expect, vi, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({
  owner: 'member-a',
  companyId: null as string | null,
  missionConversation: 'cd000000-0000-4000-8000-000000000001',
  missionFailure: false,
  rpcCalls: [] as string[],
  filters: [] as Array<{ table: string; column: string; value: unknown }>,
  bridge: vi.fn(async () => 'PRIVATE_FOUNDER_NOTEBOOK'),
}));
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/intelligence/founder-bridge', () => ({
  founderBridgeContext: state.bridge,
}));
vi.mock('../src/domains/intelligence/model', () => ({
  generateConversationTitle: vi.fn(),
  summarizeThread: vi.fn(),
}));
vi.mock('../src/domains/access/current', () => ({
  currentAccess: async () => ({ has: () => true }),
}));
vi.mock('../src/domains/person/current', () => ({
  currentPerson: async () => ({
    id: state.owner,
    display_name: state.owner,
    priority: state.owner + ' priority',
    timezone: 'UTC',
    unit_system: 'metric',
    updated_at: '2026-10-04',
  }),
}));
vi.mock('../src/domains/identity/current', () => ({
  currentIdentity: async () => ({
    client: {
      rpc: async (name: string) => {
        state.rpcCalls.push(name);
        return name === 'mission_capture_context'
          ? {
              data: state.missionFailure
                ? null
                : { objective: 'SELECTED_MISSION_ONLY', revision: 2 },
              error: state.missionFailure ? { code: '40001' } : null,
            }
          : { data: true, error: null };
      },
      from: (table: string) => {
        const owner = state.owner;
        const result = (single = false) => {
          const data =
            table === 'intelligence_missions'
              ? { conversation_id: state.missionConversation }
              : table === 'ai_conversations'
                ? single
                  ? {
                      id: 'conversation',
                      company_id: state.companyId,
                      context_summary: '',
                      summary_through: null,
                    }
                  : []
                : table === 'companies' || table === 'company_turn_context'
                  ? {
                      id: state.companyId,
                      company_id: state.companyId,
                      name: 'Synthetic selected company',
                      brief: 'SELECTED_COMPANY_ONLY',
                      version: 2,
                      confirmed_at: '2026-10-06T00:00:00Z',
                    }
                  : table === 'ai_memories'
                    ? [
                        {
                          id: 'memory',
                          content: owner + ' owner context',
                          kind: 'fact',
                          confirmed_at: '2026-10-04',
                        },
                      ]
                    : table === 'goals'
                      ? single
                        ? {
                            title: owner + ' goal',
                            next_step: 'Plan',
                            reason: 'Focus',
                            updated_at: '2026-10-04',
                          }
                        : []
                      : [];
          return { data, error: null, count: 0 };
        };
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            state.filters.push({ table, column, value });
            return builder;
          },
          order: () => builder,
          limit: () => builder,
          lte: () => builder,
          lt: () => builder,
          maybeSingle: async () => result(true),
          single: async () => result(true),
          then: <T>(resolve: (value: ReturnType<typeof result>) => T) =>
            Promise.resolve(resolve(result())),
        };
        return builder;
      },
    },
  }),
}));
import { prepareReply } from '../src/domains/intelligence/service';
const input = {
  conversationId: 'cd000000-0000-4000-8000-000000000001',
  requestId: 'cd000000-0000-4000-8000-000000000002',
  text: 'Review owner context',
  includeContext: true,
  savedSources: { profile: true, goals: true, memory: true, daily: true, lifestyle: true },
  council: { kind: 'specialist' as const, specialists: ['athena' as const] },
};
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-not-live');
  state.owner = 'member-a';
  state.companyId = null;
  state.filters = [];
  state.rpcCalls = [];
  state.missionFailure = false;
  state.missionConversation = input.conversationId;
  state.bridge.mockClear();
});
describe('Council member context boundary', () => {
  it('excluded categories are neither read nor supplied to Talk or Council', async () => {
    const result = await prepareReply({
      ...input,
      savedSources: { profile: false, goals: true, memory: false, daily: false, lifestyle: false },
    });
    expect(JSON.stringify(result.messages)).toContain('member-a goal');
    for (const table of [
      'ai_memories',
      'daily_entries',
      'daily_reviews',
      'ascend_profile_facts',
      'life_captures',
      'grooming_profiles',
    ])
      expect(state.filters.some((f) => f.table === table)).toBe(false);
    expect(JSON.stringify(result.messages)).not.toContain('member-a priority');
  });
  it('an older client without source selection shares no saved personal categories', async () => {
    const result = await prepareReply({ ...input, savedSources: undefined });
    expect(JSON.stringify(result.messages)).not.toContain('member-a goal');
    expect(state.filters.some((f) => f.table === 'ai_memories')).toBe(false);
  });

  it('loads only the session owner context and never requests founder bridge', async () => {
    const a = await prepareReply(input);
    state.owner = 'member-b';
    const b = await prepareReply(input);
    const serializedA = JSON.stringify(a.messages),
      serializedB = JSON.stringify(b.messages);
    expect(serializedA).toContain('member-a goal');
    expect(serializedA).not.toContain('member-b');
    expect(serializedB).toContain('member-b goal');
    expect(serializedB).not.toContain('member-a');
    expect(serializedA + serializedB).not.toContain('PRIVATE_FOUNDER_NOTEBOOK');
    expect(state.bridge).not.toHaveBeenCalled();
    expect(a.founder).toBe(false);
    expect(b.founder).toBe(false);
    for (const owner of ['member-a', 'member-b'])
      for (const table of [
        'ai_memories',
        'goals',
        'daily_entries',
        'daily_reviews',
        'ascend_profile_facts',
        'ai_conversations',
        'ai_turns',
      ])
        expect(state.filters).toContainEqual({ table, column: 'person_id', value: owner });
  });
  it('ordinary founder-capable Talk also never retrieves the private notebook', async () => {
    const result = await prepareReply({ ...input, council: undefined });
    expect(state.bridge).not.toHaveBeenCalled();
    expect(result.founder).toBe(false);
    expect(JSON.stringify(result.messages)).not.toContain('PRIVATE_FOUNDER_NOTEBOOK');
  });
  it('context opt-out prevents personal context queries and founder bridge access', async () => {
    const result = await prepareReply({
      ...input,
      includeContext: false,
      savedSources: undefined,
      council: { kind: 'table', specialists: ['athena', 'themis'] },
    });
    expect(JSON.stringify(result.messages)).not.toContain('member-a priority');
    expect(state.filters.some((filter) => filter.table === 'ai_memories')).toBe(false);
    expect(state.bridge).not.toHaveBeenCalled();
  });
});

describe('company Talk retrieval boundary', () => {
  it('uses its confirmed snapshot without querying personal context or the founder bridge', async () => {
    state.companyId = 'company-a';
    const result = await prepareReply({
      ...input,
      companyId: 'company-a',
      includeContext: false,
      savedSources: undefined,
      council: undefined,
    });
    expect(JSON.stringify(result.messages)).toContain('SELECTED_COMPANY_ONLY');
    expect(
      state.filters.some((filter) =>
        [
          'ai_memories',
          'goals',
          'daily_entries',
          'daily_reviews',
          'ascend_profile_facts',
          'grooming_profiles',
        ].includes(filter.table),
      ),
    ).toBe(false);
    expect(state.filters).toContainEqual({
      table: 'companies',
      column: 'person_id',
      value: state.owner,
    });
    expect(state.filters).toContainEqual({
      table: 'company_turn_context',
      column: 'company_id',
      value: 'company-a',
    });
    expect(state.bridge).not.toHaveBeenCalled();
  });
  it('denies company threads through the legacy personal-context path', async () => {
    state.companyId = 'company-a';
    await expect(prepareReply({ ...input, council: undefined })).rejects.toThrow(
      'Open this conversation in its company room',
    );
    expect(state.filters.some((filter) => filter.table === 'ai_memories')).toBe(false);
  });
  it('does not allow personal context in company mode', async () => {
    await expect(prepareReply({ ...input, companyId: 'company-a' })).rejects.toThrow(
      'Unsupported company context',
    );
  });
});

it('gives an explicitly summoned specialist the same company snapshot and no personal retrieval', async () => {
  state.companyId = 'company-a';
  const result = await prepareReply({ ...input, companyId: 'company-a', includeContext: false, savedSources:undefined });
  expect(result.council).toEqual(input.council);
  expect(JSON.stringify(result.messages)).toContain('SELECTED_COMPANY_ONLY');
  expect(state.filters.some((filter) => filter.table === 'ai_memories')).toBe(false);
});

describe('Mission context in real reply preparation', () => {
  it('includes the captured revision for Council with personal context disabled', async () => {
    const prepared = await prepareReply({
      ...input,
      includeContext: false,
      savedSources: undefined,
      mission: { id: 'mission-a', revision: 2 },
    });
    expect(JSON.stringify(prepared.messages)).toContain('SELECTED_MISSION_ONLY');
    expect(state.rpcCalls).toContain('mission_capture_context');
    expect(state.filters.some((f) => f.table === 'ai_memories')).toBe(false);
    expect(state.filters).toContainEqual({
      table: 'intelligence_missions',
      column: 'person_id',
      value: 'member-a',
    });
  });
  it('does not fetch Mission state without the explicit scope', async () => {
    const prepared = await prepareReply({ ...input, includeContext: false, savedSources:undefined });
    expect(JSON.stringify(prepared.messages)).not.toContain('SELECTED_MISSION_ONLY');
    expect(state.rpcCalls).not.toContain('mission_capture_context');
  });
  it('rejects cross-conversation and stale Mission context before a model request', async () => {
    state.missionConversation = 'another-conversation';
    await expect(
      prepareReply({ ...input, mission: { id: 'mission-a', revision: 2 } }),
    ).rejects.toThrow('No model request was sent');
    state.missionConversation = input.conversationId;
    state.missionFailure = true;
    await expect(
      prepareReply({ ...input, mission: { id: 'mission-a', revision: 2 } }),
    ).rejects.toThrow('No model request was sent');
    expect(state.rpcCalls).toContain('ai_finish_turn');
  });
  it('rejects Mission context in a company room', async () => {
    await expect(
      prepareReply({
        ...input,
        includeContext: false,
        savedSources: undefined,
        companyId: 'company-a',
        mission: { id: 'mission-a', revision: 2 },
      }),
    ).rejects.toThrow('cannot enter a company room');
  });
});
