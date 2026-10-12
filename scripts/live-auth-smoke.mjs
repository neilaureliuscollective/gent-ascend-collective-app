// Real local Auth/PostgREST acceptance with synthetic data; no OpenAI/provider requests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(url.hostname, '127.0.0.1', 'Live Auth test is local-only');
assert.equal(url.protocol, 'http:', 'Live Auth test is local-only');
const client = () =>
  createClient(url.href, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const founder = client(),
  member = client(),
  anon = client();
for (const [session, email] of [
  [founder, 'founder@aurelius.test'],
  [member, 'member@aurelius.test'],
])
  assert.equal(
    (await session.auth.signInWithPassword({ email, password: env.AURELIUS_FOUNDER_PASSWORD }))
      .error,
    null,
  );
const owner = await founder.from('persons').select('id,timezone').single();
assert.equal(owner.error, null);
assert.equal(
  (await founder.from('founder_access').select('person_id').eq('person_id', owner.data.id)).data
    .length,
  1,
  'Apply the local synthetic grant fixture first',
);
const conversation = crypto.randomUUID(),
  session = crypto.randomUUID(),
  review = crypto.randomUUID(),
  action = crypto.randomUUID();
try {
  const reserve = {
    p_id: session,
    p_conversation: conversation,
    p_model: 'synthetic-no-provider-call',
  };
  assert.ok(
    (
      await member.rpc('ai_live_reserve', {
        ...reserve,
        p_id: crypto.randomUUID(),
        p_conversation: crypto.randomUUID(),
      })
    ).error,
    'Ungrantable member pilot',
  );
  assert.equal((await founder.rpc('ai_live_reserve', reserve)).error, null);
  assert.equal(
    (await member.from('ai_live_sessions').select('id').eq('id', session)).data.length,
    0,
  );
  assert.ok((await anon.from('ai_live_sessions').select('id')).error);
  assert.equal(
    (
      await member.rpc('ai_live_attach', {
        p_id: session,
        p_call: 'synthetic-call',
        p_tag: 'a'.repeat(64),
      })
    ).data,
    false,
  );
  assert.equal((await member.rpc('ai_live_end', { p_id: session, p_reason: 'ended' })).data, false);
  assert.equal((await founder.rpc('ai_live_end', { p_id: session, p_reason: 'ended' })).data, true);
  const ended = (
    await founder.from('ai_live_sessions').select('ended_at').eq('id', session).single()
  ).data.ended_at;
  assert.ok(ended);
  await founder.rpc('ai_live_end', { p_id: session, p_reason: 'ended' });
  assert.equal(
    (await founder.from('ai_live_sessions').select('ended_at').eq('id', session).single()).data
      .ended_at,
    ended,
  );
  assert.equal(
    (
      await founder.rpc('ai_propose_coworker_review', {
        p_id: review,
        p_conversation: conversation,
        p_prompt: 'Synthetic review for local Auth acceptance',
        p_coworker: 'athena',
        p_scope: 'task-only',
      })
    ).error,
    null,
  );
  assert.equal(
    (await member.from('ai_conversation_artifacts').select('id').eq('id', review)).data.length,
    0,
  );
  assert.equal(
    (
      await founder.rpc('ai_claim_visual_artifact', {
        p_id: review,
        p_approve: true,
        p_model: 'synthetic-no-provider-call',
      })
    ).error,
    null,
  );
  const board = {
    kind: 'review',
    basis: 'coworker',
    title: 'Synthetic Auth review',
    summary: 'Fixture only',
    coworker: 'athena',
    text: 'User confirmation is required.',
    contextScope: 'task-only',
    sourceArtifactId: null,
    sourcePartId: null,
  };
  assert.equal(
    (
      await founder.rpc('ai_finish_metered_visual_artifact', {
        p_id: review,
        p_visual: board,
        p_text: 'Synthetic fixture, not model output',
        p_input: 0,
        p_output: 0,
        p_duration: 0,
        p_stages: 1,
        p_usage_complete: true,
      })
    ).error,
    null,
  );
  assert.equal(
    (await founder.rpc('ai_select_artifact', { p_conversation: conversation, p_artifact: review }))
      .error,
    null,
  );
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: owner.data.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  const entry = await founder
    .from('daily_entries')
    .select('version')
    .eq('person_id', owner.data.id)
    .eq('day', day)
    .maybeSingle();
  assert.equal(entry.error, null);
  const confirm = {
    p_id: action,
    p_conversation: conversation,
    p_review: review,
    p_title: 'Synthetic user-confirmed action',
    p_day: day,
    p_version: entry.data?.version ?? 0,
    p_timezone: owner.data.timezone,
  };
  assert.ok((await member.rpc('ai_confirm_reviewed_daily_action', confirm)).error);
  assert.ok(
    (
      await founder.rpc('ai_confirm_reviewed_daily_action', {
        ...confirm,
        p_version: confirm.p_version + 1,
      })
    ).error,
  );
  assert.equal((await founder.rpc('ai_confirm_reviewed_daily_action', confirm)).data, day);
  assert.equal((await founder.rpc('ai_confirm_reviewed_daily_action', confirm)).data, day);
  assert.ok(
    (
      await founder.rpc('ai_confirm_reviewed_daily_action', {
        ...confirm,
        p_title: 'Changed replay',
      })
    ).error,
  );
  const saved = await founder
    .from('daily_actions')
    .select('id,title,done')
    .eq('id', action)
    .eq('day', day)
    .single();
  assert.equal(saved.error, null);
  assert.equal(saved.data.title, confirm.p_title);
  assert.equal(saved.data.done, false);
  assert.equal((await member.from('daily_actions').select('id').eq('id', action)).data.length, 0);
  assert.ok((await anon.from('daily_actions').select('id')).error);
  assert.ok(
    (
      await founder
        .from('ai_action_proposals')
        .update({ title: 'Direct mutation' })
        .eq('id', action)
    ).error,
  );
  console.log(
    'PASS: real local Auth/PostgREST Live reservation/end, two-account isolation, reviewed action idempotency/stale denial and canonical receipt. No provider/audio acceptance implied.',
  );
} finally {
  await founder.rpc('ai_live_end', { p_id: session, p_reason: 'ended' });
  await founder.from('ai_conversations').delete().eq('id', conversation);
  await Promise.all([founder.auth.signOut(), member.auth.signOut()]);
}
