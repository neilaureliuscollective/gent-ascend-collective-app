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
import {
  constructProviderStatus,
  mockedConstructProposal,
  proposeConstructChange,
  proposeConstructRepair,
} from '@/domains/architect-construct/provider';
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

it('uses a labelled mock without calling OpenAI', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'false');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'true');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const status = constructProviderStatus();
  expect(status.enabled).toBe(true);
  expect(status.mode).toBe('mock');
  const proposal = await proposeConstructChange(
    'replace the heading',
    {
      allowed_paths: ['preview.html'],
      protected_paths: defaultProtectedPaths(),
      intended_change: 'Stay inside the fixture.',
    },
    [{ path: 'preview.html', content: '<h1>Before</h1>' }],
    new AbortController().signal,
  );
  expect(proposal.notes).toMatch(/MOCKED PROVIDER/);
  expect(proposal.patch[0]?.after).toContain('After');
  expect(generate).not.toHaveBeenCalled();
  expect(
    mockedConstructProposal(
      {
        allowed_paths: ['preview.html'],
        protected_paths: defaultProtectedPaths(),
        intended_change: 'Stay inside the fixture.',
      },
      [{ path: 'preview.html', content: '<h1>Before</h1>' }],
    ).summary,
  ).toMatch(/mocked provider/i);
});

it('rejects malformed provider output and never treats it as an executed run', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'false');
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

it('uses complete content for a file larger than 4KB and never a truncated original', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'false');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'true');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const content = `<h1>Before</h1>\n${'p'.repeat(4500)}`;
  const proposal = await proposeConstructChange(
    'replace the heading',
    {
      allowed_paths: ['preview.html'],
      protected_paths: defaultProtectedPaths(),
      intended_change: 'Stay inside the fixture.',
    },
    [{ path: 'preview.html', content }],
    new AbortController().signal,
  );
  expect(proposal.patch[0]?.before).toBe(content);
  expect(proposal.patch[0]?.before.length).toBeGreaterThan(4000);
  expect(proposal.context.editable[0]?.content).toBe(content);
});

it('never sends protected sentinels in the assembled OpenAI prompt', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'false');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const sentinel = 'SYNTHETIC_PROTECTED_SENTINEL_DO_NOT_SHIP';
  generate.mockResolvedValue({
    output: {
      summary: 'ok',
      patch: [{ path: 'preview.html', before: '<h1>Before</h1>', after: '<h1>After</h1>' }],
      notes: '',
    },
  });
  await proposeConstructChange(
    'replace the heading',
    {
      allowed_paths: ['preview.html', '.env.local', 'certs/server.pem'],
      protected_paths: [],
      intended_change: 'Stay inside the fixture.',
    },
    [
      { path: 'preview.html', content: '<h1>Before</h1>' },
      { path: '.env.local', content: `KEY=${sentinel}` },
      { path: 'certs/server.pem', content: sentinel },
    ],
    new AbortController().signal,
  );
  expect(generate).toHaveBeenCalled();
  const prompt = JSON.stringify(generate.mock.calls[0]?.[0].prompt ?? '');
  expect(prompt).not.toContain(sentinel);
  expect(prompt).toContain('<h1>Before</h1>');
  expect(prompt).not.toContain('.env.local');
});

it('live repair adapter patches the failed snapshot and receives original change plus evidence', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'false');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const original = 'export const heading = "Before";\n';
  const failed = 'export const heading = "After"\nconst introduced = ;\n';
  const secret = 'sk-live-secret-token';
  generate.mockImplementation(async (args: { prompt: string }) => {
    const prompt = String(args.prompt);
    expect(prompt).toContain('const introduced = ;');
    expect(prompt).toContain('original_change');
    expect(prompt).toContain('failure_evidence');
    expect(prompt).toContain('syntax:ok.mjs');
    expect(prompt).not.toContain(secret);
    expect(prompt).toContain('After');
    return {
      output: {
        summary: 'Fix the introduced syntax failure.',
        patch: [{ path: 'ok.mjs', before: failed, after: 'export const heading = "After";\n' }],
        notes: 'bounded syntax-only',
      },
    };
  });
  const proposal = await proposeConstructRepair(
    'Repair only the introduced syntax failure.',
    {
      sourceFiles: [{ path: 'ok.mjs', content: original }],
      originalPatch: [{ path: 'ok.mjs', before: original, after: failed }],
      scope: {
        allowed_paths: ['ok.mjs'],
        protected_paths: defaultProtectedPaths(),
        intended_change: 'Keep the heading change and fix syntax.',
      },
      targets: ['syntax:node --check ok.mjs:ok.mjs'],
      evidence: {
        targets: ['syntax:node --check ok.mjs:ok.mjs'],
        blocker: 'Introduced syntax failure.',
        checks: [
          {
            name: 'syntax:ok.mjs',
            command: 'node --check ok.mjs',
            status: 'failed',
            exit_code: 1,
            log: `SyntaxError OPENAI_API_KEY=${secret}`,
          },
        ],
      },
    },
    new AbortController().signal,
  );
  expect(generate).toHaveBeenCalled();
  expect(proposal.patch[0]?.before).toBe(failed);
  expect(proposal.patch[0]?.after).toContain('After');
});

it('rejects a live repair whose before-text matches the original instead of the failed snapshot', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'false');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const original = 'export const heading = "Before";\n';
  const failed = 'export const heading = "After"\nconst introduced = ;\n';
  generate.mockResolvedValue({
    output: {
      summary: 'wrong baseline',
      patch: [{ path: 'ok.mjs', before: original, after: 'export const heading = "After";\n' }],
      notes: '',
    },
  });
  await expect(
    proposeConstructRepair(
      'Repair only the introduced syntax failure.',
      {
        sourceFiles: [{ path: 'ok.mjs', content: original }],
        originalPatch: [{ path: 'ok.mjs', before: original, after: failed }],
        scope: {
          allowed_paths: ['ok.mjs'],
          protected_paths: defaultProtectedPaths(),
          intended_change: 'Keep the heading change and fix syntax.',
        },
        targets: ['syntax:node --check ok.mjs:ok.mjs'],
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow(/before-text|does not match|malformed|failed/i);
});

it('rejects a truncated before-text from the provider', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'false');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const content = `<h1>Before</h1>\n${'p'.repeat(4500)}`;
  generate.mockResolvedValue({
    output: {
      summary: 'ok',
      patch: [{ path: 'preview.html', before: content.slice(0, 4000), after: content.replace('Before', 'After') }],
      notes: '',
    },
  });
  await expect(
    proposeConstructChange(
      'change the heading',
      {
        allowed_paths: ['preview.html'],
        protected_paths: defaultProtectedPaths(),
        intended_change: 'Stay inside the fixture.',
      },
      [{ path: 'preview.html', content }],
      new AbortController().signal,
    ),
  ).rejects.toThrow(/truncated|excerpt|failed/i);
});

