import { it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({ results: [] as unknown[], eq: vi.fn() }));
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
    person: { id: 'owner' },
    client: {
      from: () => {
        const q = {
          select: () => q,
          eq: (...args: unknown[]) => {
            s.eq(...args);
            return q;
          },
          maybeSingle: async () => s.results.shift(),
        };
        return q;
      },
    },
  }),
}));
import { readWebsiteHandoff } from '@/domains/technology/handoff';
beforeEach(() => {
  vi.clearAllMocks();
  s.results = [
    { data: { mission_id: 'mission', revision: 2 }, error: null },
    { data: { conversation_id: 'conversation' }, error: null },
    { data: { user_text: 'Make the hero more refined.', status: 'complete' }, error: null },
  ];
});
it('selects only owner-bound completed user text from the project Mission conversation', async () => {
  expect(await readWebsiteHandoff('project', 'turn', 2)).toEqual({
    instruction: 'Make the hero more refined.',
    revision: 2,
    turnId: 'turn',
  });
  expect(s.eq).toHaveBeenCalledWith('conversation_id', 'conversation');
  expect(s.eq.mock.calls.filter(([k]) => k === 'person_id')).toHaveLength(3);
});
it('rejects missing ownership, detached Mission and stale versions before reading messages', async () => {
  for (const data of [
    null,
    { mission_id: null, revision: 2 },
    { mission_id: 'mission', revision: 3 },
  ]) {
    s.results = [{ data, error: null }];
    await expect(readWebsiteHandoff('project', 'turn', 2)).rejects.toThrow(/unavailable/);
  }
});
it('rejects pending, foreign or oversized requests without truncating', async () => {
  for (const data of [
    null,
    { status: 'pending', user_text: 'Make it luxurious.' },
    { status: 'complete', user_text: 'x'.repeat(1001) },
  ]) {
    s.results = [
      { data: { mission_id: 'mission', revision: 2 } },
      { data: { conversation_id: 'conversation' } },
      { data },
    ];
    await expect(readWebsiteHandoff('project', 'turn')).rejects.toThrow(/completed request/);
  }
});
