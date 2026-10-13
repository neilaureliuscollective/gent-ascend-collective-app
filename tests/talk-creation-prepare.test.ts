import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rpcs: [] as string[],
  attachment: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../src/domains/access/founder', () => ({
  currentFounderAccess: async () => false,
}));
vi.mock('../src/domains/access/current', () => ({
  currentAccess: async () => ({ has: () => true }),
}));
vi.mock('../src/domains/person/current', () => ({
  currentPerson: async () => ({
    id: 'owner',
    display_name: 'Owner',
    priority: 'Build',
    timezone: 'UTC',
    unit_system: 'metric',
    updated_at: '2026-10-13',
  }),
}));
vi.mock('../src/domains/talk-creation/service', () => ({
  readTalkAttachment: (...args: unknown[]) => state.attachment(...args),
}));
vi.mock('../src/domains/identity/current', () => ({
  currentIdentity: async () => ({
    client: {
      rpc: async (name: string) => {
        state.rpcs.push(name);
        return { data: true, error: null };
      },
      from: (table: string) => {
        const result = (single = false) => ({
          data:
            table === 'ai_conversations'
              ? { id: 'conversation', company_id: null, context_summary: '', summary_through: null }
              : table === 'ai_talk_selection'
                ? []
                : table === 'ai_artifact_selection'
                  ? null
                  : table === 'ai_conversation_artifacts'
                    ? []
                    : table === 'ai_turns'
                      ? []
                      : single
                        ? null
                        : [],
          error: null,
          count: 0,
        });
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in: () => builder,
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
vi.mock('../src/domains/intelligence/model', () => ({
  generateConversationTitle: vi.fn(),
  summarizeThread: vi.fn(),
}));

import { prepareReply, IntelligenceError } from '../src/domains/intelligence/service';

const input = {
  conversationId: '30000000-0000-4000-8000-000000000001',
  requestId: '40000000-0000-4000-8000-000000000001',
  text: 'Look at this attachment',
  includeContext: false,
  attachmentId: '50000000-0000-4000-8000-000000000001',
};

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-not-live');
  state.rpcs = [];
  state.attachment.mockReset();
});

describe('Talk attachment reservation', () => {
  it('resolves a valid attachment before reserving a turn', async () => {
    state.attachment.mockResolvedValue({
      id: input.attachmentId,
      projectId: '60000000-0000-4000-8000-000000000001',
      mediaType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });
    await prepareReply(input);
    expect(state.attachment).toHaveBeenCalledWith(input.attachmentId);
    expect(state.rpcs[0]).toBe('ai_begin_turn');
  });

  it('fails missing or inaccessible attachments without reserving', async () => {
    state.attachment.mockRejectedValue(new IntelligenceError('Attachment unavailable.', 404));
    await expect(prepareReply(input)).rejects.toThrow(/Attachment unavailable/);
    expect(state.rpcs).toEqual([]);
    await expect(
      prepareReply({ ...input, requestId: '40000000-0000-4000-8000-000000000002' }),
    ).rejects.toThrow(/Attachment unavailable/);
    expect(state.rpcs).toEqual([]);
  });
});
