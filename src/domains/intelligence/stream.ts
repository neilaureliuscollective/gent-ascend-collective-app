import type { StreamEvent, Turn } from './types';
export type ModelChunk =
  | { type: 'text'; text: string }
  | { type: 'finish'; reason: string; input?: number; output?: number };
export type FinishReply = (
  text: string,
  status: 'complete' | 'failed' | 'cancelled',
  input?: number,
  output?: number,
) => Promise<Turn>;
// A saved event is emitted only after persistence succeeds. Provider errors stay private.
export function replyStream(
  generate: (signal: AbortSignal) => AsyncIterable<ModelChunk>,
  finish: FinishReply,
  requestSignal: AbortSignal,
) {
  const abort = new AbortController();
  const signal = AbortSignal.any([requestSignal, abort.signal, AbortSignal.timeout(95000)]);
  let disconnected = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        if (!disconnected) {
          try {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
          } catch {
            disconnected = true;
            abort.abort();
          }
        }
      };
      let text = '';
      let input: number | undefined;
      let output: number | undefined;
      let complete = false;
      try {
        for await (const chunk of generate(signal)) {
          if (signal.aborted) throw new Error('Interrupted');
          if (chunk.type === 'text') {
            text += chunk.text;
            if (text.length > 64000) throw new Error('Reply too long');
            emit({ type: 'delta', text: chunk.text });
          } else {
            input = chunk.input;
            output = chunk.output;
            complete = chunk.reason === 'stop';
          }
        }
        if (!complete || !text.trim() || signal.aborted) throw new Error('Incomplete reply');
        const turn = await finish(text, 'complete', input, output);
        emit({ type: 'saved', turn });
      } catch {
        const status = requestSignal.aborted || abort.signal.aborted ? 'cancelled' : 'failed';
        try {
          await finish(text.slice(0, 64000), status, input, output);
        } catch {
          /* The UI must not claim a save. Lease expires in SQL. */
        }
        emit({
          type: 'error',
          message:
            status === 'cancelled'
              ? 'Reply stopped. Reload to check the saved conversation.'
              : 'The reply did not finish or could not be saved. Reload before trying again.',
        });
      } finally {
        if (!disconnected) {
          try {
            controller.close();
          } catch {
            /* disconnected */
          }
        }
      }
    },
    cancel() {
      disconnected = true;
      abort.abort();
    },
  });
}
