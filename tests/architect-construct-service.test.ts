import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-000000000001',
  revision: 1,
  projectId: '00000000-0000-4000-8000-000000000003',
  error: null as { message: string } | null,
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
    person: { id: state.owner },
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.error
                  ? null
                  : {
                      id: state.projectId,
                      person_id: state.owner,
                      revision: state.revision,
                      content: { status: 'active', name: 'Synthetic' },
                    },
                error: state.error,
              }),
            }),
          }),
        }),
      }),
    },
  }),
}));
import {
  cancelConstruct,
  constructStore,
  startConstruct,
  startFixtureConstruct,
} from '@/domains/architect-construct/service';
import { approvalHash } from '@/domains/architect-construct/hash';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { defaultLimits, defaultProtectedPaths } from '@/domains/architect-construct/schema';

beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  state.owner = '00000000-0000-4000-8000-000000000001';
  state.revision = 1;
  state.error = null;
  const store = constructStore() as unknown as {
    sources: Map<string, unknown>;
    briefs: Map<string, unknown>;
    runs: Map<string, unknown>;
    events: unknown[];
  };
  store.sources.clear();
  store.briefs.clear();
  store.runs.clear();
  store.events.length = 0;
});

it('starts a fixture once and returns the same run on duplicate click', async () => {
  const requestId = '00000000-0000-4000-8000-000000000021';
  const first = await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  const second = await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  expect(first.id).toBe(requestId);
  expect(second.id).toBe(first.id);
  expect(second.status).toBe('queued');
  expect([...constructStore()['runs' as never] as Map<string, unknown>].length).toBe(1);
});

it('rejects a stale project revision and a forged expanded scope', async () => {
  const requestId = '00000000-0000-4000-8000-000000000022';
  await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  state.revision = 2;
  await expect(
    startConstruct({
      action: 'start',
      projectId: state.projectId,
      briefId: requestId,
      requestId: '00000000-0000-4000-8000-000000000023',
      expected: 2,
    }),
  ).rejects.toThrow(/invalid|changed|revision/i);
  const source = fixtureSource(state.owner, '00000000-0000-4000-8000-000000000024');
  await constructStore().importSource(source);
  const forged = fixtureScope({
    projectId: state.projectId,
    projectRevision: 2,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  });
  forged.allowed_paths.push('secrets/key');
  forged.protected_paths = defaultProtectedPaths();
  forged.resource_limits = defaultLimits;
  const brief = await constructStore().approveBrief(state.owner, '00000000-0000-4000-8000-000000000025', {
    ...forged,
    allowed_paths: ['preview.html'],
  });
  expect(brief.approval_hash).toBe(approvalHash(brief.scope));
  expect(brief.scope.allowed_paths).not.toContain('secrets/key');
});

it('keeps cancel owner-scoped and does not replay a finished request', async () => {
  const requestId = '00000000-0000-4000-8000-000000000026';
  await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  const cancelled = await cancelConstruct({
    action: 'cancel',
    projectId: state.projectId,
    runId: requestId,
  });
  expect(cancelled.status).toBe('cancelled');
  const replay = await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  expect(replay.status).toBe('cancelled');
  state.owner = '00000000-0000-4000-8000-000000000002';
  await expect(
    cancelConstruct({ action: 'cancel', projectId: state.projectId, runId: requestId }),
  ).rejects.toThrow(/unavailable|not/i);
});
