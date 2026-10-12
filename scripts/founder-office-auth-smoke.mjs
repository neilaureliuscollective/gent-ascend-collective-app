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
  'Local synthetic acceptance only',
);
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const founder = client(),
  member = client(),
  anon = client();
async function signIn(c, email) {
  const result = await c.auth.signInWithPassword({
    email,
    password: env.AURELIUS_FOUNDER_PASSWORD,
  });
  assert.equal(result.error, null);
}
await signIn(founder, 'founder@aurelius.test');
await signIn(member, 'member@aurelius.test');
const person = await founder.from('persons').select('id').single();
assert.equal(person.error, null);
const access = await founder.from('founder_access').select('person_id');
assert.equal(access.error, null);
assert.deepEqual(access.data, [{ person_id: person.data.id }]);
assert.deepEqual((await member.from('founder_access').select('person_id')).data, []);
assert.ok(
  (
    await member
      .from('founder_access')
      .insert({ person_id: person.data.id, grant_reason: 'Forbidden escalation' })
  ).error,
);
assert.ok((await anon.from('founder_access').select('person_id')).error);
const companyId = crypto.randomUUID(),
  jobId = crypto.randomUUID(),
  conversationId = crypto.randomUUID();
const created = await founder
  .from('companies')
  .insert({
    id: companyId,
    person_id: person.data.id,
    name: 'Synthetic Founder Office Company',
    brief: 'Synthetic acceptance source. Never production data.',
  });
assert.equal(created.error, null);
const scope = {
  request: 'Verify persistent founder work',
  audience: 'Founder',
  outcome: 'A saved synthetic deliverable',
  constraints: 'Assigned Coworker: mara. Synthetic acceptance only.',
  acceptance: 'Survives sign out and sign in',
  evidence: [],
  figures: [],
};
const job = { p_id: jobId, p_company: companyId, p_conversation: conversationId, p_scope: scope };
assert.equal((await founder.rpc('company_create_job', job)).error, null);
assert.equal((await founder.rpc('company_create_job', job)).data, jobId);
const taskId = crypto.randomUUID(),
  proposalId = crypto.randomUUID();
const content = {
  title: 'Synthetic founder deliverable',
  summary: 'Manually confirmed acceptance work; no model execution.',
  positioning: 'Synthetic source only',
  offer: 'No commercial offer',
  actions: ['Review the synthetic result'],
  gaps: [],
  slides: [
    {
      title: 'Synthetic result',
      body: 'Saved through real local PostgREST.',
      bullets: [],
      figureIds: [],
      notes: '',
    },
  ],
  taskPlan: [
    {
      id: taskId,
      title: 'Review evidence',
      objective: 'Verify this synthetic acceptance result',
      assignee: 'mara',
      status: 'completed',
      dependsOn: [],
    },
  ],
  approvalRequests: [
    {
      id: proposalId,
      title: 'Publish synthetic proposal',
      proposal: 'Synthetic decision only. No publishing is executed.',
      kind: 'publishing',
      status: 'pending',
      figureIds: [],
    },
  ],
};
const versionId = crypto.randomUUID();
const write = {
  p_id: versionId,
  p_company: companyId,
  p_job: jobId,
  p_expected: 0,
  p_content: content,
  p_source_turn: null,
};
assert.equal((await founder.rpc('company_save_work', write)).error, null);
assert.equal((await founder.rpc('company_save_work', write)).data, versionId);
assert.ok((await member.rpc('company_save_work', write)).error);
assert.deepEqual(
  (await member.from('company_work_versions').select('id').eq('job_id', jobId)).data,
  [],
);
const decisionId = crypto.randomUUID();
const approved = {
  ...content,
  approvalRequests: [{ ...content.approvalRequests[0], status: 'approved' }],
};
const decision = { ...write, p_id: decisionId, p_expected: 1, p_content: approved };
assert.equal((await founder.rpc('company_save_work', decision)).error, null);
assert.equal((await founder.rpc('company_save_work', decision)).data, decisionId);
assert.ok((await founder.rpc('company_save_work', { ...write, p_id: crypto.randomUUID() })).error);
await founder.auth.signOut();
await signIn(founder, 'founder@aurelius.test');
const resumed = await founder
  .from('company_work_versions')
  .select('*')
  .eq('job_id', jobId)
  .order('revision', { ascending: false });
assert.equal(resumed.error, null);
assert.equal(resumed.data.length, 2);
assert.deepEqual(resumed.data[0].content, approved);
assert.deepEqual(resumed.data[1].content, content);
assert.equal(
  (await founder.from('company_jobs').select('revision').eq('id', jobId).single()).data.revision,
  2,
);
assert.ok((await anon.from('company_jobs').select('id')).error);
console.log(
  'PASS: real local founder grant, owner-bound company mission, immutable task/approval versions, exact replay, stale/cross-owner/anonymous denial and sign-out/sign-in persistence. No live model or external execution.',
);
