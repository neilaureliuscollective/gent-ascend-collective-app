import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const owner = '00000000-0000-4000-8000-000000000001';
const projectId = '00000000-0000-4000-8000-000000000003';
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
    person: { id: owner },
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: projectId,
                  person_id: owner,
                  revision: 1,
                  content: { name: 'Field notes', blueprint: { vision: 'Record field notes.' } },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    },
  }),
}));
import { APP_DATA_BRIDGE_CONTRACT } from '@/domains/architect-apps/context';
import {
  APP_ACCEPTANCE_BUDGET,
  APP_ACCEPTANCE_MODEL,
  APP_ACCEPTANCE_PRICING,
  assertApprovedAppGenerationModel,
  boundAppGenerationInputTokens,
  memoryAppBudgetStore,
  reservedCallMicros,
  resetAppBudgetMemory,
} from '@/domains/architect-apps/budget';
import { classifyPaidGenerationReadiness } from '@/domains/architect-apps/pilot';
import {
  approveArchitectApp,
  appStore,
  proposeArchitectApp,
  requireAppsPilotExecutionAccess,
  startArchitectApp,
} from '@/domains/architect-apps/service';
import { mockedSupportedAppProposal } from '@/domains/architect-apps/provider';
import { processAppBuildOnce } from '@/domains/architect-apps/worker';
import { MemoryAppStore } from '@/domains/architect-apps/store';

afterEach(() => {
  vi.unstubAllEnvs();
});

const digest = `sha256:${'ab'.repeat(32)}`;
const readyRuntime = {
  schemaCompatible: true,
  workerPresent: true,
  observedDigest: digest,
  isolation: 'docker' as const,
  queueReady: true,
  artifactsReady: true,
  ageMs: 1_000,
  state: 'idle' as const,
};

const founderPilotEnv = {
  APP_ENV: 'production',
  ARCHITECT_ORIGIN_ENABLED: 'true',
  ARCHITECT_APPS_ENABLED: 'true',
  ARCHITECT_APPS_FOUNDER_PILOT: 'true',
  ARCHITECT_APPS_AI_ENABLED: 'true',
  OPENAI_API_KEY: 'sk-test',
  ARCHITECT_APPS_IMAGE_DIGEST: digest,
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'hosted-publishable-key',
};

it('keeps gpt-6-astra short-context pricing and a two-call reserved dollar cap', () => {
  expect(APP_ACCEPTANCE_MODEL).toBe('gpt-6-astra');
  expect(APP_ACCEPTANCE_PRICING.inputMicrosPerToken).toBe(10);
  expect(APP_ACCEPTANCE_PRICING.outputMicrosPerToken).toBe(50);
  expect(APP_ACCEPTANCE_BUDGET.maxCalls).toBe(2);
  expect(reservedCallMicros(16000, 4000) * 2).toBeLessThanOrEqual(APP_ACCEPTANCE_BUDGET.maxMicros);
});

it('refuses ordinary owners for executable work when the founder pilot is required', async () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_FOUNDER_PILOT', 'true');
  vi.stubEnv('ARCHITECT_APPS_AI_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'hosted-publishable-key');
  await expect(requireAppsPilotExecutionAccess(process.env, async () => false)).rejects.toThrow(/founder pilot/i);
  await expect(requireAppsPilotExecutionAccess(process.env, async () => true)).resolves.toBeUndefined();
  vi.stubEnv('ARCHITECT_APPS_FOUNDER_PILOT', '');
  await expect(requireAppsPilotExecutionAccess(process.env, async () => true)).rejects.toThrow(/executable work stays off/i);
});

it('does not send a paid request when worker readiness is missing or stale', async () => {
  Object.entries(founderPilotEnv).forEach(([key, value]) => vi.stubEnv(key, value));
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  let called = 0;
  const transport = async () => {
    called += 1;
    return mockedSupportedAppProposal({ kind: 'create', files: [] });
  };
  await expect(
    proposeArchitectApp(
      {
        action: 'propose',
        projectId,
        requestId: '00000000-0000-4000-8000-000000000901',
        expected: 1,
        instruction: 'Create field notes.',
        kind: 'create',
        demo: 'none',
      },
      transport,
      { verifyFounder: async () => true },
    ),
  ).rejects.toThrow(/No model request was sent/i);
  expect(called).toBe(0);
  expect(
    classifyPaidGenerationReadiness(
      { ...readyRuntime, workerPresent: false, isolation: 'unavailable' },
      founderPilotEnv,
    ).ok,
  ).toBe(false);
  expect(
    classifyPaidGenerationReadiness({ ...readyRuntime, ageMs: 120_000 }, founderPilotEnv).missing,
  ).toContain('heartbeat');
});

it('reserves two calls atomically and treats uncertain usage as spent', async () => {
  resetAppBudgetMemory();
  const store = memoryAppBudgetStore();
  const runId = '00000000-0000-4000-8000-000000000801';
  const personId = '00000000-0000-4000-8000-000000000001';
  const first = store.reserve({
    requestId: '00000000-0000-4000-8000-000000000811',
    runId,
    personId,
    inputTokens: 1000,
    outputTokens: 4000,
  });
  const second = store.reserve({
    requestId: '00000000-0000-4000-8000-000000000812',
    runId,
    personId,
    inputTokens: 1000,
    outputTokens: 4000,
  });
  const third = store.reserve({
    requestId: '00000000-0000-4000-8000-000000000813',
    runId,
    personId,
    inputTokens: 1000,
    outputTokens: 4000,
  });
  await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  await expect(third).rejects.toThrow(/two model calls/i);
  const replay = await store.reserve({
    requestId: '00000000-0000-4000-8000-000000000811',
    runId,
    personId,
    inputTokens: 1000,
    outputTokens: 4000,
  });
  expect(replay.created).toBe(false);
  expect(replay.reservation.status).toBe('reserved');
  await store.finish({
    requestId: '00000000-0000-4000-8000-000000000812',
    personId,
    status: 'uncertain',
  });
  const listed = await store.list(runId, personId);
  expect(listed.find((row) => row.requestId.endsWith('812'))?.usedMicros).toBeGreaterThan(0);
});

it('rejects an unsupported model override before a paid reservation', async () => {
  resetAppBudgetMemory();
  Object.entries({
    ...founderPilotEnv,
    AURELIUS_AI_MODEL: 'gpt-4o',
    ARCHITECT_APPS_STORE: 'memory',
    ARCHITECT_APPS_PREVIEW_SECRET: 'service-preview-secret-key',
  }).forEach(([key, value]) => vi.stubEnv(key, value));
  let called = 0;
  await expect(
    proposeArchitectApp(
      {
        action: 'propose',
        projectId,
        requestId: '00000000-0000-4000-8000-000000000931',
        expected: 1,
        instruction: 'Create field notes.',
        kind: 'create',
        demo: 'none',
      },
      async () => {
        called += 1;
        return mockedSupportedAppProposal({ kind: 'create', files: [] });
      },
      { verifyFounder: async () => true, runtime: readyRuntime, budget: memoryAppBudgetStore() },
    ),
  ).rejects.toThrow(/not an approved override/i);
  expect(called).toBe(0);
});

it('settles a delayed provider failure as uncertain instead of cancelling to zero', async () => {
  resetAppBudgetMemory();
  Object.entries({
    APP_ENV: 'local',
    ARCHITECT_ORIGIN_ENABLED: 'true',
    ARCHITECT_APPS_ENABLED: 'true',
    ARCHITECT_APPS_STORE: 'memory',
    ARCHITECT_APPS_AI_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test',
    ARCHITECT_APPS_IMAGE_DIGEST: digest,
    ARCHITECT_APPS_PREVIEW_SECRET: 'service-preview-secret-key',
  }).forEach(([key, value]) => vi.stubEnv(key, value));
  const budget = memoryAppBudgetStore();
  const requestId = '00000000-0000-4000-8000-000000000932';
  await expect(
    proposeArchitectApp(
      {
        action: 'propose',
        projectId,
        requestId,
        expected: 1,
        instruction: 'Create field notes.',
        kind: 'create',
        demo: 'none',
      },
      async () => {
        throw new Error('Simulated provider timeout. This is not a paid OpenAI call.');
      },
      { verifyFounder: async () => true, runtime: readyRuntime, budget },
    ),
  ).rejects.toThrow(/simulated provider timeout/i);
  const listed = await budget.list(projectId, owner);
  expect(listed).toHaveLength(1);
  expect(listed[0]?.status).toBe('uncertain');
  expect(listed[0]?.usedMicros).toBeGreaterThan(0);
});

it('does not send a second provider call for the same reserved request', async () => {
  resetAppBudgetMemory();
  Object.entries({
    APP_ENV: 'local',
    ARCHITECT_ORIGIN_ENABLED: 'true',
    ARCHITECT_APPS_ENABLED: 'true',
    ARCHITECT_APPS_STORE: 'memory',
    ARCHITECT_APPS_AI_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test',
    ARCHITECT_APPS_IMAGE_DIGEST: digest,
    ARCHITECT_APPS_PREVIEW_SECRET: 'service-preview-secret-key',
  }).forEach(([key, value]) => vi.stubEnv(key, value));
  let called = 0;
  const transport = async () => {
    called += 1;
    return mockedSupportedAppProposal({ kind: 'create', files: [] });
  };
  const budget = memoryAppBudgetStore();
  const input = {
    action: 'propose' as const,
    projectId: '00000000-0000-4000-8000-000000000003',
    requestId: '00000000-0000-4000-8000-000000000911',
    expected: 1,
    instruction: 'Create field notes.',
    kind: 'create' as const,
    demo: 'none' as const,
  };
  await proposeArchitectApp(input, transport, {
    verifyFounder: async () => true,
    runtime: readyRuntime,
    budget,
  });
  await expect(
    proposeArchitectApp(input, transport, {
      verifyFounder: async () => true,
      runtime: readyRuntime,
      budget,
    }),
  ).rejects.toThrow(/already completed its reserved model call|already reserved a model call/i);
  expect(called).toBe(1);
});

it('keeps a queued start after the worker disappears and does not invent success', async () => {
  resetAppBudgetMemory();
  Object.entries({
    APP_ENV: 'local',
    ARCHITECT_ORIGIN_ENABLED: 'true',
    ARCHITECT_APPS_ENABLED: 'true',
    ARCHITECT_APPS_STORE: 'memory',
    ARCHITECT_APPS_AI_ENABLED: 'true',
    OPENAI_API_KEY: 'sk-test',
    ARCHITECT_APPS_IMAGE_DIGEST: digest,
    ARCHITECT_APPS_PREVIEW_SECRET: 'service-preview-secret-key',
  }).forEach(([key, value]) => vi.stubEnv(key, value));
  const store = appStore() as MemoryAppStore;
  store.apps.clear();
  store.revisions.clear();
  store.artifacts.clear();
  store.jobs.clear();
  store.events.length = 0;
  let called = 0;
  const proposed = await proposeArchitectApp(
    {
      action: 'propose',
      projectId: '00000000-0000-4000-8000-000000000003',
      requestId: '00000000-0000-4000-8000-000000000921',
      expected: 1,
      instruction: 'Create field notes.',
      kind: 'create',
      demo: 'none',
    },
    async () => {
      called += 1;
      return mockedSupportedAppProposal({ kind: 'create', files: [] });
    },
    { verifyFounder: async () => true, runtime: readyRuntime, budget: memoryAppBudgetStore() },
  );
  const approved = await approveArchitectApp(
    {
      action: 'approve',
      projectId: '00000000-0000-4000-8000-000000000003',
      requestId: '00000000-0000-4000-8000-000000000922',
      expected: 1,
      approvalHash: proposed.approvalHash,
      proposal: proposed.proposal,
      generation: proposed.generation,
      baseRevision: proposed.baseRevision,
    },
    { verifyFounder: async () => true },
  );
  const job = await startArchitectApp(
    {
      action: 'start',
      projectId: '00000000-0000-4000-8000-000000000003',
      revisionId: approved.revision.id,
      requestId: '00000000-0000-4000-8000-000000000923',
      expected: 1,
      approvalHash: approved.revision.approval_hash,
    },
    { verifyFounder: async () => true },
  );
  expect(job.status).toBe('queued');
  expect(called).toBe(1);
  const finished = await processAppBuildOnce(store, 'worker-gone', new Date(), {
    build: async () => ({
      result: {
        ok: false,
        isolation: 'unavailable',
        sandbox: false,
        typecheck: { ok: false, log: '' },
        bundle: { ok: false, log: '' },
        blocker: 'Commissioned worker became unavailable after admission.',
        stages: [],
      },
      artifacts: [],
      manifestHash: '',
    }),
  });
  expect(finished?.status).toBe('failed');
  expect(finished?.result?.ok).toBe(false);
  expect(store.artifacts.size).toBe(0);
});

it('cancels an unused reservation and does not invent a completed compile', async () => {
  resetAppBudgetMemory();
  const store = memoryAppBudgetStore();
  await store.reserve({
    requestId: '00000000-0000-4000-8000-000000000821',
    runId: '00000000-0000-4000-8000-000000000802',
    personId: '00000000-0000-4000-8000-000000000001',
    inputTokens: 800,
    outputTokens: 4000,
  });
  const cancelled = await store.finish({
    requestId: '00000000-0000-4000-8000-000000000821',
    personId: '00000000-0000-4000-8000-000000000001',
    status: 'cancelled',
  });
  expect(cancelled.usedMicros).toBe(0);
});

it('binds paid generation to gpt-6-astra and a conservative full-request bound', () => {
  expect(() => assertApprovedAppGenerationModel({ AURELIUS_AI_MODEL: 'gpt-5.5' })).toThrow(/not an approved override/i);
  expect(() => assertApprovedAppGenerationModel({ AURELIUS_AI_MODEL: 'gpt-6-astra' })).not.toThrow();
  expect(() => assertApprovedAppGenerationModel({})).not.toThrow();
  const context = {
    instruction: 'Create field notes I can save.',
    kind: 'create' as const,
    files: [],
    collections: [],
    bridge: APP_DATA_BRIDGE_CONTRACT,
  };
  const naiveCharsOverFour = Math.ceil(JSON.stringify({ instruction: context.instruction, kind: context.kind }).length / 4);
  expect(boundAppGenerationInputTokens(context)).toBeGreaterThan(naiveCharsOverFour);
  expect(boundAppGenerationInputTokens(context)).toBeLessThanOrEqual(APP_ACCEPTANCE_BUDGET.maxInputTokens);
});

it('refuses client cancel or reduction after the provider-start boundary', async () => {
  resetAppBudgetMemory();
  const store = memoryAppBudgetStore();
  const requestId = '00000000-0000-4000-8000-000000000841';
  const runId = '00000000-0000-4000-8000-000000000842';
  const personId = '00000000-0000-4000-8000-000000000001';
  const reserved = await store.reserve({
    requestId,
    runId,
    personId,
    inputTokens: 1200,
    outputTokens: 4000,
  });
  const started = await store.begin({ requestId, personId });
  expect(started.status).toBe('started');
  expect((await store.begin({ requestId, personId })).status).toBe('started');
  await expect(store.finish({ requestId, personId, status: 'cancelled' })).rejects.toThrow(/cannot be cancelled to zero/i);
  const completed = await store.finish({
    requestId,
    personId,
    status: 'completed',
    usedInput: 1,
    usedOutput: 1,
  });
  expect(completed.usedInput).toBe(reserved.reservation.reservedInput);
  expect(completed.usedOutput).toBe(reserved.reservation.reservedOutput);
  expect(completed.usedMicros).toBe(reserved.reservation.reservedMicros);
  expect((await store.finish({ requestId, personId, status: 'cancelled' })).status).toBe('completed');
});

it('keeps uncertain usage reserved and does not reopen a third call', async () => {
  resetAppBudgetMemory();
  const store = memoryAppBudgetStore();
  const runId = '00000000-0000-4000-8000-000000000851';
  const personId = '00000000-0000-4000-8000-000000000001';
  const first = await store.reserve({
    requestId: '00000000-0000-4000-8000-000000000852',
    runId,
    personId,
    inputTokens: 16000,
    outputTokens: 4000,
  });
  await store.begin({ requestId: first.reservation.requestId, personId });
  await store.finish({ requestId: first.reservation.requestId, personId, status: 'uncertain', usedInput: 0, usedOutput: 0 });
  const second = await store.reserve({
    requestId: '00000000-0000-4000-8000-000000000853',
    runId,
    personId,
    inputTokens: 16000,
    outputTokens: 4000,
  });
  await store.begin({ requestId: second.reservation.requestId, personId });
  await store.finish({ requestId: second.reservation.requestId, personId, status: 'failed', usedInput: 2, usedOutput: 2 });
  await expect(
    store.reserve({
      requestId: '00000000-0000-4000-8000-000000000854',
      runId,
      personId,
      inputTokens: 1,
      outputTokens: 1,
    }),
  ).rejects.toThrow(/two model calls/i);
  const listed = await store.list(runId, personId);
  expect(listed.every((row) => (row.usedMicros ?? 0) >= row.reservedMicros)).toBe(true);
});
