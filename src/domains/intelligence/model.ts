import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import type { ModelMessage } from 'ai';
import { streamAurelius } from './agent';
import { aiConfigSchema } from './validation';

export function generateReply(model: string, messages: ModelMessage[], signal: AbortSignal, founder = false) {
  const config = aiConfigSchema.parse(process.env);
  if (!config.OPENAI_API_KEY) throw new Error('OpenAI is not configured');
  const openai = createOpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
  });
  return streamAurelius(openai.responses(model), messages, signal, founder);
}
