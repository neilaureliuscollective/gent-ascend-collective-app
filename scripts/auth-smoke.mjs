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

// Aethelios SQL contract through actual Auth/PostgREST; no paid model request.
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
    'PASS: Aethelios memory, turn lifecycle, two-user isolation, cascade deletion and durable usage ledger',
  );
} finally {
  await member.from('ai_conversations').delete().eq('id', aiConversation);
  await member.rpc('ai_delete_memory', { p_id: aiMemory, p_version: 1 });
}

// Daily dashboard through real Auth + PostgREST, including the embedded action relationship.
const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: memberPerson.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date());
const part = (type) => dateParts.find((p) => p.type === type).value;
const dailyDate = `${part('year')}-${part('month')}-${part('day')}`;
const { data: priorDay, error: priorError } = await member
  .from('daily_entries')
  .select('version')
  .eq('day', dailyDate)
  .maybeSingle();
assert.equal(priorError, null);
const dayInput = {
  p_day: dailyDate,
  p_version: priorDay?.version ?? 0,
  p_energy: 3,
  p_sleep: 450,
  p_intention: 'Synthetic daily integration check',
  p_reflection: '',
  p_actions: [{ id: crypto.randomUUID(), title: 'Read the saved day', done: false }],
};
const { data: dayVersion, error: dayError } = await member.rpc('daily_save', dayInput);
assert.equal(dayError, null);
assert.equal(dayVersion, dayInput.p_version + 1);
const { data: savedDay, error: dayReadError } = await member
  .from('daily_entries')
  .select('version,energy,actions:daily_actions(id,title,done,position)')
  .eq('day', dailyDate)
  .single();
assert.equal(dayReadError, null);
assert.equal(savedDay.energy, 3);
assert.equal(savedDay.actions[0].title, 'Read the saved day');
assert.equal(savedDay.version, dayVersion);
const { error: staleDay } = await member.rpc('daily_save', dayInput);
assert.equal(staleDay.code, '40001');
for (const table of ['daily_entries', 'daily_actions']) {
  const { data: hidden, error: hiddenError } = await founder
    .from(table)
    .select('*')
    .eq('person_id', memberPerson.id);
  assert.equal(hiddenError, null);
  assert.equal(hidden.length, 0);
  const { error: anonymousRead } = await anon.from(table).select('*');
  assert.ok(anonymousRead);
}
const { error: directDayWrite } = await member
  .from('daily_entries')
  .update({ energy: 5 })
  .eq('person_id', memberPerson.id);
assert.ok(directDayWrite);
const { error: anonymousDayWrite } = await anon.rpc('daily_save', dayInput);
assert.ok(anonymousDayWrite);
console.log(
  'PASS: daily save, embedded action read, optimistic conflict, anonymous/direct-write denial and two-user isolation',
);

// Performance slice: use real Auth/PostgREST and the caller's JWT, never service credentials.
const performanceProfile = { goal:'strength',experience:'returning',daysPerWeek:3,minutes:40,equipment:'gym',limitations:'',unit:'lb' };
const performanceRequest = crypto.randomUUID();
const performanceArgs = {p_kind:'profile',p_request:performanceRequest,p_expected:0,p_payload:performanceProfile};
const perfSaved = await founder.rpc('performance_save',performanceArgs);
assert.equal(perfSaved.error,null);assert.equal(perfSaved.data,1);
const perfReplay=await founder.rpc('performance_save',performanceArgs);
assert.equal(perfReplay.error,null);assert.equal(perfReplay.data,1);
const perfOwn=await founder.from('performance_profiles').select('*');assert.equal(perfOwn.error,null);assert.equal(perfOwn.data.length,1);
const perfOther=await member.from('performance_profiles').select('*');assert.equal(perfOther.error,null);assert.equal(perfOther.data.length,0);
const perfAnonymous=await anon.rpc('performance_save',performanceArgs);assert.ok(perfAnonymous.error);
console.log('PASS: Performance real Auth/RPC profile save, receipt replay, and two-user isolation');

const cycleSlotA=crypto.randomUUID(),cycleSlotB=crypto.randomUUID();
const cyclePlan={title:'Synthetic session A',unit:'lb',exercises:[{id:crypto.randomUUID(),name:'Synthetic row',sets:3,reps:8,load:40,restSeconds:90}]};
const cycle={title:'Synthetic training cycle',sessions:[{id:cycleSlotA,plan:cyclePlan},{id:cycleSlotB,plan:{...cyclePlan,title:'Synthetic session B'}}]};
const cycleArgs={p_kind:'program',p_request:crypto.randomUUID(),p_expected:0,p_payload:cycle};
const cycleSaved=await founder.rpc('performance_save',cycleArgs);assert.equal(cycleSaved.error,null);assert.equal(cycleSaved.data,1);
const cycleReplay=await founder.rpc('performance_save',cycleArgs);assert.equal(cycleReplay.error,null);assert.equal(cycleReplay.data,1);
const adjusted={...cyclePlan,exercises:cyclePlan.exercises.map(e=>({...e,sets:2}))};
const cycleSession={id:crypto.randomUUID(),title:cyclePlan.title,unit:'lb',planVersion:1,startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),status:'complete',pain:false,note:'Synthetic test',prescription:{ruleVersion:1,programVersion:1,slotId:cycleSlotA,mode:'lighter',timeBudget:40,originalPlan:cyclePlan,plan:adjusted},sets:Array.from({length:2},()=>({id:crypto.randomUUID(),exerciseId:cyclePlan.exercises[0].id,exercise:'Synthetic row',targetReps:8,targetLoad:40,reps:8,load:40,effort:7,done:true}))};
const cycleSessionArgs={p_kind:'session',p_request:crypto.randomUUID(),p_expected:0,p_payload:cycleSession};
const cycleFinished=await founder.rpc('performance_save',cycleSessionArgs);assert.equal(cycleFinished.error,null);assert.equal(cycleFinished.data,1);
const cycleFinishedReplay=await founder.rpc('performance_save',cycleSessionArgs);assert.equal(cycleFinishedReplay.error,null);assert.equal(cycleFinishedReplay.data,1);
const cyclePointer=await founder.from('performance_programs').select('next_slot_id');assert.equal(cyclePointer.error,null);assert.equal(cyclePointer.data[0].next_slot_id,cycleSlotB);
const cycleContext=await founder.from('performance_session_context').select('prescription');assert.equal(cycleContext.error,null);assert.equal(cycleContext.data[0].prescription.mode,'lighter');
for(const table of ['performance_programs','performance_program_revisions','performance_session_context']) {const hidden=await member.from(table).select('*');assert.equal(hidden.error,null);assert.equal(hidden.data.length,0);}
const foreignDecision=await member.rpc('performance_save',{...cycleSessionArgs,p_request:crypto.randomUUID(),p_payload:{...cycleSession,id:crypto.randomUUID()}});assert.ok(foreignDecision.error);
console.log('PASS: Performance program, accepted decision, atomic cycle advance, replay and two-user isolation');

// Phase 3 uses real Auth + PostgREST for evidence, approval and replay.
const progressionCheck={day:new Date().toISOString().slice(0,10),sleepMinutes:450,energy:4,soreness:'none',weight:null,unit:'lb',calories:null,protein:null,waterMl:null,nutritionComplete:false};
const progressionChecked=await founder.rpc('performance_save',{p_kind:'checkin',p_request:crypto.randomUUID(),p_expected:0,p_payload:progressionCheck});assert.equal(progressionChecked.error,null);
for(const daysAgo of [4,2]) {
 const p=cycle.sessions[1].plan;
 const session={...cycleSession,id:crypto.randomUUID(),title:p.title,startedAt:new Date(Date.now()-daysAgo*86400000-3600000).toISOString(),endedAt:new Date(Date.now()-daysAgo*86400000).toISOString(),prescription:{ruleVersion:1,programVersion:1,slotId:cycleSlotB,mode:'planned',timeBudget:40,originalPlan:p,plan:p},sets:Array.from({length:3},()=>({...cycleSession.sets[0],id:crypto.randomUUID()}))};
 const saved=await founder.rpc('performance_save',{p_kind:'session',p_request:crypto.randomUUID(),p_expected:0,p_payload:session});assert.equal(saved.error,null);
}
const progressRead=await founder.rpc('performance_progression',{});assert.equal(progressRead.error,null);
const candidate=progressRead.data.find(r=>r.slotId===cycleSlotB);assert.equal(candidate.status,'ready');
const progressArgs={p_request:crypto.randomUUID(),p_expected:1,p_slot:cycleSlotB,p_token:candidate.proposal.token};
assert.ok((await member.rpc('performance_progression_accept',progressArgs)).error);
const approved=await founder.rpc('performance_progression_accept',progressArgs);assert.equal(approved.error,null);assert.equal(approved.data,2);
const approvedReplay=await founder.rpc('performance_progression_accept',progressArgs);assert.equal(approvedReplay.error,null);assert.equal(approvedReplay.data,2);
const progressAudit=await founder.from('performance_progression_decisions').select('*');assert.equal(progressAudit.error,null);assert.equal(progressAudit.data.length,1);
const hiddenAudit=await member.from('performance_progression_decisions').select('*');assert.equal(hiddenAudit.error,null);assert.equal(hiddenAudit.data.length,0);
assert.ok((await anon.rpc('performance_progression',{})).error);
assert.ok((await founder.rpc('performance_progression_accept',{...progressArgs,p_request:crypto.randomUUID()})).error);
console.log('PASS: Performance progression evidence, atomic approval, replay and owner isolation through real Auth/PostgREST');

// Phase 4 reads source records through the session-bound, RLS invoker RPC.
const outcomeEmpty=await founder.rpc('performance_outcomes',{});assert.equal(outcomeEmpty.error,null);assert.equal(outcomeEmpty.data.length,1);assert.deepEqual(outcomeEmpty.data[0].sessions,[]);
const postPlan=structuredClone(cycle.sessions[1].plan);postPlan.exercises[0].reps=9;
const postSession={...cycleSession,id:crypto.randomUUID(),title:postPlan.title,planVersion:2,startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),prescription:{ruleVersion:1,programVersion:2,slotId:cycleSlotB,mode:'planned',timeBudget:40,originalPlan:postPlan,plan:postPlan},sets:Array.from({length:3},()=>({...cycleSession.sets[0],id:crypto.randomUUID(),targetReps:9,reps:9,effort:null}))};
const outcomeSaved=await founder.rpc('performance_save',{p_kind:'session',p_request:crypto.randomUUID(),p_expected:0,p_payload:postSession});assert.equal(outcomeSaved.error,null);
const outcomeRead=await founder.rpc('performance_outcomes',{});assert.equal(outcomeRead.error,null);assert.equal(outcomeRead.data[0].sessions[0].id,postSession.id);assert.equal(outcomeRead.data[0].sessions[0].sets[0].effort,null);assert.equal(outcomeRead.data[0].approvedPlan.exercises[0].reps,9);
const hiddenOutcomes=await member.rpc('performance_outcomes',{});assert.equal(hiddenOutcomes.error,null);assert.deepEqual(hiddenOutcomes.data,[]);
assert.ok((await anon.rpc('performance_outcomes',{})).error);
console.log('PASS: Performance outcome lineage, recorded sets and owner isolation through real Auth/PostgREST');

// Phase 5: independently versioned owner references, replay, RLS and preserved recovery.
const fuelArgs={p_request:crypto.randomUUID(),p_expected:0,p_targets:{calories:2400,protein:150,waterMl:2500,goalWeight:80,unit:'kg'}};
for(let i=0;i<2;i++){const result=await founder.rpc('performance_save_fuel_targets',fuelArgs);assert.equal(result.error,null);assert.equal(result.data,1);}
for(const table of ['performance_fuel_targets','performance_fuel_target_revisions']){
 const own=await founder.from(table).select('*');assert.equal(own.error,null);assert.equal(own.data.length,1);
 const other=await member.from(table).select('*');assert.equal(other.error,null);assert.equal(other.data.length,0);
 assert.ok((await founder.from(table).delete().eq('person_id',own.data[0].person_id)).error);
}
assert.ok((await anon.rpc('performance_save_fuel_targets',fuelArgs)).error);
assert.ok((await founder.rpc('performance_save_fuel_targets',{...fuelArgs,p_request:crypto.randomUUID()})).error);
assert.ok((await founder.rpc('performance_save_fuel_targets',{...fuelArgs,p_targets:{...fuelArgs.p_targets,protein:160}})).error);
const fuelDay={...progressionCheck,weight:180,calories:2300,protein:145,waterMl:2500,nutritionComplete:true};
const fuelDaySaved=await founder.rpc('performance_save',{p_kind:'checkin',p_request:crypto.randomUUID(),p_expected:1,p_payload:fuelDay});assert.equal(fuelDaySaved.error,null);
const fuelDayRead=await founder.from('performance_checkins').select('*').eq('day',fuelDay.day);assert.equal(fuelDayRead.error,null);assert.equal(fuelDayRead.data[0].sleep_minutes,450);assert.equal(fuelDayRead.data[0].calories,2300);
console.log('PASS: Fuel targets, replay, stale denial, owner isolation and daily recovery preservation through real Auth/PostgREST');

// Phase 6 owner routines use caller JWTs and the owner's local date.
const recoveryOwn=await founder.from('persons').select('timezone').single();assert.equal(recoveryOwn.error,null);
const recoveryDay=new Intl.DateTimeFormat('en-CA',{timeZone:recoveryOwn.data.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const recoveryArgs={p_request:crypto.randomUUID(),p_expected:0,p_routine:{day:recoveryDay,action:'quiet-time',minutes:15,cue:'After my shift',outcome:null}};
for(let i=0;i<2;i++){const result=await founder.rpc('performance_save_recovery_routine',recoveryArgs);assert.equal(result.error,null);assert.equal(result.data,1);}
for(const table of ['performance_recovery_routines','performance_recovery_revisions']){
 const own=await founder.from(table).select('*');assert.equal(own.error,null);assert.equal(own.data.length,1);
 const other=await member.from(table).select('*');assert.equal(other.error,null);assert.equal(other.data.length,0);
 assert.ok((await founder.from(table).delete().eq('person_id',own.data[0].person_id)).error);
}
assert.ok((await anon.rpc('performance_save_recovery_routine',recoveryArgs)).error);
assert.ok((await founder.rpc('performance_save_recovery_routine',{...recoveryArgs,p_request:crypto.randomUUID()})).error);
assert.ok((await founder.rpc('performance_save_recovery_routine',{...recoveryArgs,p_expected:1,p_request:crypto.randomUUID(),p_routine:{...recoveryArgs.p_routine,outcome:'done'}})).error);
console.log('PASS: Recovery routine save/replay, owner-local date, stale denial, premature outcome denial and owner isolation through real Auth/PostgREST');
