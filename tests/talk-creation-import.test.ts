import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialProject } from '../src/domains/architect-origin/schema';

const state = vi.hoisted(() => ({
  person: '00000000-0000-4000-8000-000000000001',
  access: true,
  originReady: true,
  rows: [] as Array<Record<string, unknown>>,
  receipts: [] as Array<Record<string, unknown>>,
  versions: [] as Array<Record<string, unknown>>,
  rpc: [] as string[],
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
  saveOrigin: async () => {
    throw new Error('standalone Origin save is not the import path');
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
            if (table === 'architect_origin_versions') {
              const row = state.versions.find((item) =>
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
        state.rpc.push(name);
        if (name === 'ai_talk_record_origin_import' || name === 'ai_talk_scoped_identity')
          return { data: null, error: { message: 'Could not find the function' } };
        if (name !== 'ai_talk_import_origin')
          return { data: null, error: { message: 'unexpected' } };
        const { originProjectIdentity, originSaveIdentity } = await import(
          '../src/domains/talk-creation/persist'
        );
        const { originImportNote, projectFromResolvedHandoff } = await import(
          '../src/domains/talk-creation/origin-import'
        );
        const existing = state.receipts.find(
          (item) => item.id === args.p_id || item.handoff_id === args.p_handoff,
        );
        if (existing) {
          if (
            existing.handoff_id !== args.p_handoff ||
            existing.conversation_id !== args.p_conversation
          )
            return { data: null, error: { message: 'Import request reused with different inputs' } };
          return {
            data: {
              id: existing.id,
              handoffId: existing.handoff_id,
              projectId: existing.project_id,
              saveId: existing.save_id,
              mappingVersion: 'talk-origin-import/v1',
              recovered: true,
            },
            error: null,
          };
        }
        const handoff = state.rows.find((item) => item.id === args.p_handoff);
        const brief = state.rows.find((item) => item.kind === 'brief');
        if (!handoff || handoff.kind !== 'handoff' || !brief)
          return { data: null, error: { message: 'Package unavailable' } };
        const content = handoff.content as {
          selections: Array<{
            kind: 'brief' | 'plan' | 'palette';
            lineageId: string;
            versionId: string;
            version: number;
            title: string;
          }>;
          conversationId: string;
          preparedAt: string;
          discipline: 'business';
          idea: string;
          description: string;
          decisions: string;
        };
        const mapped = projectFromResolvedHandoff({
          handoff: {
            schema: 'talk-architect-handoff/v1',
            imported: false,
            images: [],
            ...content,
          },
          sourceTurnId: null,
          brief: brief.content as import('../src/domains/talk-creation/schema').BriefContent,
          selections: [
            {
              kind: 'brief',
              lineageId: brief.lineage_id as string,
              versionId: brief.id as string,
              version: brief.version as number,
              title: 'Reserve site',
              content: brief.content as import('../src/domains/talk-creation/schema').BriefContent,
            },
          ],
          images: [],
        });
        const projectId = originProjectIdentity(state.person, String(args.p_handoff));
        const saveId = originSaveIdentity(state.person, String(args.p_handoff));
        const occupied = state.versions.find((item) => item.id === saveId);
        if (
          occupied &&
          (occupied.person_id !== state.person ||
            occupied.project_id !== projectId ||
            occupied.note !== originImportNote ||
            JSON.stringify(occupied.content) !== JSON.stringify(mapped))
        )
          return { data: null, error: { message: 'Project unavailable' } };
        const row = {
          id: args.p_id,
          person_id: state.person,
          handoff_id: args.p_handoff,
          conversation_id: args.p_conversation,
          project_id: projectId,
          save_id: saveId,
          prepared_at: content.preparedAt,
        };
        state.receipts.push(row);
        if (!occupied)
          state.versions.push({
            id: saveId,
            project_id: projectId,
            person_id: state.person,
            content: mapped,
            note: originImportNote,
          });
        return {
          data: {
            id: row.id,
            handoffId: row.handoff_id,
            projectId,
            saveId,
            mappingVersion: 'talk-origin-import/v1',
            recovered: false,
          },
          error: null,
        };
      },
    },
  }),
}));

import { importArchitectHandoff, reviewArchitectImport } from '../src/domains/talk-creation/service';
import { originProjectIdentity, originSaveIdentity } from '../src/domains/talk-creation/persist';

const conversation = '30000000-0000-4000-8000-000000000001';
const briefId = '50000000-0000-4000-8000-000000000011';
const handoffId = '70000000-0000-4000-8000-000000000011';
const importId = '80000000-0000-4000-8000-000000000011';

beforeEach(() => {
  state.person = '00000000-0000-4000-8000-000000000001';
  state.access = true;
  state.originReady = true;
  state.receipts = [];
  state.versions = [];
  state.rpc = [];
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
    expect(preview.mappingVersion).toBe('talk-origin-import/v1');
    expect(preview.project.name).toBe('Reserve site');
    const first = await importArchitectHandoff({
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    });
    expect(first).toMatchObject({
      imported: true,
      recovered: false,
      projectId: first.projectId,
      mappingVersion: 'talk-origin-import/v1',
    });
    expect(first.transfer.imagesCopied).toBe(false);
    expect(first.project).toEqual(preview.project);
    expect(state.rpc).toEqual(['ai_talk_import_origin']);
    expect(state.versions).toHaveLength(1);
    expect(state.versions[0]).toMatchObject({
      note: 'Imported from Talk',
      content: first.project,
    });
    expect(state.versions[0]?.content).toEqual(preview.project);
    const retry = await importArchitectHandoff({
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    });
    expect(retry.projectId).toBe(first.projectId);
    expect(retry.saveId).toBe(first.saveId);
    expect(retry.recovered).toBe(true);
    expect(retry.project).toEqual(preview.project);
    expect(state.versions).toHaveLength(1);
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
    expect(state.versions).toHaveLength(1);
    expect(state.rpc.every((name) => name === 'ai_talk_import_origin')).toBe(true);
  });

  it('rejects expected IDs that already hold different valid Talk-imported content', async () => {
    const occupied = initialProject('Wrong valid content', 'business');
    state.versions.push({
      id: originSaveIdentity(state.person, handoffId),
      project_id: originProjectIdentity(state.person, handoffId),
      person_id: state.person,
      content: occupied,
      note: 'Imported from Talk',
    });
    await expect(
      importArchitectHandoff({
        action: 'import-origin',
        id: importId,
        handoffId,
        conversationId: conversation,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.receipts).toEqual([]);
    expect(state.versions).toHaveLength(1);
    expect(state.versions[0]?.content).toEqual(occupied);
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
    expect(state.rpc).toEqual([]);
    expect(state.receipts).toEqual([]);
    expect(state.versions).toEqual([]);
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

  it('commits the exact reviewed project for emoji and multiline bounds, then replays it', async () => {
    const heavyBrief = {
      title: '💎'.repeat(40),
      purpose: 'A'.repeat(800),
      audience: 'Founders',
      visualDirection: 'C'.repeat(800),
      requirements: Array.from({ length: 12 }, () => 'D'.repeat(280)),
      unresolved: ['Typeface'],
    };
    state.rows[0] = { ...state.rows[0]!, content: heavyBrief };
    const handoff = state.rows[1]!;
    const content = handoff.content as {
      idea: string;
      selections: Array<{ title: string }>;
    };
    content.idea = `Reserve site\n${'e\u0301'.repeat(40)}`;
    content.selections[0]!.title = heavyBrief.title;
    const preview = await reviewArchitectImport(handoffId);
    expect(preview.project.name).toBe(heavyBrief.title);
    expect(preview.project.blueprint.requirements.length).toBe(3000);
    const first = await importArchitectHandoff({
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    });
    expect(first.imported).toBe(true);
    expect(first.recovered).toBe(false);
    expect(first.project).toEqual(preview.project);
    expect(state.versions[0]?.content).toEqual(preview.project);
    const retry = await importArchitectHandoff({
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    });
    expect(retry.projectId).toBe(first.projectId);
    expect(retry.saveId).toBe(first.saveId);
    expect(retry.recovered).toBe(true);
    expect(retry.project).toEqual(preview.project);
    expect(state.versions).toHaveLength(1);
    expect(state.rpc.every((name) => name === 'ai_talk_import_origin')).toBe(true);
  });

  it('rejects two selected briefs before any Origin write', async () => {
    const otherBrief = '50000000-0000-4000-8000-000000000099';
    state.rows.push({
      id: otherBrief,
      person_id: state.person,
      conversation_id: conversation,
      source_turn_id: null,
      lineage_id: otherBrief,
      version: 1,
      kind: 'brief',
      content: {
        title: 'Other reserve brief',
        purpose: 'A second reviewed brief.',
        audience: 'Founders',
        visualDirection: 'Obsidian and gold',
        requirements: ['Phone first'],
        unresolved: ['Typeface'],
      },
      predecessor_id: null,
      superseded_by: null,
      created_at: '2026-10-14T00:00:00.000Z',
    });
    const handoff = state.rows[1]!;
    const content = handoff.content as {
      selections: Array<{
        kind: 'brief' | 'plan' | 'palette';
        lineageId: string;
        versionId: string;
        version: number;
        title: string;
      }>;
    };
    content.selections = [
      content.selections[0]!,
      {
        kind: 'brief',
        lineageId: otherBrief,
        versionId: otherBrief,
        version: 1,
        title: 'Other reserve brief',
      },
    ];
    await expect(reviewArchitectImport(handoffId)).rejects.toMatchObject({ status: 409 });
    await expect(
      importArchitectHandoff({
        action: 'import-origin',
        id: importId,
        handoffId,
        conversationId: conversation,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.rpc).toEqual([]);
    expect(state.receipts).toEqual([]);
    expect(state.versions).toEqual([]);
  });
});
