import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const generate = vi.hoisted(() => vi.fn());
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({ responses: () => 'configured-model' }),
}));
vi.mock('ai', () => ({ generateText: generate, Output: { object: () => ({}) } }));
vi.mock('@/domains/intelligence/prompt', () => ({ sharedCharacter: 'Shared reviewed conduct' }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
import { constructProviderStatus, proposeConstructChange } from '@/domains/architect-construct/provider';
import { defaultProtectedPaths } from '@/domains/architect-construct/schema';

it('keeps the OpenAI construct adapter disabled without authorized configuration', () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'false');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  const status = constructProviderStatus();
  expect(status.enabled).toBe(false);
  expect(status.reason).toMatch(/sandbox|worker|repository/i);
});

it('rejects malformed provider output and never treats it as an executed run', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  generate.mockResolvedValue({
    output: { summary: 'ok', patch: [{ path: '../etc/passwd', before: 'a', after: 'b' }], notes: '' },
  });
  await expect(
    proposeConstructChange(
      'change anything',
      {
        allowed_paths: ['preview.html'],
        protected_paths: defaultProtectedPaths(),
        intended_change: 'Stay inside the fixture.',
      },
      [{ path: 'preview.html', content: '<h1>Before</h1>' }],
      new AbortController().signal,
    ),
  ).rejects.toThrow(/malformed|failed|disabled/i);
  if (generate.mock.calls.length)
    expect(generate.mock.calls[0]?.[0].maxRetries).toBe(0);
});
