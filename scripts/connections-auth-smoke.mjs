// Disposable local Supabase only. Direct RPC negatives for Connections.
// This is not a live GitHub/Vercel provider test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
assert.equal(
  new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  '127.0.0.1',
  'Disposable loopback Supabase only',
);

const publishable = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const founder = publishable();
const member = publishable();
const anon = publishable();
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY, 'Local service role is required for the broker check');
const broker = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function signIn(client, email) {
  assert.equal(
    (await client.auth.signInWithPassword({ email, password: env.AURELIUS_FOUNDER_PASSWORD }))
      .error,
    null,
  );
}

await signIn(founder, 'founder@aurelius.test');
await signIn(member, 'member@aurelius.test');
const person = await founder.from('persons').select('id').single();
assert.equal(person.error, null);
const personId = person.data.id;
const connectionId = crypto.randomUUID();
const flowId = crypto.randomUUID();
const state = `state-token-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

const begin = await founder.rpc('service_connection_begin_flow', {
  p_id: flowId,
  p_provider: 'github',
  p_state: state,
  p_nonce: `nonce-token-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
  p_verifier: `verifier-token-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
  p_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
});
assert.equal(begin.error, null, begin.error?.message);

const forged = await founder.rpc('service_connection_upsert', {
  p_person: personId,
  p_id: connectionId,
  p_provider: 'github',
  p_status: 'connected',
  p_account_login: 'forged-login',
  p_account_id: '7',
  p_installation: '999',
  p_selected_id: '99',
  p_selected_name: 'forged/repo',
  p_capabilities: { writes: true },
  p_verified: new Date().toISOString(),
  p_error: null,
  p_user_authorization: 'active',
});
assert.ok(forged.error, 'Authenticated founder must not upsert a verified connection');

const claim = await founder.rpc('service_connection_claim_install', {
  p_person: personId,
  p_state: state,
  p_installation: '999',
});
assert.ok(claim.error, 'Authenticated founder must not claim an installation');

const secret = await founder.rpc('service_connection_put_secret', {
  p_person: personId,
  p_id: connectionId,
  p_ciphertext: 'c'.repeat(40),
});
assert.ok(secret.error, 'Authenticated founder must not write connection credentials');

assert.ok((await member.rpc('service_connection_read', { p_provider: 'github' })).error);
assert.ok((await anon.rpc('service_connection_read', { p_provider: 'github' })).error);

const trusted = await broker.rpc('service_connection_upsert', {
  p_person: personId,
  p_id: connectionId,
  p_provider: 'github',
  p_status: 'connecting',
  p_account_login: 'neil',
  p_account_id: '7',
  p_installation: '42',
  p_selected_id: null,
  p_selected_name: null,
  p_capabilities: {},
  p_verified: null,
  p_error: null,
  p_user_authorization: 'active',
});
assert.equal(trusted.error, null, trusted.error?.message);

const intent = await founder.rpc('service_connection_set_selection', {
  p_provider: 'github',
  p_selected_id: '99',
  p_selected_name: 'owner/repo',
});
assert.equal(intent.error, null, intent.error?.message);
const afterIntent = await founder.rpc('service_connection_read', { p_provider: 'github' });
assert.equal(afterIntent.error, null);
assert.equal(afterIntent.data.status, 'connecting');
assert.equal(afterIntent.data.last_verified_at, null);
assert.equal(afterIntent.data.installation_id, '42');

const swap = await founder.rpc('service_connection_upsert', {
  p_person: personId,
  p_id: connectionId,
  p_provider: 'github',
  p_status: 'connected',
  p_account_login: 'neil',
  p_account_id: '7',
  p_installation: '999',
  p_selected_id: '99',
  p_selected_name: 'swapped/repo',
  p_capabilities: {},
  p_verified: new Date().toISOString(),
  p_error: null,
  p_user_authorization: 'active',
});
assert.ok(swap.error, 'Authenticated founder must not swap installation identity');

const revoke = await broker.rpc('service_connection_apply_account', {
  p_provider: 'github',
  p_account: '7',
  p_status: 'expired',
  p_error: 'GitHub user authorization was revoked.',
});
assert.equal(revoke.error, null, revoke.error?.message);
const afterRevoke = await founder.rpc('service_connection_read', { p_provider: 'github' });
assert.equal(afterRevoke.data.status, 'expired');
assert.equal(afterRevoke.data.user_authorization, 'revoked');
assert.equal(afterRevoke.data.installation_id, '42');

const distinct = await broker.rpc('service_connection_apply_account', {
  p_provider: 'github',
  p_account: '7',
  p_status: 'revoked',
  p_error: 'must stay distinct',
});
assert.ok(distinct.error, 'User revocation cannot mark the installation deleted');

assert.equal((await founder.rpc('service_connection_clear', { p_provider: 'github' })).error, null);
console.log(
  'PASS: real local Auth denied authenticated founder forge/swap/credential writes; owner selection stays intent; broker user-revocation is distinct from installation deletion. No live GitHub or Vercel authorization.',
);
