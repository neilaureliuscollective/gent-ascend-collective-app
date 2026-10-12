import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database';
vi.mock('server-only', () => ({}));
import { selectedArtifactContext } from '@/domains/artifacts/context-service';
const filters: string[][] = [];
const board = {
  kind: 'diagram',
  basis: 'conceptual',
  title: 'Map',
  summary: 'Illustrative.',
  nodes: [
    { id: 'voice', label: 'Voice', detail: 'Speech.' },
    { id: 'tools', label: 'Tools', detail: 'Approved work.' },
  ],
  edges: [],
};
function client(withSelection = true) {
  return {
    from: (table: string) => ({
      select() {
        return this;
      },
      eq(key: string, value: string) {
        filters.push([table, key, value]);
        return this;
      },
      maybeSingle: async () => ({
        error: null,
        data:
          table === 'ai_artifact_selection'
            ? withSelection
              ? { artifact_id: 'owned', part_id: 'tools' }
              : null
            : { id: 'owned', operation: 'visual.diagram', visual: board },
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}
it('includes only the owned conversation selection for voice-to-text follow-up', async () => {
  filters.length = 0;
  const context = await selectedArtifactContext(client(), 'owner', 'thread');
  expect(context).toContain('Untrusted reference data');
  expect(context).toContain('"selectedPart":{"id":"tools"');
  expect(filters).toContainEqual(['ai_conversation_artifacts', 'person_id', 'owner']);
  expect(filters).toContainEqual(['ai_conversation_artifacts', 'conversation_id', 'thread']);
  expect(filters).toContainEqual(['ai_conversation_artifacts', 'status', 'complete']);
});
it('does not invent selected context when the person has not selected an artifact', async () => {
  expect(await selectedArtifactContext(client(false), 'owner', 'thread')).toBe('');
});
