import { test, expect } from 'vitest';
import { gateway } from 'ai';
import { streamAurelius } from '../../src/domains/intelligence/agent';
import { buildMessages } from '../../src/domains/intelligence/prompt';
import { aiConfigSchema } from '../../src/domains/intelligence/validation';
test('configured Gateway model can complete a synthetic Aethelios request', async () => {
  const config = aiConfigSchema.parse(process.env);
  if (!config.AI_GATEWAY_API_KEY)
    throw new Error('AI_GATEWAY_API_KEY is not configured. No model request was sent.');
  let text = '';
  let complete = false;
  for await (const chunk of streamAurelius(
    gateway(config.AURELIUS_AI_MODEL),
    buildMessages(
      [],
      'This is a synthetic connection test. Reply with exactly: Aethelios connection verified.',
      null,
    ),
    new AbortController().signal,
  )) {
    if (chunk.type === 'text') text += chunk.text;
    else complete = chunk.reason === 'stop';
  }
  expect(complete).toBe(true);
  expect(text).toContain('Aethelios connection verified.');
});
