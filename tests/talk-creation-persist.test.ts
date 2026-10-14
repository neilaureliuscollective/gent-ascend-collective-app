import { describe, expect, it, vi } from 'vitest';
import { candidateIdentity, persistOfferedCreations } from '@/domains/talk-creation/persist';

const brief = {
  title: 'Generated proposal',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const conversation = '30000000-0000-4000-8000-000000000001';
const turn = '40000000-0000-4000-8000-000000000001';
const base = '50000000-0000-4000-8000-000000000001';

describe('Talk stale proposal persist', () => {
  it('preserves a stale offer as a candidate and recovers the same identity on retry', async () => {
    const calls: string[] = [];
    const client = {
      rpc: vi.fn(async (name: string, args: { p_id: string }) => {
        calls.push(name);
        if (name === 'ai_talk_save_creation')
          return { data: null, error: { code: 'P0001', message: 'Stale creation version' } };
        if (name === 'ai_talk_save_candidate')
          return {
            data: { id: args.p_id, lineageId: base, version: 3, recovered: calls.filter((item) => item === name).length > 1 },
            error: null,
          };
        return { data: null, error: { message: 'unexpected' } };
      }),
    };
    const first = await persistOfferedCreations(
      client as never,
      conversation,
      turn,
      [{ brief }],
      { brief: base },
    );
    const second = await persistOfferedCreations(
      client as never,
      conversation,
      turn,
      [{ brief }],
      { brief: base },
    );
    expect(first.saved).toEqual([]);
    expect(first.stale).toEqual([
      {
        id: candidateIdentity(turn, 'brief'),
        kind: 'brief',
        title: 'Generated proposal',
        status: 'stale',
        preserved: true,
      },
    ]);
    expect(second.stale[0]?.id).toBe(first.stale[0]?.id);
    expect(calls).toEqual([
      'ai_talk_save_creation',
      'ai_talk_save_candidate',
      'ai_talk_save_creation',
      'ai_talk_save_candidate',
    ]);
  });

  it('reports an unpreserved stale offer when the candidate cannot be saved', async () => {
    const client = {
      rpc: vi.fn(async (name: string) => {
        if (name === 'ai_talk_save_creation')
          return { data: null, error: { code: 'P0001', message: 'Stale creation version' } };
        return { data: null, error: { message: 'Base version unavailable' } };
      }),
    };
    const result = await persistOfferedCreations(
      client as never,
      conversation,
      turn,
      [{ brief }],
      { brief: base },
    );
    expect(result.stale).toEqual([
      { id: base, kind: 'brief', title: 'Generated proposal', status: 'stale', preserved: false },
    ]);
  });
});
