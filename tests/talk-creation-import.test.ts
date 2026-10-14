import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  person: '00000000-0000-4000-8000-000000000001',
  access: true,
  originReady: true,
  rows: [] as Array<Record<string, unknown>>,
  receipts: [] as Array<Record<string, unknown>>,
  saves: [] as Array<Record<string, unknown>>,
  conversations: new Map<string, string>([
    ['30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'],
  ]),
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
vi.mock('../src/domains/architect-origin/service', () => ({
  originReady: () => state.originReady,
  saveOrigin: async (input: Record<string, unknown>) => {
    state.saves.push(input);
    return { revision: 1, requestId: input.requestId, personId: state.person };
  },
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
            if (table === 'ai_talk_origin_imports') {
              const row = state.receipts.find((item) =>
                Object.entries(filters).every(([key, value]) => item[key] === value),
              );
              return { data: row ?? null, error: null };
            }
            if (table === 'ai_talk_creations' && filters.id) {
              const row = state.rows.find((item) =>
                Object.entries(filters).every(([key, value]) => item[key] === value),
              );
              return { data: row ?? null, error: null };
            }
            return { data: null, error: null };
          },
          then: <T>(resolve: (value: { data: unknown[]; error: null }) => T) =>
            Promise.resolve(resolve({ data: [], error: null })),
        };
        return builder;
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name !== 'ai_talk_record_origin_import')
          return { data: null, error: { message: 'unexpected' } };
        const existing = state.receipts.find(
          (item) => item.id === args.p_id || item.handoff_id === args.p_handoff,
        );
        if (existing) {
          if (
            existing.handoff_id !== args.p_handoff ||
            existing.project_id !== args.p_project ||
            existing.save_id !== args.p_save ||
            existing.prepared_at !== args.p_prepared
          )
            return { data: null, error: { message: 'Import request reused with different inputs' } };
          return {
            data: {
              id: existing.id,
              handoffId: existing.handoff_id,
              projectId: existing.project_id,
              saveId: existing.save_id,
              recovered: true,
            },
            error: null,
          };
        }
        const row = {
          id: args.p_id,
          person_id: state.person,
          handoff_id: args.p_handoff,
          conversation_id: args.p_conversation,
          project_id: args.p_project,
          save_id: args.p_save,
          prepared_at: args.p_prepared,
        };
        state.receipts.push(row);
        return {
          data: {
            id: row.id,
            handoffId: row.handoff_id,
            projectId: row.project_id,
            saveId: row.save_id,
            recovered: false,
          },
          error: null,
        };
      },
    },
  }),
}));

import { importArchitectHandoff, reviewArchitectImport } from '../src/domains/talk-creation/service';

const conversation = '30000000-0000-4000-8000-000000000001';
const briefId = '50000000-0000-4000-8000-000000000011';
const handoffId = '70000000-0000-4000-8000-000000000011';
const importId = '80000000-0000-4000-8000-000000000011';

beforeEach(() => {
  state.person = '00000000-0000-4000-8000-000000000001';
  state.access = true;
  state.originReady = true;
  state.saves = [];
  state.receipts = [];
  state.rows = [
    {
      id: briefId,
      person_id: state.person,
      conversation_id: conversation,
      source_turn_id: null,
      lineage_id: briefId,
      version: 1,
      kind: 'brief',
      content: {
        title: 'Reserve site',
        purpose: 'A premium brand and website.',
        audience: 'Founders',
        visualDirection: 'Obsidian and gold',
        requirements: ['Phone first'],
        unresolved: ['Typeface'],
      },
      predecessor_id: null,
      superseded_by: null,
      created_at: '2026-10-14T00:00:00.000Z',
    },
    {
      id: handoffId,
      person_id: state.person,
      conversation_id: conversation,
      source_turn_id: null,
      lineage_id: handoffId,
      version: 1,
      kind: 'handoff',
      content: {
        schema: 'talk-architect-handoff/v1',
        conversationId: conversation,
        preparedAt: '2026-10-14T00:00:00.000Z',
        discipline: 'business',
        idea: 'A premium brand and website.',
        description: '',
        decisions: 'Keep emerald restrained.',
        selections: [
          {
            kind: 'brief',
            lineageId: briefId,
            versionId: briefId,
            version: 1,
            title: 'Reserve site',
          },
        ],
        images: [],
        imported: false,
      },
      predecessor_id: null,
      superseded_by: null,
      created_at: '2026-10-14T00:00:00.000Z',
    },
  ];
});

describe('Talk Origin import service', () => {
  it('reviews the resolved package and creates one Origin project on confirm', async () => {
    const preview = await reviewArchitectImport(handoffId);
    expect(preview.imported).toBe(false);
    expect(preview.project.name).toBe('Reserve site');
    const first = await importArchitectHandoff({
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    });
    expect(first).toMatchObject({ imported: true, recovered: false, projectId: first.projectId });
    expect(first.transfer.imagesCopied).toBe(false);
    expect(state.saves).toHaveLength(1);
    expect(state.saves[0]).toMatchObject({ note: 'Imported from Talk', expected: 0 });
    const retry = await importArchitectHandoff({
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    });
    expect(retry.projectId).toBe(first.projectId);
    expect(retry.recovered).toBe(true);
    expect(state.saves).toHaveLength(1);
    const concurrent = await Promise.all([
      importArchitectHandoff({
        action: 'import-origin',
        id: '80000000-0000-4000-8000-000000000012',
        handoffId,
        conversationId: conversation,
      }),
      importArchitectHandoff({
        action: 'import-origin',
        id: '80000000-0000-4000-8000-000000000013',
        handoffId,
        conversationId: conversation,
      }),
    ]);
    expect(new Set(concurrent.map((item) => item.projectId))).toEqual(new Set([first.projectId]));
    expect(state.saves).toHaveLength(1);
  });

  it('keeps imported false when Origin is unavailable and rejects foreign or mismatched reuse', async () => {
    state.originReady = false;
    await expect(
      importArchitectHandoff({
        action: 'import-origin',
        id: importId,
        handoffId,
        conversationId: conversation,
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(state.saves).toEqual([]);
    expect(state.receipts).toEqual([]);
    state.originReady = true;
    await importArchitectHandoff({
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    });
    await expect(
      importArchitectHandoff({
        action: 'import-origin',
        id: importId,
        handoffId: '70000000-0000-4000-8000-000000000099',
        conversationId: conversation,
      }),
    ).rejects.toMatchObject({ status: 409 });
    state.person = '00000000-0000-4000-8000-000000000002';
    await expect(reviewArchitectImport(handoffId)).rejects.toMatchObject({ status: 404 });
    await expect(
      importArchitectHandoff({
        action: 'import-origin',
        id: '80000000-0000-4000-8000-000000000099',
        handoffId,
        conversationId: conversation,
      }),
    ).rejects.toMatchObject({ status: 404 });
    state.person = '00000000-0000-4000-8000-000000000001';
    state.access = false;
    await expect(
      importArchitectHandoff({
        action: 'import-origin',
        id: '80000000-0000-4000-8000-000000000098',
        handoffId,
        conversationId: conversation,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
