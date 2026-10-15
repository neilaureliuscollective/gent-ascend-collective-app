import { expect, it } from 'vitest';
import {
  MUTATION_CONFLICT,
  VERSION_CONFLICT,
  assertExpectedVersion,
  assertReplayPayload,
  mutationPayloadEquals,
} from '@/domains/architect-apps/mutation';
import { appWorkbenchStage } from '@/domains/architect-apps/stage';
import { MemoryAppStore } from '@/domains/architect-apps/store';

it('binds replay to an immutable payload snapshot and rejects a changed payload', () => {
  expect(
    mutationPayloadEquals(
      { title: 'Site visit', body: 'North wall', hours: 2, persisted: true, version: 1 },
      { title: 'Site visit', body: 'North wall', hours: 2 },
    ),
  ).toBe(true);
  expect(() =>
    assertReplayPayload({ title: 'Site visit', hours: 2 }, { title: 'Changed', hours: 2 }),
  ).toThrow(MUTATION_CONFLICT);
  expect(() => assertExpectedVersion(2, 1)).toThrow(VERSION_CONFLICT);
  expect(() => assertExpectedVersion(1, 1)).not.toThrow();
});

it('creates a new identity after a successful save and keeps a pending draft', async () => {
  const store = new MemoryAppStore();
  const created = await store.writeRecord({
    personId: 'owner',
    projectId: 'project',
    appId: 'app',
    collection: 'notes',
    payload: { title: 'A', hours: 1 },
    idempotencyKey: 'create-1',
    id: 'note-1',
  });
  const replay = await store.writeRecord({
    personId: 'owner',
    projectId: 'project',
    appId: 'app',
    collection: 'notes',
    payload: { title: 'A', hours: 1 },
    idempotencyKey: 'create-1',
    id: 'note-1',
  });
  expect(replay.id).toBe(created.id);
  expect(replay.version).toBe(1);
  await expect(
    store.writeRecord({
      personId: 'owner',
      projectId: 'project',
      appId: 'app',
      collection: 'notes',
      payload: { title: 'Changed', hours: 1 },
      idempotencyKey: 'create-1',
      id: 'note-1',
    }),
  ).rejects.toThrow(/mutation identity|different record/i);
  const editA = await store.writeRecord({
    personId: 'owner',
    projectId: 'project',
    appId: 'app',
    collection: 'notes',
    payload: { title: 'A edited', hours: 2 },
    idempotencyKey: 'edit-a',
    id: created.id,
    expectedVersion: 1,
  });
  expect(editA.version).toBe(2);
  const lostAck = await store.writeRecord({
    personId: 'owner',
    projectId: 'project',
    appId: 'app',
    collection: 'notes',
    payload: { title: 'A edited', hours: 2 },
    idempotencyKey: 'edit-a',
    id: created.id,
    expectedVersion: 1,
  });
  expect(lostAck.id).toBe(editA.id);
  expect(lostAck.version).toBe(2);
  const editB = await store.writeRecord({
    personId: 'owner',
    projectId: 'project',
    appId: 'app',
    collection: 'notes',
    payload: { title: 'B', hours: 3 },
    idempotencyKey: 'edit-b',
    id: created.id,
    expectedVersion: 2,
  });
  expect(editB.payload.title).toBe('B');
  expect(editB.version).toBe(3);
  await expect(
    store.writeRecord({
      personId: 'owner',
      projectId: 'project',
      appId: 'app',
      collection: 'notes',
      payload: { title: 'Stale', hours: 4 },
      idempotencyKey: 'edit-stale',
      id: created.id,
      expectedVersion: 2,
    }),
  ).rejects.toThrow(/Record changed/i);
});

it('derives workbench stages from real job, preview and save acknowledgments', () => {
  expect(appWorkbenchStage({}).stage).toBe('idle');
  expect(appWorkbenchStage({ job: { status: 'queued' } }).stage).toBe('preparing');
  expect(appWorkbenchStage({ job: { status: 'running' }, events: [{ kind: 'typecheck' }] }).stage).toBe(
    'checking',
  );
  expect(appWorkbenchStage({ job: { status: 'running' }, events: [{ kind: 'bundle' }] }).stage).toBe(
    'building',
  );
  expect(appWorkbenchStage({ preview: { srcDoc: '<html></html>', revision: 1 } }).stage).toBe(
    'preview-ready',
  );
  expect(appWorkbenchStage({ saveState: 'saving' }).stage).toBe('saving');
  expect(appWorkbenchStage({ saveState: 'saved' }).stage).toBe('saved');
  expect(appWorkbenchStage({ saveState: 'conflict' }).stage).toBe('conflict');
  expect(appWorkbenchStage({ saveState: 'failed' }).stage).toBe('failed');
  expect(appWorkbenchStage({ job: { status: 'failed', result: { ok: false, blocker: 'Typecheck failed.' } } }).label).toMatch(
    /Typecheck failed/,
  );
  expect(appWorkbenchStage({ job: { status: 'cancelled' } }).stage).toBe('cancelled');
}
)