// Disposable local Supabase + standalone worker process. No model or hosted writes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, '127.0.0.1', 'Disposable loopback Supabase only');
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY, 'Worker control plane requires the local service role.');
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const owner = client();
const foreign = client();
for (const [c, email] of [
  [owner, 'member@aurelius.test'],
  [foreign, 'founder@aurelius.test'],
])
  assert.equal((await c.auth.signInWithPassword({ email, password: env.AURELIUS_FOUNDER_PASSWORD })).error, null);

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const files = [
  {
    path: 'preview.html',
    content: '<!doctype html><html lang="en"><title>Durable construct</title><h1>Before</h1></html>\n',
  },
  {
    path: 'check.mjs',
    content: "import { readFileSync } from 'node:fs';\nif (!readFileSync('preview.html','utf8').includes('<h1>After</h1>')) process.exit(1);\n",
  },
];
const tree = sha256(
  files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}:${sha256(file.content)}`)
    .join('\n'),
);
const project = crypto.randomUUID();
const request = crypto.randomUUID();
const content = {
  name: 'Synthetic Construct durable worker',
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
    ].map((key) => [key, key === 'vision' ? 'Synthetic durable worker isolation' : '']),
  ),
  sources: [],
  documents: [],
};
const after = files[0].content.replace('Before', 'After');
const scope = {
  project_id: project,
  project_revision: 1,
  source_id: request,
  repository: 'neilaureliuscollective/gent-ascend-collective-app',
  source_commit: null,
  source_tree_hash: tree,
  allowed_paths: ['preview.html', 'check.mjs'],
  protected_paths: ['.env'],
  intended_change: 'Durable worker smoke — labelled fixture files, not a model-generated feature.',
  acceptance_checks: [
    { name: 'syntax', command: 'node', args: ['--check', 'check.mjs'] },
    { name: 'heading', command: 'node', args: ['check.mjs'] },
  ],
  resource_limits: {
    timeout_ms: 30000,
    lease_ms: 45000,
    max_files: 32,
    max_file_bytes: 65536,
    max_output_bytes: 16384,
    max_diff_bytes: 32768,
  },
  patch: [{ path: 'preview.html', before: files[0].content, after }],
};

function runWorker(workerId) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', 'scripts/architect-construct-worker.mts'],
      {
        env: {
          ...process.env,
          ...env,
          ARCHITECT_ORIGIN_ENABLED: 'true',
          ARCHITECT_CONSTRUCT_ENABLED: 'true',
          ARCHITECT_CONSTRUCT_STORE: 'database',
          ARCHITECT_CONSTRUCT_WORKER_TOKEN: 'x'.repeat(32),
          ARCHITECT_CONSTRUCT_WORKER_ID: workerId,
          APP_ENV: 'local',
          NODE_ENV: 'development',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', reject);
  });
}

try {
  assert.equal(
    (
      await owner.rpc('architect_origin_save', {
        p_project: project,
        p_request: crypto.randomUUID(),
        p_expected: 0,
        p_content: content,
        p_note: 'Synthetic durable worker project',
      })
    ).data,
    1,
  );
  assert.equal(
    (
      await owner.rpc('architect_construct_import_source', {
        p_id: request,
        p_kind: 'fixture',
        p_repository: scope.repository,
        p_commit: null,
        p_label: 'Deterministic fixture source — labelled test tree, not an imported application snapshot.',
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
  assert.equal((await foreign.from('architect_construct_runs').select('id').eq('id', request)).data.length, 0);
  const first = await runWorker('durable-worker-a');
  assert.equal(first.code, 0, first.stderr || first.stdout);
  const tick = JSON.parse(first.stdout);
  assert.equal(tick.run, request);
  assert.equal(tick.status, 'succeeded');
  const reloaded = await owner.from('architect_construct_runs').select('*').eq('id', request).single();
  assert.equal(reloaded.error, null);
  assert.equal(reloaded.data.status, 'succeeded');
  assert.equal(reloaded.data.result.sandbox, false);
  assert.equal(reloaded.data.result.isolation, 'process-fixture');
  assert.ok(String(reloaded.data.result.preview.body).includes('<h1>After</h1>'));
  const events = await owner.from('architect_construct_events').select('kind').eq('run_id', request).order('seq');
  assert.ok(events.data.map((event) => event.kind).includes('finished'));
  const second = await runWorker('durable-worker-b');
  assert.equal(second.code, 0, second.stderr || second.stdout);
  assert.equal(JSON.parse(second.stdout).run, null);
  console.log(
    'PASS: Construct durable owner enqueue, standalone worker claim/execute, reload, second-worker idle, foreign denial. Labelled fixture, not a model-generated Aethelios feature.',
  );
} finally {
  await owner.auth.signOut();
  await foreign.auth.signOut();
}
