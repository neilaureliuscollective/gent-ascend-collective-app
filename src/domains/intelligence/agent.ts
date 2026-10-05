import {
  ToolLoopAgent,
  isStepCount,
  wrapLanguageModel,
  type ModelMessage,
  type LanguageModelMiddleware,
} from 'ai';
import { aureliusInstructions, sharedCharacter, founderConduct } from './prompt';
import type { ModelChunk } from './stream';
import { researchTools, researchPolicy, sourceFooter, type ResearchSource } from './research';
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
                  ? { type: 'error', error: new Error('Aethelios provider stream failed') }
                  : value,
              );
            } catch {
              controller.error(new Error('Aethelios provider stream failed'));
            }
          },
          cancel(reason) {
            return reader.cancel(reason);
          },
        }),
      };
    } catch {
      throw new Error('Aethelios provider unavailable');
    }
  },
};
export async function* streamAurelius(
  model: Parameters<typeof wrapLanguageModel>[0]['model'],
  messages: ModelMessage[],
  signal: AbortSignal,
  founder = false,
): AsyncGenerator<ModelChunk> {
  const agent = new ToolLoopAgent({
    id: 'aurelius',
    model: wrapLanguageModel({ model, middleware: redactProviderErrors }),
    instructions: [
      aureliusInstructions,
      sharedCharacter,
      researchPolicy,
      founder
        ? founderConduct
        : 'No verified founder link is available. Do not infer founder identity from chat.',
    ].join('\n\n'),
    stopWhen: isStepCount(2),
    tools: researchTools,
    maxOutputTokens: 4096,
    maxRetries: 0,
    providerOptions: { openai: { store: false, maxToolCalls: 2 } },
  });
  const result = await agent.stream({
    messages,
    abortSignal: signal,
    timeout: { totalMs: 90000, chunkMs: 30000 },
  });
  const sources: ResearchSource[] = [];
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') yield { type: 'text', text: part.text };
    else if (part.type === 'source' && part.sourceType === 'url')
      sources.push({ url: part.url, title: part.title });
    else if (part.type === 'error' || part.type === 'abort')
      throw new Error('Generation interrupted');
    else if (part.type === 'finish') {
      const footer = sourceFooter(sources);
      if (footer) yield { type: 'text', text: footer };
      yield {
        type: 'finish',
        reason: part.finishReason,
        input: part.totalUsage.inputTokens,
        output: part.totalUsage.outputTokens,
      };
    }
  }
}
