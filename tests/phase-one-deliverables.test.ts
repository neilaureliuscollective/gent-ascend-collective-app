import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  owner: 'owner-a',
  queries: [] as { table: string; columns: string; filters: Record<string, unknown> }[],
}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({
    person: { id: state.owner },
    client: {
      from: (table: string) => {
        const q = { table, columns: '', filters: {} as Record<string, unknown> };
        state.queries.push(q);
        const result = () => ({
          error: null,
          data:
            table === 'mission_deliverables'
              ? { id: 'doc', person_id: state.owner }
              : q.columns === '*'
                ? {
                    id: 'v1',
                    person_id: state.owner,
                    deliverable_id: 'doc',
                    revision: 1,
                    title: 'Saved',
                    body: 'Only selected body',
                    acceptance: 'Checked',
                    reviewed_at: null,
                    review_note: null,
                  }
                : [{ id: 'v1', revision: 1, title: 'Saved', reviewed_at: null }],
        });
        const builder = {
          select: (columns: string) => {
            q.columns = columns;
            return builder;
          },
          eq: (key: string, value: unknown) => {
            q.filters[key] = value;
            return builder;
          },
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => result(),
          then: <T>(resolve: (v: ReturnType<typeof result>) => T) =>
            Promise.resolve(resolve(result())),
        };
        return builder;
      },
    },
  }),
}));
import { readDeliverable, exportDeliverable } from '@/domains/missions/deliverables';
import {
  recoverDeliverableDraft,
  retainDeliverableDraft,
} from '@/components/missions/deliverable-drafts';
import type { DeliverableVersion } from '@/domains/missions/deliverable-schema';
beforeEach(() => {
  state.queries = [];
  state.owner = 'owner-a';
});
it('loads lightweight history and only the current body, with owner filters throughout', async () => {
  const result = await readDeliverable('doc');
  expect(result.current.body).toBe('Only selected body');
  const versions = state.queries.filter((q) => q.table === 'mission_deliverable_versions');
  expect(versions).toHaveLength(2);
  expect(versions[0]!.columns).not.toContain('body');
  expect(versions[1]!.filters).toEqual({ person_id: 'owner-a', deliverable_id: 'doc', id: 'v1' });
  expect(state.queries.every((q) => q.filters.person_id === 'owner-a')).toBe(true);
});
it('exports only the explicit document/version without reading other history', async () => {
  expect(await exportDeliverable('doc', 'v1')).toContain('Only selected body');
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0]!.filters).toEqual({
    person_id: 'owner-a',
    deliverable_id: 'doc',
    id: 'v1',
  });
});
it('route draft recovery is bounded, expires and cannot cross account identity', () => {
  const version = { id: 'v1', title: 'Saved', body: 'Body', acceptance: '' } as DeliverableVersion;
  const draft = { title: 'Draft', body: 'Private unsaved work', acceptance: '' };
  retainDeliverableDraft('a', 'doc', version, draft, 'Review note');
  expect(recoverDeliverableDraft('a', 'doc')?.draft.body).toBe(draft.body);
  expect(recoverDeliverableDraft('b', 'doc')).toBeUndefined();
  expect(recoverDeliverableDraft('a', 'doc')).toBeUndefined();
  retainDeliverableDraft('a', 'doc', version, draft, '');
  const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
  expect(recoverDeliverableDraft('a', 'doc')).toBeUndefined();
  now.mockRestore();
  for (let i = 0; i < 4; i++) retainDeliverableDraft('a', String(i), version, draft, '');
  expect(recoverDeliverableDraft('a', '0')).toBeUndefined();
});
