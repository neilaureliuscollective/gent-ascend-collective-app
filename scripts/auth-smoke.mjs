import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
assert.equal(
  new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  '127.0.0.1',
  'local-only integration test',
);
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const founder = client(),
  member = client(),
  anon = client();
for (const [c, email] of [
  [founder, 'founder@aurelius.test'],
  [member, 'member@aurelius.test'],
]) {
  const { error } = await c.auth.signInWithPassword({
    email,
    password: env.AURELIUS_FOUNDER_PASSWORD,
  });
  assert.equal(error, null);
}
const { data: people, error } = await founder.from('persons').select('*');
assert.equal(error, null);
assert.equal(people.length, 1);
const { data: others } = await member.from('persons').select('*').eq('id', people[0].id);
assert.equal(others.length, 0);
const { error: escalation } = await founder
  .from('membership_accounts')
  .update({ tier: 'health' })
  .eq('person_id', people[0].id);
assert.ok(escalation);
const { error: anonymous } = await anon.from('persons').select('*');
assert.ok(anonymous);
const { error: update } = await founder
  .from('persons')
  .update({ display_name: 'Founder' })
  .eq('id', people[0].id);
assert.equal(update, null);
console.log(
  'PASS: real local Auth, person mapping, owner write, cross-user isolation, billing denial, anonymous denial',
);
