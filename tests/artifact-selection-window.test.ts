import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ calls: [] as string[][] }));
vi.mock('@/domains/access/current', () => ({ currentAccess: async () => new Set(['voice.use']) }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {},
  intelligenceSession: async () => ({
    person: { id: 'owner' },
    client: {
      rpc: async () => ({ data: true, error: null }),
      from: (table: string) => {
        const filters: Record<string, string> = {};
        let fields = '';
        const query = {
          select(value: string) {
            fields = value;
            return this;
          },
          eq(key: string, value: string) {
            filters[key] = value;
            mock.calls.push([table, key, value]);
            return this;
          },
          is() {
            return this;
          },
          in() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({
            error: null,
            data:
              table === 'ai_conversations'
                ? { id: 'thread' }
                : table === 'ai_artifact_selection'
                  ? { artifact_id: 'old-source', part_id: 'selected', scenario_percent: 0 }
                  : oldSource,
          }),
          then(resolve: (value: unknown) => void) {
            resolve({
              error: null,
              data: table === 'ai_conversation_artifacts' && fields === '*' ? [recent] : [],
            });
          },
        };
        return query;
      },
    },
  }),
}));
const oldSource = {
  id: 'old-source',
  conversation_id: 'thread',
  operation: 'image.create',
  status: 'complete',
  prompt: 'Older selected source',
  version_id: 'version',
  project_id: 'project',
  base_version_id: null,
  created_at: '2026-01-01',
  finished_at: null,
  started_at: null,
};
const recent = { ...oldSource, id: 'recent', prompt: 'Recent item' };
import { readArtifacts } from '@/domains/artifacts/service';
it('returns an owned selected source even when it is outside the recent artifact window', async () => {
  const workspace = await readArtifacts('thread');
  expect(workspace.artifacts.map((item) => item.id)).toEqual(['recent', 'old-source']);
  expect(workspace.selectedId).toBe('old-source');
  expect(mock.calls).toContainEqual(['ai_conversation_artifacts', 'id', 'old-source']);
  expect(mock.calls).toContainEqual(['ai_conversation_artifacts', 'person_id', 'owner']);
  expect(mock.calls).toContainEqual(['ai_conversation_artifacts', 'conversation_id', 'thread']);
});
