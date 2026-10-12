import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  generate: vi.fn(),
  rpc: vi.fn(),
  rows: new Map<string, unknown>(),
  access: true,
}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({
    person: { id: 'owner' },
    client: {
      rpc: state.rpc,
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          gt: () => query,
          order: () => query,
          limit: async () => ({ data: state.rows.get(table) ?? [], error: null }),
          maybeSingle: async () => ({
            data: table === 'architect_origin_runs' ? null : state.rows.get(table),
            error: null,
          }),
        };
        return query;
      },
    },
  }),
}));
vi.mock('@/domains/access/current', () => ({
  currentAccess: async () => new Set(state.access ? ['aurelius.context'] : []),
}));
vi.mock('@/domains/intelligence/prompt', () => ({ sharedCharacter: 'Shared reviewed conduct' }));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({ responses: () => 'configured-model' }),
  openai: { tools: { webSearch: () => ({}) } },
}));
vi.mock('ai', () => ({ generateText: state.generate, Output: { object: () => ({}) } }));
import { generateOrigin, saveOrigin } from '@/domains/architect-origin/service';
import { initialProject, generateCommand } from '@/domains/architect-origin/schema';
const id = 'd0000000-0000-4000-8000-000000000001';
const input = generateCommand.parse({
  action: 'generate',
  projectId: id,
  requestId: crypto.randomUUID(),
  expected: 1,
  kind: 'conversation',
  instruction: 'Clarify my objectives',
  documentKind: 'Business plan',
  documentId: null,
  consent: true,
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_ORIGIN_AI_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'synthetic');
  vi.stubEnv('AETHELIOS_LIVE_ENABLED', 'false');
  state.access = true;
  state.rows.clear();
  state.rows.set('architect_origin_projects', {
    id,
    person_id: 'owner',
    revision: 1,
    content: initialProject('Synthetic idea', 'business'),
  });
  state.rpc.mockResolvedValue({ data: true, error: null });
  state.generate.mockResolvedValue({
    output: {
      reply: 'Useful proposal',
      changes: [
        { section: 'audience', content: 'Proposed audience', reason: 'Clarify beneficiaries' },
      ],
      document: null,
      documentEdits: [],
    },
    sources: [],
    usage: { inputTokens: 100, outputTokens: 150 },
  });
});
it('reserves both project and existing AI quotas before one bounded provider call, then persists only a proposal', async () => {
  const run = await generateOrigin(input, new AbortController().signal);
  expect(state.rpc.mock.calls.map((c) => c[0])).toEqual([
    'architect_origin_begin',
    'ai_begin_turn',
    'ai_finish_turn',
    'architect_origin_finish',
  ]);
  const args = state.generate.mock.calls[0]![0];
  expect(args.maxRetries).toBe(0);
  expect(args.timeout.totalMs).toBe(45000);
  expect(args.providerOptions.openai.store).toBe(false);
  expect(args.tools).toBeUndefined();
  expect(run.output?.changes[0]?.section).toBe('audience');
  expect(state.rpc).not.toHaveBeenCalledWith('architect_origin_save', expect.anything());
});
it('never invokes the model after entitlement, config or reservation denial', async () => {
  state.access = false;
  await expect(generateOrigin(input, new AbortController().signal)).rejects.toThrow(/access/);
  expect(state.generate).not.toHaveBeenCalled();
  state.access = true;
  state.rpc.mockResolvedValueOnce({ error: { code: 'denied' }, data: null });
  await expect(generateOrigin(input, new AbortController().signal)).rejects.toThrow(/refused/);
  expect(state.generate).not.toHaveBeenCalled();
  vi.stubEnv('ARCHITECT_ORIGIN_AI_ENABLED', 'false');
  await expect(generateOrigin(input, new AbortController().signal)).rejects.toThrow(/unavailable/);
});
it('keeps research unapproved when the provider returns no sources', async () => {
  const run = await generateOrigin({ ...input, kind: 'research' }, new AbortController().signal);
  expect(run.output?.researchAvailable).toBe(false);
  expect(run.output?.reply).toMatch(/no attributed sources/);
  expect(run.output?.changes).toEqual([]);
  expect(state.generate.mock.calls[0]![0].tools).toBeDefined();
});
it('records only safe provider metadata as research attribution', async () => {
  state.generate.mockResolvedValueOnce({
    output: { reply: 'Research summary', changes: [], document: null, documentEdits: [] },
    sources: [
      { sourceType: 'url', url: 'https://example.com/research', title: 'Evidence' },
      { sourceType: 'url', url: 'https://user:password@example.com', title: 'Invalid' },
    ],
    usage: {},
  });
  const run = await generateOrigin({ ...input, kind: 'research' }, new AbortController().signal);
  expect(run.output?.sources).toEqual([
    { url: 'https://example.com/research', title: 'Evidence', provenance: 'provider' },
  ]);
});
it('preserves failure receipts without a retry or approved-content write', async () => {
  state.generate.mockRejectedValueOnce(new Error('timeout'));
  await expect(generateOrigin(input, new AbortController().signal)).rejects.toThrow(
    /failed or timed out/,
  );
  expect(state.generate).toHaveBeenCalledOnce();
  expect(state.rpc).toHaveBeenCalledWith('architect_origin_finish', {
    p_request: input.requestId,
    p_output: null,
  });
});
it('does not report a proposal saved when its persistence acknowledgment fails', async () => {
  state.rpc.mockImplementation(async (name: string) => ({
    data: name === 'architect_origin_finish' ? false : true,
    error: null,
  }));
  await expect(generateOrigin(input, new AbortController().signal)).rejects.toThrow(
    /save unconfirmed/,
  );
});
it('saves only via the ownership and expected-revision RPC and reports unconfirmed writes', async () => {
  state.rpc.mockResolvedValueOnce({ data: 2, error: null });
  await expect(
    saveOrigin({
      action: 'save',
      projectId: id,
      requestId: input.requestId,
      expected: 1,
      content: initialProject('Synthetic idea', 'business'),
      note: 'Confirmed update',
    }),
  ).resolves.toEqual({ revision: 2, requestId: input.requestId });
  state.rpc.mockResolvedValueOnce({ data: null, error: { code: 'conflict' } });
  await expect(
    saveOrigin({
      action: 'save',
      projectId: id,
      requestId: input.requestId,
      expected: 1,
      content: initialProject('Synthetic idea', 'business'),
      note: 'Confirmed update',
    }),
  ).rejects.toThrow(/not confirmed/);
});
it('revises selected documents with exact patches rather than replacing truncated model context', async () => {
  const docId = crypto.randomUUID();
  const original =
    '# Plan\n\nOld requirement\n\n' + 'Unchanged context. '.repeat(800) + '\nUnseen final section';
  const project = state.rows.get('architect_origin_projects') as {
    content: ReturnType<typeof initialProject>;
  };
  project.content.documents = [
    {
      id: docId,
      title: 'Approved plan',
      kind: 'Business plan',
      status: 'approved',
      basis: 1,
      content: original,
    },
  ];
  state.generate.mockResolvedValueOnce({
    output: {
      reply: 'Focused revision for your review.',
      changes: [],
      document: null,
      documentEdits: [{ before: 'Old requirement', after: 'Reviewed requirement' }],
    },
    sources: [],
    usage: {},
  });
  const run = await generateOrigin(
    { ...input, kind: 'document', documentId: docId },
    new AbortController().signal,
  );
  expect(run.output?.document?.content).toBe(
    original.replace('Old requirement', 'Reviewed requirement'),
  );
  expect(project.content.documents[0]!.content).toBe(original);
  expect(state.rpc).not.toHaveBeenCalledWith('architect_origin_save', expect.anything());
});
it('rejects ambiguous document edits without altering approved text', async () => {
  const docId = crypto.randomUUID();
  const project = state.rows.get('architect_origin_projects') as {
    content: ReturnType<typeof initialProject>;
  };
  project.content.documents = [
    {
      id: docId,
      title: 'Plan',
      kind: 'Business plan',
      status: 'approved',
      basis: 1,
      content: 'Repeated sentence. Repeated sentence.',
    },
  ];
  state.generate.mockResolvedValueOnce({
    output: {
      reply: 'Attempt',
      changes: [],
      document: null,
      documentEdits: [{ before: 'Repeated sentence.', after: 'Replacement' }],
    },
    sources: [],
    usage: {},
  });
  await expect(
    generateOrigin({ ...input, kind: 'document', documentId: docId }, new AbortController().signal),
  ).rejects.toThrow(/failed/);
  expect(project.content.documents[0]!.content).toBe('Repeated sentence. Repeated sentence.');
});
