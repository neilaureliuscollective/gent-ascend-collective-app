import { expect, it, vi } from 'vitest';
import { persistOfferedCreations } from '@/domains/talk-creation/persist';
import { legacyReserveBoard, selectDesignDirection } from '@/domains/talk-creation/design-board';

it('uses the typed offer_text_work persist path to refine only the selected direction', async () => {
  const current = selectDesignDirection(legacyReserveBoard(), 'direction-c');
  const offered = structuredClone(current);
  offered.directions = offered.directions.map((item) => ({
    ...item,
    demo: {
      ...item.demo,
      headline: item.id === 'direction-c' ? 'A warmer glass reading.' : 'Stolen headline',
    },
  }));
  const selected = { board: '50000000-0000-4000-8000-000000000031' };
  const rpc = vi.fn(async () => ({
    data: { lineageId: selected.board, version: 2, recovered: false },
    error: null,
  }));
  const client = {
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { content: current }, error: null }),
        }),
      }),
    }),
  };
  const result = await persistOfferedCreations(
    client as never,
    '30000000-0000-4000-8000-000000000031',
    '40000000-0000-4000-8000-000000000031',
    [{ board: offered }],
    selected,
  );
  expect(result.saved).toHaveLength(1);
  const saved = result.saved[0]!.content;
  expect(saved && 'directions' in saved && saved.directions.find((item) => item.id === 'direction-a')?.demo.headline).toBe(
    current.directions.find((item) => item.id === 'direction-a')?.demo.headline,
  );
  expect(saved && 'directions' in saved && saved.directions.find((item) => item.id === 'direction-c')?.demo.headline).toBe(
    'A warmer glass reading.',
  );
  expect(rpc).toHaveBeenCalledWith(
    'ai_talk_save_creation',
    expect.objectContaining({ p_kind: 'board', p_predecessor: selected.board }),
  );
});
