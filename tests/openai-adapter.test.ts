import { afterEach, expect, it, vi } from 'vitest';
import { aiConfigSchema } from '../src/domains/intelligence/validation';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('requires an OpenAI key and rejects Gateway model identifiers', async () => {
  vi.stubEnv('OPENAI_API_KEY', undefined);
  vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-unused-gateway-key');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { generateReply } = await import('../src/domains/intelligence/model');
  expect(() => generateReply('gpt-6-astra', [], new AbortController().signal)).toThrow(
    'OpenAI is not configured',
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(aiConfigSchema.safeParse({ AURELIUS_AI_MODEL: 'openai/gpt-6-astra' }).success).toBe(false);
});

it('sends streamed requests directly to OpenAI with response storage disabled', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-openai-test-key');
  vi.stubEnv('OPENAI_BASE_URL', 'https://example.invalid/proxy');
  const events = [
    {
      type: 'response.created',
      response: { id: 'resp_test', created_at: 1, model: 'gpt-6-astra' },
    },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id: 'msg_test', role: 'assistant', content: [] },
    },
    {
      type: 'response.output_text.delta',
      item_id: 'msg_test',
      output_index: 0,
      content_index: 0,
      delta: 'Connected.',
    },
    {
      type: 'response.completed',
      response: {
        id: 'resp_test',
        status: 'completed',
        incomplete_details: null,
        usage: {
          input_tokens: 10,
          output_tokens: 2,
          total_tokens: 12,
          output_tokens_details: { reasoning_tokens: 0 },
        },
      },
    },
  ];
  const fetch = vi.fn(
    async () =>
      new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
        headers: { 'content-type': 'text/event-stream' },
      }),
  );
  vi.stubGlobal('fetch', fetch);
  const { generateReply } = await import('../src/domains/intelligence/model');
  const chunks = [];
  for await (const chunk of generateReply(
    'gpt-6-astra',
    [{ role: 'user', content: 'Synthetic test' }],
    new AbortController().signal,
  ))
    chunks.push(chunk);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.openai.com/v1/responses');
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer synthetic-openai-test-key');
  expect(JSON.parse(init.body as string)).toMatchObject({
    model: 'gpt-6-astra',
    store: false,
    stream: true,
  });
  expect(chunks).toContainEqual({ type: 'text', text: 'Connected.' });
  expect(chunks).toContainEqual({ type: 'finish', reason: 'stop', input: 10, output: 2 });
});
