import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  person: '00000000-0000-4000-8000-000000000001',
  access: true,
  rows: [] as Array<Record<string, unknown>>,
  conversations: new Map<string, string>([
    ['30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'],
  ]),
  rpcs: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock('server-only', () => ({}));
vi.mock('../src/domains/access/current', () => ({
  currentAccess: async () => ({ has: (key: string) => state.access && key === 'aurelius.context' }),
}));
vi.mock('../src/domains/artifacts/service', () => ({
  proposeImage: vi.fn(),
  reviewArtifact: vi.fn(),
  readArtifacts: async () => ({ artifacts: [], selectedId: null }),
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
  intelligenceSession: async () => ({
    person: { id: state.person },
    client: {
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const builder = {
          select: () => builder,
          eq: (key: string, value: unknown) => {
            filters[key] = value;
            return builder;
          },
          is: (key: string, value: unknown) => {
            filters[key] = value;
            return builder;
          },
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => {
            if (table === 'ai_conversations') {
              const allowed = state.conversations.get(String(filters.id)) === filters.person_id;
              return { data: allowed ? { id: filters.id } : null, error: null };
            }
            if (table === 'ai_talk_creations' && filters.id) {
              const row = state.rows.find(
                (item) =>
                  item.id === filters.id &&
                  item.person_id === filters.person_id &&
                  item.conversation_id === filters.conversation_id &&
                  item.kind === filters.kind,
              );
              return { data: row ?? null, error: null };
            }
            return { data: null, error: null };
          },
          then: <T>(resolve: (value: { data: unknown[]; error: null }) => T) => {
            const rows =
              table === 'ai_talk_creations'
                ? state.rows.filter(
                    (item) =>
                      item.person_id === filters.person_id &&
                      item.conversation_id === filters.conversation_id &&
                      (filters.superseded_by === null ? item.superseded_by === null : true),
                  )
                : [];
            return Promise.resolve(resolve({ data: rows, error: null }));
          },
        };
        return builder;
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        state.rpcs.push({ name, args });
        if (name !== 'ai_talk_save_creation') return { data: null, error: { message: 'unexpected' } };
        const existing = state.rows.find((item) => item.id === args.p_id);
        if (existing) {
          if (
            existing.person_id === state.person &&
            existing.conversation_id === args.p_conversation &&
            existing.kind === args.p_kind &&
            JSON.stringify(existing.content) === JSON.stringify(args.p_content)
          ) {
            return {
              data: {
                id: existing.id,
                lineageId: existing.lineage_id,
                version: existing.version,
                recovered: true,
              },
              error: null,
            };
          }
          return { data: null, error: { message: 'Creation request reused with different inputs' } };
        }
        const row = {
          id: args.p_id,
          person_id: state.person,
          conversation_id: args.p_conversation,
          source_turn_id: args.p_turn,
          lineage_id: args.p_id,
          version: 1,
          kind: args.p_kind,
          content: args.p_content,
          predecessor_id: args.p_predecessor,
          superseded_by: null,
          created_at: '2026-10-13T00:00:00.000Z',
        };
        state.rows.push(row);
        return { data: { id: row.id, lineageId: row.lineage_id, version: 1 }, error: null };
      },
    },
  }),
}));

import { prepareArchitectHandoff } from '../src/domains/talk-creation/service';

const conversation = '30000000-0000-4000-8000-000000000001';
const briefV1 = '50000000-0000-4000-8000-000000000011';
const briefV2 = '50000000-0000-4000-8000-000000000012';
const handoffId = '70000000-0000-4000-8000-000000000011';
const packageContent = {
  schema: 'talk-architect-handoff/v1' as const,
  conversationId: conversation,
  preparedAt: '2026-10-13T00:00:00.000Z',
  discipline: 'business' as const,
  idea: 'A premium brand and website.',
  description: '',
  decisions: '',
  selections: [
    {
      kind: 'brief' as const,
      lineageId: briefV1,
      versionId: briefV1,
      version: 1,
      title: 'Reserve brand',
    },
  ],
  images: [],
  imported: false as const,
};
const request = {
  id: handoffId,
  conversationId: conversation,
  discipline: 'business' as const,
  idea: 'A premium brand and website.',
  decisions: '',
  creationIds: [briefV1],
  imageIds: [],
  preparedAt: '2026-10-13T00:00:00.000Z',
};

function seedHandoff() {
  state.rows.push({
    id: handoffId,
    person_id: state.person,
    conversation_id: conversation,
    source_turn_id: null,
    lineage_id: handoffId,
    version: 1,
    kind: 'handoff',
    content: packageContent,
    predecessor_id: null,
    superseded_by: null,
    created_at: '2026-10-13T00:00:00.000Z',
  });
}

function seedBrief(id: string, supersededBy: string | null, title: string) {
  state.rows.push({
    id,
    person_id: state.person,
    conversation_id: conversation,
    source_turn_id: '40000000-0000-4000-8000-000000000011',
    lineage_id: briefV1,
    version: id === briefV1 ? 1 : 2,
    kind: 'brief',
    content: {
      title,
      purpose: 'A premium brand and website.',
      audience: 'Founders',
      visualDirection: 'Obsidian and gold',
      requirements: ['Phone first'],
      unresolved: ['Typeface'],
    },
    predecessor_id: id === briefV1 ? null : briefV1,
    superseded_by: supersededBy,
    created_at: '2026-10-13T00:00:00.000Z',
  });
}

beforeEach(() => {
  state.person = '00000000-0000-4000-8000-000000000001';
  state.access = true;
  state.rows = [];
  state.conversations = new Map([[conversation, '00000000-0000-4000-8000-000000000001']]);
  state.rpcs = [];
});

describe('Talk Architect handoff recovery', () => {
  it('returns the original receipt when the source brief was revised after commit', async () => {
    seedBrief(briefV1, briefV2, 'Reserve brand');
    seedBrief(briefV2, null, 'Revised brand');
    seedHandoff();
    const recovered = await prepareArchitectHandoff(request);
    expect(recovered).toMatchObject({
      id: handoffId,
      lineageId: handoffId,
      version: 1,
      recovered: true,
      imported: false,
      content: packageContent,
    });
    expect(state.rpcs).toEqual([]);
  });

  it('rejects the same identity with a different payload and denies a foreign owner', async () => {
    seedHandoff();
    await expect(prepareArchitectHandoff({ ...request, idea: 'A different package.' })).rejects.toMatchObject({
      status: 409,
    });
    state.person = '00000000-0000-4000-8000-000000000099';
    await expect(prepareArchitectHandoff(request)).rejects.toMatchObject({ status: 404 });
    expect(state.rpcs).toEqual([]);
  });

  it('denies recovery when access is revoked', async () => {
    seedHandoff();
    state.access = false;
    await expect(prepareArchitectHandoff(request)).rejects.toMatchObject({ status: 403 });
  });

  it('validates current selections only for a genuinely new request', async () => {
    seedBrief(briefV1, briefV2, 'Reserve brand');
    seedBrief(briefV2, null, 'Revised brand');
    await expect(prepareArchitectHandoff({ ...request, id: '70000000-0000-4000-8000-000000000099' })).rejects.toMatchObject(
      { status: 409 },
    );
    expect(state.rpcs).toEqual([]);
  });

  it('returns one recovered receipt for concurrent exact replays', async () => {
    seedBrief(briefV1, briefV2, 'Reserve brand');
    seedBrief(briefV2, null, 'Revised brand');
    seedHandoff();
    const [left, right] = await Promise.all([
      prepareArchitectHandoff(request),
      prepareArchitectHandoff(request),
    ]);
    expect(left.id).toBe(right.id);
    expect(left.recovered).toBe(true);
    expect(right.recovered).toBe(true);
    expect(state.rows.filter((item) => item.kind === 'handoff')).toHaveLength(1);
  });
});
