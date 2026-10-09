import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateManifest,
  validatePublicKey,
  cleanupArtifacts,
  runAcceptance,
} from './public-hosted-acceptance.mjs';
const tree = 'a'.repeat(40);
const now = Date.now();
const account = (n) => ({
  authUserId: `00000000-0000-4000-8000-00000000000${n}`,
  personId: `10000000-0000-4000-8000-00000000000${n}`,
});
const manifest = () => ({
  contract: 'public-hosted-acceptance-v1',
  scope: 'isolated-staging',
  projectRef: 'abcdefghijklmnopqrst',
  candidateTree: tree,
  expiresAt: new Date(now + 60000).toISOString(),
  syntheticWritesApproved: true,
  branchIdentityVerified: true,
  accounts: [account(1), account(2)],
});

test('binds staging target, exact candidate and two distinct verified identities', () => {
  assert.equal(validateManifest(manifest(), tree, now), 'https://abcdefghijklmnopqrst.supabase.co');
  for (const change of [
    { projectRef: 'volpzkfsnmtztrovexcw' },
    { projectRef: 'tybjocxecilkmozkvuns' },
    { scope: 'production' },
    { projectRef: 'localhost' },
    { candidateTree: 'b'.repeat(40) },
    { syntheticWritesApproved: false },
    { branchIdentityVerified: false },
    { accounts: [account(1), account(1)] },
  ]) {
    assert.throws(() => validateManifest({ ...manifest(), ...change }, tree, now));
  }
});
test('rejects expired, far-future and malformed scope', () => {
  for (const expiresAt of [
    new Date(now - 1).toISOString(),
    new Date(now + 86400001).toISOString(),
    'invalid',
  ])
    assert.throws(() => validateManifest({ ...manifest(), expiresAt }, tree, now));
  assert.throws(() => validateManifest(null, tree, now));
});
test('rejects secret and service-role API keys', () => {
  const token = (role) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(validatePublicKey(token('anon')), token('anon'));
  assert.equal(validatePublicKey('sb_publishable_test'), 'sb_publishable_test');
  for (const key of [
    'sb_secret_test',
    token('service_role'),
    token('authenticated'),
    undefined,
    'garbage',
    'sb_publishable_' + 'x'.repeat(5000),
  ])
    assert.throws(() => validatePublicKey(key));
});
test('identity failure performs no writes or cleanup requests', async () => {
  const client = {
    auth: { getUser: async () => ({ error: null, data: { user: { id: account(2).authUserId } } }) },
    from() {
      throw new Error('unexpected write');
    },
    storage: {
      from() {
        throw new Error('unexpected storage');
      },
    },
  };
  const report = await runAcceptance(client, client, client, [account(1), account(2)], {
    checks: [],
  });
  assert.deepEqual(report.checks, [{ check: 'identity', status: 'failed' }]);
  assert.equal(report.cleanupStatus, 'not-started');
  assert.equal(report.status, 'failed');
});
test('cleanup attempts every owned artifact after one failure and reports only bounded names', async () => {
  const touched = [];
  const query = (table) => ({
    select() {
      return this;
    },
    eq() {
      return this;
    },
    delete() {
      touched.push(table);
      return this;
    },
    maybeSingle: async () => ({ error: null, data: { project_id: 'synthetic-studio' } }),
    then(done) {
      return Promise.resolve(
        table === 'mission_deliverables'
          ? { error: null, data: [{ id: 'synthetic-doc', revision: 2 }] }
          : { error: null },
      ).then(done);
    },
  });
  const owner = {
    from: query,
    rpc: async () => {
      touched.push('document');
      return { error: { message: 'private' } };
    },
    storage: {
      from: () => ({
        remove: async (paths) => {
          touched.push(paths);
          return { error: null };
        },
        list: async () => ({ error: null, data: [] }),
      }),
    },
  };
  const failures = await cleanupArtifacts(owner, {
    mission: 'synthetic-mission',
    turn: 'synthetic-turn',
    thread: 'synthetic-thread',
    storage: 'synthetic-user/synthetic.png',
  });
  assert.deepEqual(failures, ['deliverables']);
  assert.ok(touched.includes('intelligence_missions'));
  assert.ok(touched.includes('ai_conversations'));
  assert.ok(touched.includes('ai_studio_projects'));
  assert.deepEqual(touched.find(Array.isArray), [
    'synthetic-user/synthetic.png',
    'synthetic-user/synthetic-forged.png',
  ]);
});
