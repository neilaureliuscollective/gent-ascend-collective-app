import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ reply: vi.fn(), council: vi.fn() }));
vi.mock('@/domains/intelligence/model', () => ({ generateReply: mocks.reply }));
vi.mock('@/domains/intelligence/council-model', () => ({ generateCouncilReply: mocks.council }));
import { runBackgroundTask } from '@/domains/live/background';
import { backgroundTask } from '@/domains/live/contract';
beforeEach(() => vi.clearAllMocks());
async function* complete() {
  yield { type: 'text', text: 'A bounded result' };
  yield { type: 'finish', reason: 'stop', input: 8, output: 12 };
}
describe('bounded voice background work', () => {
  it('reuses the existing reasoning lane without retrieving private context', async () => {
    mocks.reply.mockReturnValue(complete());
    const result = await runBackgroundTask(
      { task: 'Research public product specifications', coworker: null },
      new AbortController().signal,
    );
    expect(result.text).toBe('A bounded result');
    const messages = mocks.reply.mock.calls[0]![1];
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('No saved profile');
    expect(mocks.council).not.toHaveBeenCalled();
  });
  it('routes exactly one reviewed coworker, with no implied privileged tools', async () => {
    mocks.council.mockReturnValue(complete());
    await runBackgroundTask(
      { task: 'Review this public architecture', coworker: 'prometheus' },
      new AbortController().signal,
    );
    expect(mocks.council.mock.calls[0]![2]).toEqual({
      kind: 'specialist',
      specialists: ['prometheus'],
    });
    expect(
      backgroundTask.safeParse({ task: 'Read account records', coworker: 'financial' }).success,
    ).toBe(false);
    expect(
      backgroundTask.safeParse({ task: 'Do work', coworker: null, ownerId: 'other' }).success,
    ).toBe(false);
  });
  it('cancels pending work on session end and rejects incomplete model output', async () => {
    mocks.reply.mockReturnValue(complete());
    const abort = new AbortController();
    abort.abort();
    await expect(
      runBackgroundTask({ task: 'A task', coworker: null }, abort.signal),
    ).rejects.toThrow(/cancelled/);
    mocks.reply.mockReturnValue(
      (async function* () {
        yield { type: 'text', text: 'Partial' };
        yield { type: 'finish', reason: 'length' };
      })(),
    );
    await expect(
      runBackgroundTask({ task: 'A task', coworker: null }, new AbortController().signal),
    ).rejects.toThrow(/incomplete/);
  });
});
