import { expect, it } from 'vitest';
import { readConversationStream } from '../src/platform/conversation/read-stream';
it('decodes split UTF-8 and accepts an unterminated save acknowledgement', async () => {
  const bytes = new TextEncoder().encode(
    '\n{"type":"delta","text":"é"}\n{"type":"saved","turn":{"id":"owned"}}',
  );
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const byte of bytes) c.enqueue(Uint8Array.of(byte));
      c.close();
    },
  });
  const events = [];
  for await (const event of readConversationStream(body)) events.push(event);
  expect(events).toEqual([
    { type: 'delta', text: 'é' },
    { type: 'saved', turn: { id: 'owned' } },
  ]);
  expect(body.locked).toBe(false);
});
it('cancels and releases the reader on malformed or oversized events', async () => {
  for (const text of ['{invalid}\n', 'x'.repeat(262145)]) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(text));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(async () => {
      for await (const event of readConversationStream(body)) void event;
    }).rejects.toThrow();
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  }
});
it('releases the stream when the consumer stops early', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode('{"type":"delta","text":"first"}\n'));
    },
    cancel() {
      cancelled = true;
    },
  });
  for await (const event of readConversationStream(body)) {
    expect(event.type).toBe('delta');
    break;
  }
  expect(cancelled).toBe(true);
  expect(body.locked).toBe(false);
});
