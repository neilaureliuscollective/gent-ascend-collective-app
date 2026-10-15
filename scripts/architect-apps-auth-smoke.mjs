// Disposable local Auth/PostgREST only. Proves owner-scoped Apps mutations and fencing.
// Isolated Docker publish is recorded when the pinned image is present; otherwise it stays unrun.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { localSupabaseControlPlane } from './local-supabase-control-plane.mjs';

const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, '127.0.0.1', 'Disposable loopback Supabase only');
const plane = localSupabaseControlPlane();
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const owner = client();
const foreign = client();
for (const [session, email] of [
  [owner, 'founder@aurelius.test'],
  [foreign, 'member@aurelius.test'],
])
  assert.equal((await session.auth.signInWithPassword({ email, password: env.AURELIUS_FOUNDER_PASSWORD })).error, null);
const worker = createClient(plane.url, plane.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const policy = await worker.rpc('architect_apps_set_execution_policy', { p_enabled: true });
assert.equal(policy.error, null, policy.error?.message);
assert.equal(policy.data, true);

const ownerAuth = (await owner.auth.getUser()).data.user?.id;
const foreignAuth = (await foreign.auth.getUser()).data.user?.id;
assert.ok(ownerAuth && foreignAuth && ownerAuth !== foreignAuth);

const project = crypto.randomUUID();
const revision = crypto.randomUUID();
const content = {
  name: 'Synthetic Apps Auth journey',
  description: 'No real customer or private records.',
  discipline: 'application',
  status: 'active',
  blueprint: Object.fromEntries(
    [
      'vision',
      'opportunity',
      'audience',
      'requirements',
      'research',
      'solution',
      'architecture',
      'decisions',
      'risks',
      'milestones',
      'deliverables',
      'state',
      'next',
    ].map((key) => [key, key === 'vision' ? 'Keep synthetic field notes.' : '']),
  ),
  sources: [],
  documents: [],
};
assert.equal(
  (
    await owner.rpc('architect_origin_save', {
      p_project: project,
      p_request: crypto.randomUUID(),
      p_expected: 0,
      p_content: content,
      p_note: 'Synthetic Apps Auth acceptance',
    })
  ).data,
  1,
);
assert.equal((await foreign.from('architect_origin_projects').select('id').eq('id', project)).data.length, 0);
const ordinaryProject = crypto.randomUUID();
assert.equal(
  (
    await foreign.rpc('architect_origin_save', {
      p_project: ordinaryProject,
      p_request: crypto.randomUUID(),
      p_expected: 0,
      p_content: { ...content, name: 'Ordinary owner Apps project' },
      p_note: 'Ordinary owner cannot execute',
    })
  ).data,
  1,
);
const ordinaryDenied = await foreign.rpc('architect_apps_approve', {
  p_request: crypto.randomUUID(),
  p_project: ordinaryProject,
  p_name: 'Field notes',
  p_parent: null,
  p_tree: 'b'.repeat(64),
  p_hash: 'a'.repeat(64),
  p_files: [{ path: 'src/App.tsx', content: 'export function App() { return null; }' }],
  p_collections: [
    {
      name: 'notes',
      fields: [{ name: 'title', type: 'string', required: true, max: 80 }],
    },
  ],
  p_behaviors: {
    navigation: true,
    forms: true,
    validation: true,
    filtering: true,
    calculations: true,
    persistence: true,
  },
  p_generation: { mode: 'mock', notes: 'Labelled mocked provider. Not a paid OpenAI call.' },
});
assert.match(ordinaryDenied.error?.message ?? '', /founder pilot|not enabled for this account|executable work stays off/i);

const budgetRun = crypto.randomUUID();
const concurrent = await Promise.all(
  [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()].map((requestId) =>
    owner.rpc('architect_apps_reserve_generation', {
      p_request: requestId,
      p_run: budgetRun,
      p_input: 16000,
      p_output: 4000,
      p_model: 'gpt-6-astra',
    }),
  ),
);
const createdReserves = concurrent.filter((row) => row.data?.created === true);
const refusedReserves = concurrent.filter((row) => row.error);
assert.equal(createdReserves.length, 2);
assert.ok(refusedReserves.length >= 1);
assert.match(refusedReserves[0]?.error?.message ?? '', /two model calls|reserved allowance/i);
const replayReserve = await owner.rpc('architect_apps_reserve_generation', {
  p_request: createdReserves[0]?.data?.request_id ?? createdReserves[0]?.data?.requestId,
  p_run: budgetRun,
  p_input: 16000,
  p_output: 4000,
  p_model: 'gpt-6-astra',
});
assert.equal(replayReserve.data?.created, false);

const files = [{ path: 'src/App.tsx', content: 'export function App() { return null; }' }];
const collections = [
  {
    name: 'notes',
    fields: [
      { name: 'title', type: 'string', required: true, max: 80 },
      { name: 'body', type: 'string', required: false, max: 800 },
      { name: 'hours', type: 'number', required: true },
    ],
  },
];
const behaviors = {
  navigation: true,
  forms: true,
  validation: true,
  filtering: true,
  calculations: true,
  persistence: true,
};
const generation = { mode: 'mock', notes: 'Labelled mocked provider. Not a paid OpenAI call.' };
const hash = 'a'.repeat(64);
const tree = 'b'.repeat(64);

assert.equal(
  (
    await owner.rpc('architect_apps_approve', {
      p_request: revision,
      p_project: project,
      p_name: 'Field notes',
      p_parent: null,
      p_tree: tree,
      p_hash: hash,
      p_files: files,
      p_collections: collections,
      p_behaviors: behaviors,
      p_generation: generation,
    })
  ).data,
  revision,
);
assert.equal(
  (
    await owner.rpc('architect_apps_start', {
      p_request: revision,
      p_project: project,
      p_revision: revision,
      p_hash: hash,
    })
  ).data,
  revision,
);
assert.equal((await foreign.from('architect_apps').select('id').eq('project_id', project)).data.length, 0);
assert.equal((await foreign.from('architect_app_revisions').select('id').eq('id', revision)).data.length, 0);

const claimed = await worker.rpc('architect_apps_claim', { p_worker: 'apps-auth-smoke', p_lease: 120000 });
assert.equal(claimed.error, null, claimed.error?.message);
assert.equal(claimed.data, revision);
const token = (await worker.from('architect_app_jobs').select('lease_token').eq('id', revision).maybeSingle()).data
  ?.lease_token;
assert.match(String(token), /^[0-9a-f-]{36}$/i);
assert.equal(
  (await worker.rpc('architect_apps_mark_running', { p_worker: 'apps-auth-smoke', p_job: revision, p_token: token })).data,
  true,
);

const image = process.env.ARCHITECT_APPS_IMAGE || 'aethelios-architect-apps:2026-10-15.1';
const inspect = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', image], { encoding: 'utf8' });
const imageId = inspect.status === 0 ? inspect.stdout.trim() || null : null;
assert.equal(
  (
    await worker.rpc('architect_apps_finish', {
      p_worker: 'apps-auth-smoke',
      p_job: revision,
      p_token: token,
      p_status: 'failed',
      p_result: {
        ok: false,
        isolation: 'unavailable',
        sandbox: false,
        typecheck: { ok: false, log: '' },
        bundle: { ok: false, log: '' },
        blocker: imageId
          ? 'Auth smoke does not publish a placeholder artifact. Isolated compile is the required apps-isolate job.'
          : 'Pinned Architect Apps image is not present. Isolated success stays unrun.',
        stages: [],
      },
    })
  ).data,
  true,
);
const isolation = 'unavailable';
const sandbox = false;

const createKey = 'create-1';
const editAKey = 'edit-a';
const editBKey = 'edit-b';
const created = await owner.rpc('architect_apps_write_record', {
  p_project: project,
  p_app: project,
  p_collection: 'notes',
  p_payload: { title: 'Site visit', body: 'North wall', hours: 2 },
  p_key: createKey,
  p_id: null,
  p_expected: null,
});
assert.equal(created.error, null, created.error?.message);
const replay = await owner.rpc('architect_apps_write_record', {
  p_project: project,
  p_app: project,
  p_collection: 'notes',
  p_payload: { title: 'Site visit', body: 'North wall', hours: 2 },
  p_key: createKey,
  p_id: created.data,
  p_expected: null,
});
assert.equal(replay.data, created.data);
const changed = await owner.rpc('architect_apps_write_record', {
  p_project: project,
  p_app: project,
  p_collection: 'notes',
  p_payload: { title: 'Changed', body: 'North wall', hours: 2 },
  p_key: createKey,
  p_id: created.data,
  p_expected: null,
});
assert.match(changed.error?.message ?? '', /different record|mutation identity/i);
const editA = await owner.rpc('architect_apps_write_record', {
  p_project: project,
  p_app: project,
  p_collection: 'notes',
  p_payload: { title: 'Site visit edited', body: 'North wall', hours: 3 },
  p_key: editAKey,
  p_id: created.data,
  p_expected: 1,
});
assert.equal(editA.data, created.data);
const lostAck = await owner.rpc('architect_apps_write_record', {
  p_project: project,
  p_app: project,
  p_collection: 'notes',
  p_payload: { title: 'Site visit edited', body: 'North wall', hours: 3 },
  p_key: editAKey,
  p_id: created.data,
  p_expected: 1,
});
assert.equal(lostAck.data, created.data);
const editB = await owner.rpc('architect_apps_write_record', {
  p_project: project,
  p_app: project,
  p_collection: 'notes',
  p_payload: { title: 'Site visit B', body: 'North wall', hours: 4 },
  p_key: editBKey,
  p_id: created.data,
  p_expected: 2,
});
assert.equal(editB.data, created.data);
const stale = await owner.rpc('architect_apps_write_record', {
  p_project: project,
  p_app: project,
  p_collection: 'notes',
  p_payload: { title: 'Stale', body: 'North wall', hours: 5 },
  p_key: 'edit-stale',
  p_id: created.data,
  p_expected: 2,
});
assert.match(stale.error?.message ?? '', /Record changed/i);
assert.equal(
  (
    await worker.rpc('architect_apps_save_artifact', {
      p_worker: 'apps-auth-smoke',
      p_job: revision,
      p_token: token,
      p_revision: revision,
      p_manifest: 'c'.repeat(64),
      p_files: [{ path: 'index.html', content: '<p>stale</p>' }],
    })
  ).data,
  false,
);
const cancelledJob = crypto.randomUUID();
assert.equal(
  (
    await owner.rpc('architect_apps_start', {
      p_request: cancelledJob,
      p_project: project,
      p_revision: revision,
      p_hash: hash,
    })
  ).error,
  null,
);
assert.equal((await owner.rpc('architect_apps_cancel', { p_project: project, p_job: cancelledJob })).error, null);
assert.equal(
  (await owner.from('architect_app_jobs').select('status').eq('id', cancelledJob).maybeSingle()).data?.status,
  'cancelled',
);
assert.equal((await foreign.from('architect_app_records').select('id').eq('id', created.data)).data.length, 0);
assert.ok(
  (
    await foreign.rpc('architect_apps_write_record', {
      p_project: project,
      p_app: project,
      p_collection: 'notes',
      p_payload: { title: 'Foreign', hours: 1 },
      p_key: 'foreign',
      p_id: created.data,
      p_expected: 3,
    })
  ).error,
);

const restarted = client();
assert.equal(
  (await restarted.auth.signInWithPassword({ email: 'founder@aurelius.test', password: env.AURELIUS_FOUNDER_PASSWORD }))
    .error,
  null,
);
const persisted = await restarted
  .from('architect_app_records')
  .select('payload,version')
  .eq('id', created.data)
  .maybeSingle();
assert.equal(persisted.data?.payload?.title, 'Site visit B');
assert.equal(persisted.data?.version, 3);

const appRow = (await restarted.from('architect_apps').select('person_id').eq('project_id', project).maybeSingle()).data;
assert.ok(appRow?.person_id && appRow.person_id !== ownerAuth);
const receipt = {
  schema: 'architect-apps-auth-smoke/v1',
  ownerPerson: appRow.person_id,
  ownerAuth,
  foreignAuth,
  project,
  revision,
  isolation,
  sandbox,
  image,
  imageId,
  record: created.data,
  title: persisted.data?.payload?.title,
  version: persisted.data?.version,
  note: imageId
    ? 'Local Auth/PostgREST with architect_apps_execution_policy enabled. Founder owner passed; ordinary owner approve was denied. This is not production authorization or paid-model proof. Isolated compile is required in the apps-isolate job, not this smoke.'
    : 'Local Auth/PostgREST with architect_apps_execution_policy enabled. Founder owner passed; ordinary owner approve was denied. This is not production authorization or paid-model proof. Isolated Docker publish stayed unrun because the pinned image is absent.',
};
mkdirSync('docs/evidence/architect-apps', { recursive: true });
mkdirSync('test-results', { recursive: true });
writeFileSync('docs/evidence/architect-apps/auth-smoke.json', JSON.stringify(receipt, null, 2));
writeFileSync('test-results/architect-apps-auth-smoke.json', JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ ok: true, ...receipt }));
