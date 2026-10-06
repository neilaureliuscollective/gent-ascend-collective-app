import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { WorkJob, WorkVersion } from '../src/domains/company-work/schema';
const state = vi.hoisted(() => ({
  job: null as WorkJob | null,
  versions: [] as WorkVersion[],
  turns: [] as Array<{
    id: string;
    person_id: string;
    conversation_id: string;
    status: string;
    user_text: string;
    assistant_text: string;
  }>,
  failSave: false,
  modelFails: false,
}));
const model = vi.hoisted(() => vi.fn());
const prepare = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('ai', () => ({ generateText: model, Output: { object: () => ({}) } }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: () => ({ responses: () => ({}) }) }));
vi.mock('../src/domains/companies/service', () => ({ readCompany: async () => state.job }));
function client() {
  return {
    from(table: string) {
      const rows: unknown[] =
        table === 'company_jobs'
          ? [state.job]
          : table === 'company_work_versions'
            ? state.versions
            : table === 'ai_turns'
              ? state.turns
              : [];
      let filtered = rows;
      const query = {
        select() {
          return query;
        },
        eq(key: string, value: unknown) {
          filtered = filtered.filter(
            (row) => row && (row as Record<string, unknown>)[key] === value,
          );
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
        then(resolve: (result: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: filtered, error: null }));
        },
      };
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === 'company_save_work') {
        if (state.failSave) return { data: null, error: { code: '40001' } };
        const existing = state.versions.find((v) => v.id === args.p_id);
        if (!existing) {
          state.versions.unshift({
            id: args.p_id as string,
            person_id: state.job!.person_id,
            company_id: state.job!.company_id,
            job_id: state.job!.id,
            revision: state.job!.revision + 1,
            content: args.p_content as WorkVersion['content'],
            source: 'model',
            source_turn: args.p_source_turn as string,
            reviewed_at: null,
            created_at: '2026-10-06T00:00:00Z',
          });
          state.job!.revision++;
        }
        return { data: args.p_id, error: null };
      }
      throw new Error('Unexpected RPC');
    },
  };
}
vi.mock('../src/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({ client: client(), person: { id: 'owner' } }),
  prepareReply: prepare,
}));
import { generateWork } from '../src/domains/company-work/service';
import { emptyWork } from '../src/domains/company-work/schema';
const companyId = 'd7000000-0000-4000-8000-000000000021',
  jobId = 'd7000000-0000-4000-8000-000000000022',
  requestId = 'd7000000-0000-4000-8000-000000000023';
const input = {
  companyId,
  jobId,
  requestId,
  expected: 0,
  instruction: 'Create the strategy and deck',
};
beforeEach(() => {
  vi.clearAllMocks();
  state.failSave = false;
  state.modelFails = false;
  state.versions = [];
  state.turns = [];
  state.job = {
    id: jobId,
    person_id: 'owner',
    company_id: companyId,
    conversation_id: 'd7000000-0000-4000-8000-000000000024',
    company_name: 'Synthetic Co',
    company_brief: 'Frozen verified brief',
    brief_version: 1,
    scope: {
      request: 'Build a launch deck',
      audience: 'Founder',
      outcome: 'A reviewed plan',
      constraints: '',
      acceptance: 'Actionable next steps',
      evidence: [],
      figures: [],
    },
    revision: 0,
    created_at: '2026-10-06T00:00:00Z',
  };
  prepare.mockImplementation(async (args) => {
    const turn = {
      id: args.requestId,
      person_id: 'owner',
      conversation_id: state.job!.conversation_id,
      status: 'pending',
      user_text: args.text,
      assistant_text: '',
    };
    state.turns.push(turn);
    return {
      model: 'test-model',
      messages: [],
      finish: async (text: string, status: string) => {
        turn.status = status;
        turn.assistant_text = text;
        return turn;
      },
    };
  });
  model.mockImplementation(async () => {
    if (state.modelFails) throw new Error('SECRET provider error');
    return {
      output: emptyWork('Synthetic strategy'),
      usage: { inputTokens: 10, outputTokens: 20 },
    };
  });
  process.env.OPENAI_API_KEY = 'test-only';
});
describe('company deliverable generation recovery', () => {
  it('saves a validated model version using only the scoped job and retained brief', async () => {
    const work = await generateWork(input, new AbortController().signal);
    expect(work.versions).toHaveLength(1);
    expect(work.job.revision).toBe(1);
    expect(work.versions[0]!.source_turn).toBe(requestId);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        conversationId: state.job!.conversation_id,
        includeContext: false,
      }),
    );
    const packet = JSON.stringify(model.mock.calls[0]![0].messages);
    expect(packet).toContain('Frozen verified brief');
    expect(packet).not.toContain('personalContext');
  });
  it('recovers a saved model reply after a failed version write without a second model request', async () => {
    state.failSave = true;
    await expect(generateWork(input, new AbortController().signal)).rejects.toThrow(
      /Model reply saved/,
    );
    expect(state.turns[0]!.status).toBe('complete');
    expect(state.versions).toHaveLength(0);
    state.failSave = false;
    const recovered = await generateWork(input, new AbortController().signal);
    expect(recovered.versions).toHaveLength(1);
    expect(model).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
  it('replays a completed generation after a lost HTTP acknowledgment without another version or model charge', async () => {
    await generateWork(input, new AbortController().signal);
    const replay = await generateWork(input, new AbortController().signal);
    expect(replay.versions).toHaveLength(1);
    expect(model).toHaveBeenCalledTimes(1);
    await expect(
      generateWork({ ...input, instruction: 'Changed retry' }, new AbortController().signal),
    ).rejects.toThrow(/request changed/);
  });
  it('records failed generation and prevents an exact retry from silently starting paid work again', async () => {
    state.modelFails = true;
    await expect(generateWork(input, new AbortController().signal)).rejects.toThrow(
      /Generation did not finish/,
    );
    expect(state.turns[0]!.status).toBe('failed');
    expect(state.versions).toHaveLength(0);
    await expect(generateWork(input, new AbortController().signal)).rejects.toThrow(/interrupted/);
    expect(model).toHaveBeenCalledTimes(1);
  });
  it('does not save generated monetary claims outside confirmed figure links', async () => {
    model.mockResolvedValueOnce({
      output: { ...emptyWork('Synthetic'), offer: 'Guaranteed $1000000 revenue' },
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    await expect(generateWork(input, new AbortController().signal)).rejects.toThrow(
      /Generation did not finish/,
    );
    expect(state.versions).toHaveLength(0);
    expect(state.turns[0]!.status).toBe('failed');
  });
  it('rejects stale revisions and changed recovery instructions before any model call', async () => {
    state.job!.revision = 1;
    await expect(generateWork(input, new AbortController().signal)).rejects.toThrow(/Work changed/);
    expect(model).not.toHaveBeenCalled();
    state.job!.revision = 0;
    state.failSave = true;
    await expect(generateWork(input, new AbortController().signal)).rejects.toThrow();
    await expect(
      generateWork({ ...input, instruction: 'Changed request' }, new AbortController().signal),
    ).rejects.toThrow(/request changed/);
    expect(model).toHaveBeenCalledTimes(1);
  });
});
