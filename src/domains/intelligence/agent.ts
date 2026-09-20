import {
  ToolLoopAgent,
  isStepCount,
  wrapLanguageModel,
  type ModelMessage,
  type LanguageModelMiddleware,
} from 'ai';
import { aureliusInstructions } from './prompt';
import type { ModelChunk } from './stream';
// SDK default error logging must never receive raw provider request bodies.
export const redactProviderErrors: LanguageModelMiddleware = {
  specificationVersion: 'v4',
  async wrapStream({ doStream }) {
    try {
      const result = await doStream();
      const reader = result.stream.getReader();
      return {
        stream: new ReadableStream({
          async pull(controller) {
            try {
              const { value, done } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(
                value.type === 'error'
                  ? { type: 'error', error: new Error('Aurelius provider stream failed') }
                  : value,
              );
            } catch {
              controller.error(new Error('Aurelius provider stream failed'));
            }
          },
          cancel(reason) {
            return reader.cancel(reason);
          },
        }),
      };
    } catch {
      throw new Error('Aurelius provider unavailable');
    }
  },
};
export async function* streamAurelius(
  model: Parameters<typeof wrapLanguageModel>[0]['model'],
  messages: ModelMessage[],
  signal: AbortSignal,
): AsyncGenerator<ModelChunk> {
  const agent = new ToolLoopAgent({
    id: 'aurelius',
    model: wrapLanguageModel({ model, middleware: redactProviderErrors }),
    instructions: aureliusInstructions,
    stopWhen: isStepCount(1),
    maxOutputTokens: 4096,
    maxRetries: 0,
    providerOptions: { gateway: { disallowPromptTraining: true } },
  });
  const result = await agent.stream({
    messages,
    abortSignal: signal,
    timeout: { totalMs: 90000, chunkMs: 30000 },
  });
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') yield { type: 'text', text: part.text };
    else if (part.type === 'error' || part.type === 'abort')
      throw new Error('Generation interrupted');
    else if (part.type === 'finish')
      yield {
        type: 'finish',
        reason: part.finishReason,
        input: part.totalUsage.inputTokens,
        output: part.totalUsage.outputTokens,
      };
  }
}
