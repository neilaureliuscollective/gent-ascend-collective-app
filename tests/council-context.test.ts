import { describe, it, expect, vi, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({
  owner: 'member-a',
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
      rpc: async () => ({ data: true, error: null }),
      from: (table: string) => {
        const owner = state.owner;
        const result = (single = false) => {
          const data =
            table === 'ai_conversations'
              ? single
                ? { id: 'conversation', context_summary: '', summary_through: null }
                : []
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
  council: { kind: 'specialist' as const, specialists: ['athena' as const] },
};
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-not-live');
  state.owner = 'member-a';
  state.filters = [];
  state.bridge.mockClear();
});
describe('Council member context boundary', () => {
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
  it('context opt-out prevents personal context queries and founder bridge access', async () => {
    const result = await prepareReply({
      ...input,
      includeContext: false,
      council: { kind: 'table', specialists: ['athena', 'themis'] },
    });
    expect(JSON.stringify(result.messages)).not.toContain('member-a priority');
    expect(state.filters.some((filter) => filter.table === 'ai_memories')).toBe(false);
    expect(state.bridge).not.toHaveBeenCalled();
  });
});

it('applies category exclusion before ordinary and Council provider messages and avoids excluded reads', async () => {
  for (const council of [undefined, input.council]) {
    state.filters = [];
    const result = await prepareReply({ ...input, council, contextSources: { profile: false, goals: true, memory: false, daily: false, lifestyle: false } });
    expect(JSON.stringify(result.messages)).toContain('member-a goal');
    expect(JSON.stringify(result.messages)).not.toContain('member-a priority');
    for (const excluded of ['ai_memories', 'daily_entries', 'daily_reviews', 'ascend_profile_facts', 'life_captures']) expect(state.filters.some(filter => filter.table === excluded)).toBe(false);
    expect(state.bridge).not.toHaveBeenCalled();
    expect(result.founder).toBe(false);
  }
});
it('all sources excluded performs no saved-context queries', async () => {
  await prepareReply({ ...input, contextSources: { profile: false, goals: false, memory: false, daily: false, lifestyle: false } });
  expect(state.filters.some(filter => filter.table === 'goals')).toBe(false);
  expect(state.bridge).not.toHaveBeenCalled();
});
