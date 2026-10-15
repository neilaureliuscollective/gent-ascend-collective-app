import { afterEach, expect, it, vi } from 'vitest';
import {
  MemoryPreviewSessionStore,
  createSharedPreviewMaps,
  previewClusterAllowed,
  resetPreviewSessions,
  revokePreviewSessions,
  signPreviewSession,
  verifyPreviewSession,
} from '@/domains/architect-apps/preview';

const owner = {
  personId: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000003',
  revisionId: '00000000-0000-4000-8000-000000000009',
};
const other = {
  personId: '00000000-0000-4000-8000-000000000002',
  projectId: '00000000-0000-4000-8000-000000000003',
  revisionId: '00000000-0000-4000-8000-000000000009',
};
const secret = 'cluster-preview-secret-key';

afterEach(() => {
  vi.unstubAllEnvs();
  resetPreviewSessions();
});

function clusterEnv() {
  vi.stubEnv('ARCHITECT_APPS_PREVIEW_CLUSTER', 'true');
  vi.stubEnv('ARCHITECT_APPS_PREVIEW_SECRET', secret);
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'hosted-publishable-key');
}

it('shares owner, revision, expiry and revocation across two instances and stays fail-closed after restart', async () => {
  const shared = createSharedPreviewMaps();
  const webA = new MemoryPreviewSessionStore(shared);
  const webB = new MemoryPreviewSessionStore(shared);
  clusterEnv();
  expect(previewClusterAllowed()).toBe(true);
  const token = await signPreviewSession({ ...owner, secret, store: webA });
  expect(await verifyPreviewSession(token, owner, secret, webB)).toBe(true);
  const restarted = new MemoryPreviewSessionStore();
  expect(await verifyPreviewSession(token, owner, secret, restarted)).toBe(false);
  await revokePreviewSessions(owner.revisionId, webA);
  expect(await verifyPreviewSession(token, owner, secret, webB)).toBe(false);
  const replaced = await signPreviewSession({ ...owner, secret, store: webB, replace: true });
  expect(await verifyPreviewSession(token, owner, secret, webA)).toBe(false);
  expect(await verifyPreviewSession(replaced, owner, secret, webA)).toBe(true);
  expect(await verifyPreviewSession(replaced, other, secret, webA)).toBe(false);
});

it('keeps one current nonce under concurrent replacement and refuses account switch', async () => {
  const store = new MemoryPreviewSessionStore();
  const first = await signPreviewSession({ ...owner, secret, store });
  const [left, right] = await Promise.all([
    signPreviewSession({ ...owner, secret, store, replace: true }),
    signPreviewSession({ ...owner, secret, store, replace: true }),
  ]);
  const accepted = [first, left, right].filter((token) => token);
  const verified = await Promise.all(accepted.map((token) => verifyPreviewSession(token, owner, secret, store)));
  expect(verified.filter(Boolean)).toHaveLength(1);
  expect(await verifyPreviewSession(left, other, secret, store)).toBe(false);
});

it('never treats a missing local map as authorization, including in cluster mode', async () => {
  resetPreviewSessions();
  const token = await signPreviewSession({ ...owner, secret });
  resetPreviewSessions();
  clusterEnv();
  expect(previewClusterAllowed()).toBe(true);
  expect(await verifyPreviewSession(token, owner, secret)).toBe(false);
});
