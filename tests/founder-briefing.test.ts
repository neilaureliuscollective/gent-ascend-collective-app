import { beforeEach, describe, expect, it, vi } from 'vitest';
import { founderOfficeFixture } from './component-fixture/founder-office-data';
const state = vi.hoisted(() => ({
  founder: true,
  turn: null as null | Record<string, unknown>,
  mission: null as null | { id: string },
  failMission: false,
}));
const prepare = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const generate = vi.hoisted(() =>
  vi.fn(async function* () {
    yield { type: 'text', text: 'Synthetic portfolio review' };
    yield { type: 'finish', reason: 'stop', input: 3, output: 5 };
  }),
);
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/founder-office/service', () => ({
  founderSession: async () => {
    if (!state.founder) throw new Error('Founder access required');
    return {
      person: { id: 'owner' },
      client: {
        from: (table: string) => {
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: async () => ({
              data: table === 'ai_turns' ? state.turn : state.mission,
              error: null,
            }),
          };
          return query;
        },
      },
    };
  },
  readFounderOffice: async () => founderOfficeFixture,
}));
vi.mock('../src/domains/intelligence/model', () => ({ generateReply: generate }));
vi.mock('../src/domains/intelligence/council-model', () => ({ generateCouncilReply: generate }));
vi.mock('../src/domains/intelligence/service', () => ({
  prepareReply: prepare,
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
vi.mock('../src/domains/missions/service', () => ({ createMission: create }));
import { portfolioContext, portfolioBriefing } from '../src/domains/founder-office/briefing';
const input = {
  conversationId: 'd7000000-0000-4000-8000-000000000301',
  requestId: 'd7000000-0000-4000-8000-000000000302',
  missionId: 'd7000000-0000-4000-8000-000000000303',
  text: 'Show attention across my businesses',
};
async function collect(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}
beforeEach(() => {
  state.founder = true;
  state.turn = null;
  state.mission = null;
  state.failMission = false;
  prepare.mockReset();
  create.mockReset();
  generate.mockClear();
  create.mockImplementation(async () => {
    if (state.failMission) throw new Error('Unavailable');
    state.mission = { id: input.missionId };
  });
  prepare.mockImplementation(async (args) => {
    state.turn = {
      id: args.requestId,
      conversation_id: args.conversationId,
      user_text: args.text,
      assistant_text: '',
      status: 'pending',
    };
    return {
      model: 'synthetic',
      messages: [],
      founder: true,
      finish: async (text: string, status: string) => {
        state.turn!.assistant_text = text;
        state.turn!.status = status;
        return state.turn;
      },
    };
  });
});
describe('explicit portfolio review and durable saved receipts', () => {
  it('keeps personal memory out of portfolio context and bounds source transfer', () => {
    const data = structuredClone(founderOfficeFixture);
    data.memories = [
      {
        id: 'private',
        person_id: 'owner',
        content: 'PRIVATE_WELLNESS_SENTINEL',
        kind: 'fact',
        source: 'user',
        confirmed_at: '2026-10-11',
        version: 1,
      },
    ];
    data.companies = Array.from({ length: 20 }, (_, i) => ({
      ...data.companies[0]!,
      id: String(i),
      brief: 'a'.repeat(12000),
    }));
    const packet = portfolioContext(data);
    expect(packet).not.toContain('PRIVATE_WELLNESS_SENTINEL');
    expect(packet.length).toBeLessThanOrEqual(26000);
    expect(JSON.parse(packet).companies).toHaveLength(8);
  });
  it('saves a personal portfolio mission and reply, then recovers without another provider call', async () => {
    const body = await collect(await portfolioBriefing(input, new AbortController().signal));
    expect(body).toContain('"type":"saved"');
    expect(state.turn!.status).toBe('complete');
    expect(state.turn!.user_text).toContain('[Portfolio source receipt]');
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        includeContext: false,
        text: expect.stringContaining('[Founder portfolio review] ' + input.text),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: input.missionId,
        conversation_id: input.conversationId,
        objective: input.text,
        decisions: '',
      }),
    );
    const recovered = await collect(await portfolioBriefing(input, new AbortController().signal));
    expect(recovered).toContain('Synthetic portfolio review');
    expect(generate).toHaveBeenCalledTimes(1);
    await expect(
      portfolioBriefing({ ...input, text: 'Changed request' }, new AbortController().signal),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      portfolioBriefing({ ...input, missionId: input.requestId }, new AbortController().signal),
    ).rejects.toMatchObject({ status: 409 });
    state.mission = null;
    await expect(portfolioBriefing(input, new AbortController().signal)).rejects.toMatchObject({
      status: 404,
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('does not run a model when mission persistence fails or founder authority is absent', async () => {
    state.failMission = true;
    await expect(portfolioBriefing(input, new AbortController().signal)).rejects.toMatchObject({
      status: 503,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(state.turn!.status).toBe('failed');
    state.founder = false;
    await expect(portfolioBriefing(input, new AbortController().signal)).rejects.toThrow(/Founder/);
    expect(generate).not.toHaveBeenCalled();
  });
});
