// Disposable local Supabase only. Real Auth/PostgREST for Construct RPCs, no model or hosted writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const owner = client(),
  foreign = client(),
  anon = client();
for (const [c, email] of [
  [owner, 'member@aurelius.test'],
  [foreign, 'founder@aurelius.test'],
])
  assert.equal(
    (await c.auth.signInWithPassword({ email, password: env.AURELIUS_FOUNDER_PASSWORD })).error,
    null,
  );

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const files = [
  {
    path: 'preview.html',
    content: '<!doctype html><html lang="en"><title>Construct auth</title><h1>Before</h1></html>\n',
  },
];
const tree = sha256(files.map((file) => `${file.path}:${sha256(file.content)}`).join('\n'));
const project = crypto.randomUUID();
const request = crypto.randomUUID();
const content = {
  name: 'Synthetic Construct Auth project',
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
    ].map((key) => [key, key === 'vision' ? 'Synthetic construct isolation' : '']),
  ),
  sources: [],
  documents: [],
};
const scope = {
  project_id: project,
  project_revision: 1,
  source_id: request,
  repository: 'neilaureliuscollective/gent-ascend-collective-app',
  source_commit: null,
  source_tree_hash: tree,
  allowed_paths: ['preview.html'],
  protected_paths: ['.env'],
  intended_change: 'Auth isolation smoke — not a model-generated feature.',
  acceptance_checks: [{ name: 'noop', command: 'true', args: [] }],
  resource_limits: {
    timeout_ms: 30000,
    lease_ms: 45000,
    max_files: 32,
    max_file_bytes: 65536,
    max_output_bytes: 16384,
    max_diff_bytes: 32768,
  },
  patch: [{ path: 'preview.html', before: files[0].content, after: files[0].content.replace('Before', 'After') }],
};

try {
  assert.equal(
    (
      await owner.rpc('architect_origin_save', {
        p_project: project,
        p_request: crypto.randomUUID(),
        p_expected: 0,
        p_content: content,
        p_note: 'Synthetic Construct Auth project',
      })
    ).data,
    1,
  );
  assert.ok(
    (
      await owner.rpc('architect_construct_import_source', {
        p_id: crypto.randomUUID(),
        p_kind: 'fixture',
        p_repository: scope.repository,
        p_commit: null,
        p_label: 'Owner-chosen fixture must not be a durable import.',
        p_tree: tree,
        p_files: files,
      })
    ).error,
    'Owner-supplied kind=fixture must be rejected.',
  );
  assert.equal(
    (
      await owner.rpc('architect_construct_import_source', {
        p_id: request,
        p_kind: 'imported',
        p_repository: scope.repository,
        p_commit: null,
        p_label: 'Imported source snapshot of neilaureliuscollective/gent-ascend-collective-app — exact attached files, not live repository knowledge.',
        p_tree: tree,
        p_files: files,
      })
    ).data,
    true,
  );
  assert.equal(
    (
      await owner.rpc('architect_construct_approve_brief', {
        p_id: request,
        p_project: project,
        p_expected: 1,
        p_source: request,
        p_hash: sha256(JSON.stringify(scope)),
        p_scope: scope,
      })
    ).data,
    true,
  );
  assert.equal(
    (
      await owner.rpc('architect_construct_start', {
        p_project: project,
        p_request: request,
        p_brief: request,
        p_expected: 1,
      })
    ).data,
    true,
  );
  assert.equal(
    (
      await owner.rpc('architect_construct_start', {
        p_project: project,
        p_request: request,
        p_brief: request,
        p_expected: 1,
      })
    ).data,
    true,
  );
  assert.equal(
    (await owner.from('architect_construct_runs').select('id').eq('id', request)).data.length,
    1,
  );
  assert.equal(
    (await foreign.from('architect_construct_runs').select('id').eq('id', request)).data.length,
    0,
  );
  assert.ok(
    (await foreign.rpc('architect_construct_cancel', { p_project: project, p_run: request })).error,
  );
  assert.ok((await anon.from('architect_construct_runs').select('id')).error);
  assert.ok((await owner.rpc('architect_construct_claim', { p_worker: 'browser', p_lease: 45000 })).error);
  assert.equal(
    (await owner.rpc('architect_construct_cancel', { p_project: project, p_run: request })).data,
    true,
  );
  console.log(
    'PASS: Construct actual local Auth/PostgREST owner start/idempotent replay, foreign/anonymous denial, worker-claim denial and owner cancel. No provider evaluation or sandbox claim.',
  );
} finally {
  await owner.auth.signOut();
  await foreign.auth.signOut();
}
