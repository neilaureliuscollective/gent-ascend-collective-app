import type { StreamEvent, Turn, OperationActivity, StreamTimingStage } from './types';
export type ActivityReporter = (phase: Exclude<OperationActivity, 'saving'>) => void;
export type ModelChunk =
  | { type: 'text'; text: string }
  | { type: 'creation'; item: import('./types').StreamCreation }
  | { type: 'finish'; reason: string; input?: number; output?: number };
export type FinishReply = (
  text: string,
  status: 'complete' | 'failed' | 'cancelled',
  input?: number,
  output?: number,
) => Promise<Turn & { creations?: import('./types').StreamCreation[] }>;
// A saved event is emitted only after persistence succeeds. Provider errors stay private.
export function replyStream(
  generate: (signal: AbortSignal, activity: ActivityReporter) => AsyncIterable<ModelChunk>,
  finish: FinishReply,
  requestSignal: AbortSignal,
  options: { activity?: boolean; diagnostics?: boolean } = {},
) {
  const abort = new AbortController();
  const signal = AbortSignal.any([requestSignal, abort.signal, AbortSignal.timeout(95000)]);
  let disconnected = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        // Cached pre-motion clients retain the original delta/saved/error protocol.
        if (event.type === 'activity' && !options.activity) return;
        if (!disconnected) {
          try {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
          } catch {
            disconnected = true;
            abort.abort();
          }
        }
      };
      const started = performance.now();
      let firstEvent = false,
        firstText = false,
        usingTool = false;
      const timed = (stage: StreamTimingStage) => {
        if (options.diagnostics)
          emit({ type: 'timing', stage, elapsedMs: performance.now() - started });
      };
      const providerEvent = () => {
        if (!firstEvent) {
          firstEvent = true;
          timed('provider-first-event');
        }
      };
      let text = '';
      let input: number | undefined;
      let output: number | undefined;
      let complete = false;
      try {
        // Flush an observed acceptance event before waiting for the provider's first chunk.
        // Legacy clients retain their unchanged delta/saved/error wire protocol.
        emit({ type: 'activity', phase: 'waiting' });
        for await (const chunk of generate(signal, (phase) => {
          providerEvent();
          const tool = phase === 'searching' || phase === 'researching';
          if (tool !== usingTool) timed(tool ? 'tool-start' : 'tool-end');
          usingTool = tool;
          emit({ type: 'activity', phase });
        })) {
          providerEvent();
          if (signal.aborted) throw new Error('Interrupted');
          if (chunk.type === 'text') {
            if (!firstText) {
              firstText = true;
              timed('provider-first-text');
            }
            text += chunk.text;
            if (text.length > 64000) throw new Error('Reply too long');
            emit({ type: 'delta', text: chunk.text });
          } else if (chunk.type === 'creation') {
            emit({ type: 'creation', item: chunk.item });
          } else {
            input = chunk.input;
            output = chunk.output;
            complete = chunk.reason === 'stop';
          }
        }
        if (!complete || !text.trim() || signal.aborted) throw new Error('Incomplete reply');
        emit({ type: 'activity', phase: 'saving' });
        timed('persistence-start');
        const turn = await finish(text, 'complete', input, output);
        timed('persistence-end');
        emit({ type: 'saved', turn, creations: turn.creations });
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
        timed('stream-end');
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
