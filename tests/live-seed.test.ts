import { afterEach, expect, it, vi } from 'vitest';
import { admitLiveSeed } from '@/domains/live/seed';
import { budgetLiveSeed } from '@/domains/live/context-budget';
import { buildMessages } from '@/domains/intelligence/prompt';
class Socket extends EventTarget {
  sent: {
    event_id: string;
    item: { id: string; role: string; content: { type: string; text: string }[] };
  }[] = [];
  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }
  event(value: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }));
  }
}
function fixture() {
  const built = buildMessages(
    [
      {
        status: 'complete',
        user_text: 'Synthetic saved question',
        assistant_text: 'Synthetic saved answer',
      },
      {
        status: 'cancelled',
        user_text: 'Unfinished question',
        assistant_text: 'Unfinished answer',
      },
    ],
    '',
    null,
    new Date('2026-10-15T16:55:13Z'),
    null,
    'Synthetic older summary',
    null,
    null,
    { channel: 'voice' },
  );
  const seed = budgetLiveSeed([built[0]!], built.slice(1), 12).map((message, index) => ({
    id: `ctx_test${index}`,
    eventId: `seed_test${index}`,
    message,
  }));
  const socket = new Socket();
  const pending = admitLiveSeed(socket as unknown as WebSocket, seed);
  return { socket, pending, seed };
}
afterEach(() => vi.useRealTimers());
it('sends the real multirole prompt and waits for every matching acknowledgement', async () => {
  const { socket, pending, seed } = fixture();
  expect(socket.sent.map((x) => x.item.role)).toEqual(['user', 'user', 'assistant']);
  expect(socket.sent.at(-1)?.item.content).toEqual([
    { type: 'output_text', text: 'Synthetic saved answer' },
  ]);
  expect(socket.sent[0]?.item.content[0]?.text).toContain('Synthetic older summary');
  expect(JSON.stringify(socket.sent)).not.toContain('Unfinished answer');
  expect(new Set(socket.sent.map((x) => x.event_id)).size).toBe(seed.length);
  let done = false;
  void pending.then(() => {
    done = true;
  });
  socket.event({ type: 'conversation.item.added', item: { id: 'unrelated' } });
  socket.event({ type: 'conversation.item.added', item: { id: seed[0]!.id } });
  socket.event({ type: 'conversation.item.added', item: { id: seed[0]!.id } });
  socket.event({ type: 'conversation.item.done', item: { id: seed[1]!.id } });
  await Promise.resolve();
  expect(done).toBe(false);
  socket.event({ type: 'conversation.item.created', item: { id: seed[1]!.id } });
  socket.event({ type: 'conversation.item.added', item: { id: seed[2]!.id } });
  await pending;
});
it('correlates a rejection without retaining provider messages, context or unknown fields', async () => {
  const { socket, pending } = fixture();
  socket.event({
    type: 'error',
    event_id: 'server-event',
    error: {
      event_id: 'seed_test2',
      code: 'invalid_value',
      type: 'invalid_request_error',
      param: 'item.content[0].type',
      message: 'PRIVATE text SDP token',
      secret: 'private',
    },
  });
  await expect(pending).rejects.toMatchObject({
    category: 'rejected',
    detail: {
      providerCode: 'invalid_value',
      providerType: 'invalid_request_error',
      providerParam: 'item.content[0].type',
      seedEventId: 'seed_test2',
      seedIndex: 2,
      seedRole: 'assistant',
      seedLength: 22,
    },
  });
  await pending.catch((error) =>
    expect(JSON.stringify(error)).not.toMatch(/PRIVATE|secret|Synthetic saved/),
  );
});
it('does not attribute unknown event IDs or arbitrary code/type/param values to a seed', async () => {
  const { socket, pending } = fixture();
  socket.event({
    type: 'error',
    error: { event_id: 'secret', code: 'secret', type: 'secret', param: 'secret' },
  });
  await expect(pending).rejects.toMatchObject({
    detail: {
      providerCode: null,
      providerType: null,
      providerParam: null,
      seedEventId: null,
      seedIndex: null,
      seedRole: null,
      seedLength: null,
    },
  });
});
for (const event of ['close', 'error'])
  it(`fails on transport ${event} and removes listeners`, async () => {
    const { socket, pending } = fixture();
    const remove = vi.spyOn(socket, 'removeEventListener');
    socket.dispatchEvent(new Event(event));
    await expect(pending).rejects.toMatchObject({ category: 'unavailable' });
    expect(remove).toHaveBeenCalledTimes(3);
  });
it('times out partial acknowledgement and removes all listeners', async () => {
  vi.useFakeTimers();
  const { socket, pending, seed } = fixture();
  socket.event({ type: 'conversation.item.added', item: { id: seed[0]!.id } });
  const rejection = expect(pending).rejects.toMatchObject({
    category: 'timeout',
    detail: { pendingCount: 2 },
  });
  await vi.advanceTimersByTimeAsync(10000);
  await rejection;
  expect(vi.getTimerCount()).toBe(0);
});
it('handles an empty seed and synchronous send failure without leaving a timeout', async () => {
  vi.useFakeTimers();
  const socket = new Socket();
  await admitLiveSeed(socket as unknown as WebSocket, []);
  socket.send = () => {
    throw new Error('PRIVATE transport error');
  };
  await expect(
    admitLiveSeed(socket as unknown as WebSocket, [
      { id: 'ctx_1', eventId: 'seed_1', message: { role: 'user', content: 'private' } },
    ]),
  ).rejects.toMatchObject({ category: 'unavailable' });
  expect(vi.getTimerCount()).toBe(0);
});
