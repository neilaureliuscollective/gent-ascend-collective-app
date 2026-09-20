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
// Exercise Stage 2A through real PostgREST, using only the synthetic member.
const { data: memberPerson, error: memberLookup } = await member
  .from('persons')
  .select('*')
  .single();
assert.equal(memberLookup, null);
const { data: existingGoals, error: existingError } = await member
  .from('goals')
  .select('id')
  .eq('status', 'active');
assert.equal(existingError, null);
assert.equal(
  existingGoals.length,
  0,
  'Use a fresh local seed: the synthetic member already has an active goal.',
);
const goalId = crypto.randomUUID();
try {
  const { data: savedProfile, error: profileError } = await member
    .from('persons')
    .update({ priority: 'Synthetic integration check', unit_system: 'metric' })
    .eq('id', memberPerson.id)
    .eq('version', memberPerson.version)
    .select('*')
    .single();
  assert.equal(profileError, null);
  assert.equal(savedProfile.version, memberPerson.version + 1);
  const { data: staleProfile, error: staleProfileError } = await member
    .from('persons')
    .update({ priority: 'Stale' })
    .eq('id', memberPerson.id)
    .eq('version', memberPerson.version)
    .select('id');
  assert.equal(staleProfileError, null);
  assert.equal(staleProfile.length, 0);
  const { data: created, error: goalError } = await member
    .from('goals')
    .insert({
      id: goalId,
      person_id: memberPerson.id,
      title: 'Synthetic integration goal',
      domain: 'life',
      reason: 'Verify persistence',
      next_step: 'Run local tests',
      target_date: '2026-12-31',
    })
    .select('*')
    .single();
  assert.equal(goalError, null);
  assert.equal(created.version, 1);
  const { data: leaked, error: leakError } = await founder
    .from('goals')
    .select('*')
    .eq('id', goalId);
  assert.equal(leakError, null);
  assert.equal(leaked.length, 0);
  const { data: deniedWrite, error: deniedError } = await founder
    .from('goals')
    .update({ title: 'Forbidden' })
    .eq('id', goalId)
    .select('id');
  assert.equal(deniedError, null);
  assert.equal(deniedWrite.length, 0);
  const { error: forgedOwner } = await founder.from('goals').insert({
    person_id: memberPerson.id,
    title: 'Forbidden',
    domain: 'life',
    next_step: 'Forbidden',
  });
  assert.ok(forgedOwner);
  const { data: edited, error: editError } = await member
    .from('goals')
    .update({ next_step: 'Read the saved result' })
    .eq('id', goalId)
    .eq('version', 1)
    .select('*')
    .single();
  assert.equal(editError, null);
  assert.equal(edited.version, 2);
  const { data: staleGoal, error: staleError } = await member
    .from('goals')
    .update({ next_step: 'Stale' })
    .eq('id', goalId)
    .eq('version', 1)
    .select('id');
  assert.equal(staleError, null);
  assert.equal(staleGoal.length, 0);
  const { error: closeError } = await member
    .from('goals')
    .update({ status: 'completed' })
    .eq('id', goalId)
    .eq('version', 2);
  assert.equal(closeError, null);
  const { data: persisted, error: readError } = await member
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single();
  assert.equal(readError, null);
  assert.equal(persisted.status, 'completed');
  assert.ok(persisted.closed_at);
  const { data: events, error: eventsError } = await member
    .from('personal_events')
    .select('kind')
    .eq('goal_id', goalId);
  assert.equal(eventsError, null);
  assert.deepEqual(events.map((event) => event.kind).sort(), [
    'goal.completed',
    'goal.created',
    'goal.updated',
  ]);
  const { data: hiddenEvents, error: eventLeak } = await founder
    .from('personal_events')
    .select('*')
    .eq('goal_id', goalId);
  assert.equal(eventLeak, null);
  assert.equal(hiddenEvents.length, 0);
  console.log(
    'PASS: profile/goal persistence, optimistic concurrency, goal lifecycle, transactional events and two-user isolation',
  );
} finally {
  // Restore the synthetic member profile; preserve its test history.
  const { error: restoreError } = await member
    .from('persons')
    .update({ priority: memberPerson.priority, unit_system: memberPerson.unit_system })
    .eq('id', memberPerson.id);
  const { error: cleanupError } = await member
    .from('goals')
    .update({ status: 'archived' })
    .eq('id', goalId)
    .eq('status', 'active');
  assert.equal(restoreError, null);
  assert.equal(cleanupError, null);
}

// Aurelius SQL contract through actual Auth/PostgREST; no paid model request.
const aiConversation = crypto.randomUUID(),
  aiRequest = crypto.randomUUID(),
  aiMemory = crypto.randomUUID();
try {
  const { error: memoryError } = await member.rpc('ai_save_memory', {
    p_id: aiMemory,
    p_content: 'Synthetic preference: concise answers',
    p_kind: 'preference',
    p_version: 0,
  });
  assert.equal(memoryError, null);
  const { data: leakedMemories, error: memoryReadError } = await founder
    .from('ai_memories')
    .select('*')
    .eq('id', aiMemory);
  assert.equal(memoryReadError, null);
  assert.equal(leakedMemories.length, 0);
  const { error: startError } = await member.rpc('ai_begin_turn', {
    p_conversation: aiConversation,
    p_request: aiRequest,
    p_text: 'Synthetic persistence check',
    p_model: 'synthetic-no-model-call',
    p_context: true,
    p_prompt_version: 'integration-test',
  });
  assert.equal(startError, null);
  const { data: leakedTurns, error: turnReadError } = await founder
    .from('ai_turns')
    .select('*')
    .eq('id', aiRequest);
  assert.equal(turnReadError, null);
  assert.equal(leakedTurns.length, 0);
  const { data: deniedFinish, error: finishDenial } = await founder.rpc('ai_finish_turn', {
    p_request: aiRequest,
    p_text: 'Intruder',
    p_status: 'complete',
  });
  assert.equal(finishDenial, null);
  assert.equal(deniedFinish, false);
  const { data: finished, error: finishError } = await member.rpc('ai_finish_turn', {
    p_request: aiRequest,
    p_text: 'Synthetic stored reply, not model output.',
    p_status: 'complete',
    p_input: 0,
    p_output: 0,
  });
  assert.equal(finishError, null);
  assert.equal(finished, true);
  const { data: saved, error: savedError } = await member
    .from('ai_turns')
    .select('*')
    .eq('id', aiRequest)
    .single();
  assert.equal(savedError, null);
  assert.equal(saved.status, 'complete');
  const { error: deleteError } = await member
    .from('ai_conversations')
    .delete()
    .eq('id', aiConversation);
  assert.equal(deleteError, null);
  const { data: removed, error: removedError } = await member
    .from('ai_turns')
    .select('*')
    .eq('id', aiRequest);
  assert.equal(removedError, null);
  assert.equal(removed.length, 0);
  const { data: ledger, error: ledgerError } = await member
    .from('ai_usage')
    .select('id')
    .eq('id', aiRequest);
  assert.equal(ledgerError, null);
  assert.equal(ledger.length, 1);
  console.log(
    'PASS: Aurelius memory, turn lifecycle, two-user isolation, cascade deletion and durable usage ledger',
  );
} finally {
  await member.from('ai_conversations').delete().eq('id', aiConversation);
  await member.rpc('ai_delete_memory', { p_id: aiMemory, p_version: 1 });
}
