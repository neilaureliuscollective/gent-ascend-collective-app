// Disposable local Supabase + standalone worker process. No model or hosted writes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined, 'dev-setup must not copy the service role into the env file.');
const plane = localSupabaseControlPlane();
assert.equal(new URL(plane.url).hostname, '127.0.0.1');
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
    path: 'README.md',
    content:
      '# Architect construct fixture\n\nDeterministic labelled source for execution mechanics. This is not a model-generated Aethelios change.\n',
  },
  {
    path: 'preview.html',
    content: '<!doctype html><html lang="en"><title>Durable construct</title><h1>Before</h1></html>\n',
  },
  {
    path: 'check.mjs',
    content:
      "import { readFileSync } from 'node:fs';\nif (!readFileSync('preview.html','utf8').includes('<h1>After</h1>')) process.exit(1);\n",
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
const after = files[1].content.replace('Before', 'After');
const scope = {
  project_id: project,
  project_revision: 1,
  source_id: request,
  repository: 'neilaureliuscollective/gent-ascend-collective-app',
  source_commit: null,
  source_tree_hash: tree,
  allowed_paths: ['preview.html', 'check.mjs', 'README.md'],
  protected_paths: ['.env'],
  intended_change: 'Durable worker smoke — labelled imported files, not a model-generated feature.',
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
  patch: [{ path: 'preview.html', before: files[1].content, after }],
};

function ensureLocalImage() {
  const inspect = spawn('docker', ['image', 'inspect', 'node:24-alpine'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    inspect.on('error', () =>
      reject(new Error('Docker is not available for isolated Construct execution. Host execution is not a fallback.')),
    );
    inspect.on('close', (code) => {
      if (code === 0) return resolve();
      const pull = spawn('docker', ['pull', 'node:24-alpine'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      pull.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });
      pull.on('error', () =>
        reject(new Error('Docker is not available for isolated Construct execution. Host execution is not a fallback.')),
      );
      pull.on('close', (pullCode) => {
        if (pullCode === 0) return resolve();
        reject(new Error(`Construct image node:24-alpine is unavailable. Host execution is not a fallback. ${stderr}`));
      });
    });
  });
}

function runWorker(workerId) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'architect:worker'], {
      env: {
        ...process.env,
        ...env,
        PATH: process.env.PATH,
        SUPABASE_SERVICE_ROLE_KEY: plane.serviceRoleKey,
        NEXT_PUBLIC_SUPABASE_URL: plane.url,
        ARCHITECT_ORIGIN_ENABLED: 'true',
        ARCHITECT_CONSTRUCT_ENABLED: 'true',
        ARCHITECT_CONSTRUCT_STORE: 'database',
        ARCHITECT_CONSTRUCT_WORKER_TOKEN: 'x'.repeat(32),
        ARCHITECT_CONSTRUCT_WORKER_ID: workerId,
        APP_ENV: 'local',
        NODE_ENV: 'development',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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

function parseTick(stdout) {
  const line = stdout
    .trim()
    .split('\n')
    .filter((entry) => entry.startsWith('{'))
    .at(-1);
  assert.ok(line, `Worker produced no JSON receipt: ${stdout}`);
  return JSON.parse(line);
}

try {
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
    'Owner-supplied kind=fixture must be rejected by the import RPC.',
  );
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
    'Lost-response retry must reuse the reserved request instead of creating a second run.',
  );
  const startedRuns = await owner.from('architect_construct_runs').select('id').eq('project_id', project);
  assert.equal(startedRuns.data.length, 1, JSON.stringify(startedRuns.data));
  assert.ok(
    (
      await owner.rpc('architect_construct_start', {
        p_project: project,
        p_request: request,
        p_brief: crypto.randomUUID(),
        p_expected: 1,
      })
    ).error,
    'Reusing a reserved request with a different brief must be rejected.',
  );
  assert.equal((await owner.from('architect_construct_runs').select('id').eq('project_id', project)).data.length, 1);
  assert.equal((await foreign.from('architect_construct_runs').select('id').eq('id', request)).data.length, 0);
  await ensureLocalImage();
  const first = await runWorker('durable-worker-a');
  assert.equal(first.code, 0, first.stderr || first.stdout);
  assert.match(first.stderr, /construct-worker: starting/);
  assert.match(first.stderr, /construct-worker: shutdown/);
  const tick = parseTick(first.stdout);
  assert.equal(tick.run, request, JSON.stringify({ tick, stderr: first.stderr }));
  assert.equal(
    tick.status,
    'succeeded',
    JSON.stringify({ tick, stderr: first.stderr, stdout: first.stdout }),
  );
  assert.equal(tick.isolation, 'docker', JSON.stringify(tick));
  assert.equal(tick.sandbox, true, JSON.stringify(tick));
  const reloaded = await owner.from('architect_construct_runs').select('*').eq('id', request).single();
  assert.equal(reloaded.error, null);
  assert.equal(reloaded.data.status, 'succeeded');
  assert.equal(reloaded.data.result.sandbox, true);
  assert.equal(reloaded.data.result.isolation, 'docker');
  assert.ok(reloaded.data.result.diff.includes('<h1>After</h1>'));
  assert.ok(String(reloaded.data.result.preview.body).includes('<h1>After</h1>'));
  assert.deepEqual(
    reloaded.data.result.checks.map((check) => check.exit_code),
    [0, 0],
  );
  const events = await owner.from('architect_construct_events').select('kind').eq('run_id', request).order('seq');
  assert.ok(events.data.map((event) => event.kind).includes('finished'));
  const second = await runWorker('durable-worker-b');
  assert.equal(second.code, 0, second.stderr || second.stdout);
  assert.equal(parseTick(second.stdout).run, null);

  const cancelId = crypto.randomUUID();
  const cancelScope = { ...scope, source_id: cancelId, project_id: project };
  assert.equal(
    (
      await owner.rpc('architect_construct_import_source', {
        p_id: cancelId,
        p_kind: 'imported',
        p_repository: scope.repository,
        p_commit: null,
        p_label: 'Imported source snapshot used for cancel-before-claim.',
        p_tree: tree,
        p_files: files,
      })
    ).data,
    true,
  );
  assert.equal(
    (
      await owner.rpc('architect_construct_approve_brief', {
        p_id: cancelId,
        p_project: project,
        p_expected: 1,
        p_source: cancelId,
        p_hash: sha256(JSON.stringify(cancelScope)),
        p_scope: cancelScope,
      })
    ).data,
    true,
  );
  assert.equal(
    (
      await owner.rpc('architect_construct_start', {
        p_project: project,
        p_request: cancelId,
        p_brief: cancelId,
        p_expected: 1,
      })
    ).data,
    true,
  );
  assert.equal(
    (await owner.rpc('architect_construct_cancel', { p_project: project, p_run: cancelId })).data,
    true,
  );
  const canceled = await owner.from('architect_construct_runs').select('status').eq('id', cancelId).single();
  assert.equal(canceled.data.status, 'cancelled');

  const otherProject = crypto.randomUUID();
  assert.equal(
    (
      await owner.rpc('architect_origin_save', {
        p_project: otherProject,
        p_request: crypto.randomUUID(),
        p_expected: 0,
        p_content: { ...content, name: 'Other project isolation' },
        p_note: 'Cross-project isolation',
      })
    ).data,
    1,
  );
  const otherRuns = await owner.from('architect_construct_runs').select('id,project_id').eq('project_id', otherProject);
  assert.equal(otherRuns.data.length, 0);
  const resumed = await owner.from('architect_construct_runs').select('id,project_id,status,result').eq('id', request).single();
  assert.equal(resumed.data.project_id, project);
  assert.equal(resumed.data.status, 'succeeded');
  assert.equal(resumed.data.result.sandbox, true);
  assert.notEqual(resumed.data.project_id, otherProject);

  console.log(
    'PASS: Construct durable owner enqueue, lost-response start retry (one run), reserved-request mismatch denial, compiled standalone worker claim/execute/shutdown, isolated docker receipt, cancel-before-claim, reload/resume, cross-project isolation, second-worker idle, foreign denial. Labelled imported fixture files, not a model-generated Aethelios feature.',
  );
} finally {
  await owner.auth.signOut();
  await foreign.auth.signOut();
}
