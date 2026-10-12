import { expect, it, vi } from 'vitest';
import {
  replyStream,
  type ModelChunk,
  type ActivityReporter,
  type FinishReply,
} from '../src/domains/intelligence/stream';
import type { Turn } from '../src/domains/intelligence/types';
it('reports observed tool activity without making it response text, then waits for persistence', async () => {
  let confirm!: () => void;
  const ack = new Promise<void>((resolve) => {
    confirm = resolve;
  });
  const finish = vi.fn<FinishReply>(async () => {
    await ack;
    return { status: 'complete', assistant_text: 'Result' } as Turn;
  });
  async function* generate(
    _signal: AbortSignal,
    activity: ActivityReporter,
  ): AsyncGenerator<ModelChunk> {
    activity('searching');
    activity('waiting');
    yield { type: 'text', text: 'Result' };
    yield { type: 'finish', reason: 'stop' };
  }
  const reader = replyStream(generate, finish, new AbortController().signal, {
    activity: true,
  }).getReader();
  const decoder = new TextDecoder();
  const read = async () => JSON.parse(decoder.decode((await reader.read()).value));
  expect(await read()).toEqual({ type: 'activity', phase: 'waiting' });
  expect(await read()).toEqual({ type: 'activity', phase: 'searching' });
  expect(await read()).toEqual({ type: 'activity', phase: 'waiting' });
  expect(await read()).toEqual({ type: 'delta', text: 'Result' });
  expect(await read()).toEqual({ type: 'activity', phase: 'saving' });
  expect(finish).toHaveBeenCalledWith('Result', 'complete', undefined, undefined);
  confirm();
  expect((await read()).type).toBe('saved');
});
it('an aborted request never emits a completion or saved event', async () => {
  const controller = new AbortController();
  async function* generate(
    _signal: AbortSignal,
    activity: ActivityReporter,
  ): AsyncGenerator<ModelChunk> {
    activity('searching');
    controller.abort();
    yield { type: 'finish', reason: 'stop' };
  }
  const finish = vi.fn<FinishReply>(async () => ({ status: 'cancelled' }) as Turn);
  const text = await new Response(
    replyStream(generate, finish, controller.signal, { activity: true }),
  ).text();
  expect(text).not.toContain('"type":"saved"');
  expect(text).not.toContain('"phase":"saving"');
  expect(finish).toHaveBeenCalledWith('', 'cancelled', undefined, undefined);
});

it('retains the original wire format for older clients even when the provider searches', async () => {
  async function* generate(
    _signal: AbortSignal,
    activity: ActivityReporter,
  ): AsyncGenerator<ModelChunk> {
    activity('searching');
    yield { type: 'text', text: 'Result' };
    yield { type: 'finish', reason: 'stop' };
  }
  const finish: FinishReply = async () => ({ status: 'complete' }) as Turn;
  const text = await new Response(
    replyStream(generate, finish, new AbortController().signal),
  ).text();
  expect(
    text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).type),
  ).toEqual(['delta', 'saved']);
});

it('flushes acceptance before a delayed provider without inventing response text', async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  async function* generate(): AsyncGenerator<ModelChunk> {
    await wait;
    yield { type: 'text', text: 'Actual result' };
    yield { type: 'finish', reason: 'stop' };
  }
  const reader = replyStream(
    generate,
    async () => ({ status: 'complete' }) as Turn,
    new AbortController().signal,
    { activity: true },
  ).getReader();
  const first = await reader.read();
  expect(JSON.parse(new TextDecoder().decode(first.value))).toEqual({
    type: 'activity',
    phase: 'waiting',
  });
  release();
  expect(JSON.parse(new TextDecoder().decode((await reader.read()).value))).toEqual({
    type: 'delta',
    text: 'Actual result',
  });
  await reader.cancel();
});

it('diagnostic frames contain only allowlisted timing stages and never conversation content', async () => {
  async function* generate(
    _signal: AbortSignal,
    activity: ActivityReporter,
  ): AsyncGenerator<ModelChunk> {
    activity('searching');
    activity('waiting');
    yield { type: 'text', text: 'PRIVATE RESPONSE' };
    yield { type: 'finish', reason: 'stop' };
  }
  const text = await new Response(
    replyStream(
      generate,
      async () => ({ status: 'complete', assistant_text: 'PRIVATE RESPONSE' }) as Turn,
      new AbortController().signal,
      { activity: true, diagnostics: true },
    ),
  ).text();
  const timings = text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === 'timing');
  expect(timings.map((event) => event.stage)).toEqual([
    'provider-first-event',
    'tool-start',
    'tool-end',
    'provider-first-text',
    'persistence-start',
    'persistence-end',
    'stream-end',
  ]);
  expect(JSON.stringify(timings)).not.toContain('PRIVATE');
  for (const event of timings) {
    expect(Object.keys(event)).toEqual(['type', 'stage', 'elapsedMs']);
    expect(event.elapsedMs).toBeGreaterThanOrEqual(0);
  }
});
