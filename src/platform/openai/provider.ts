import 'server-only';
import { createOpenAI as sdkCreateOpenAI } from '@ai-sdk/openai';
import { budgetedFetch } from './budget';
export function createOpenAI(options: Parameters<typeof sdkCreateOpenAI>[0]) {
  return sdkCreateOpenAI({ ...options, fetch: budgetedFetch });
}
