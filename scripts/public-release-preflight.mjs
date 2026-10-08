import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export const migrationFiles = [
  // Technology follows the two Mission prerequisites.

  [
    '20261007190000_mission_continuity.sql',
    '0b6b96f3f0e85e0966eb105ab4a8071e54b0daa33789f146d1e04de920bca1f4',
  ],
  [
    '20261007210000_mission_deliverables.sql',
    '39c1797b4ad94d5cbf0b4154396b4aed9d3382cfd8e52ac47fd209f67667fce2',
  ],
  [
    '20261008180000_technology_foundation.sql',
    '944c27ed7973524dfa797f043bcaf62ac5dba205009c8c219218dfeae166e44b',
  ],
];
const columns = {
  persons: ['id', 'auth_user_id'],
  intelligence_missions: [
    'id',
    'person_id',
    'conversation_id',
    'revision',
    'title',
    'objective',
    'status',
    'decisions',
    'open_questions',
    'next_actions',
  ],
  ai_turns: ['id', 'person_id', 'conversation_id', 'status', 'assistant_text'],
  ai_studio_projects: ['id', 'person_id', 'company_id', 'title', 'creative_type', 'brief'],
};
export const expectedChecks = [
  ...Object.entries(columns).flatMap(([table, names]) =>
    names.map((name) => ['prerequisite', `column:${table}.${name}`]),
  ),
  ...['ai_turns', 'ai_studio_projects'].map((table) => ['prerequisite', `owner-key:${table}`]),
  ...['mission_proposals', 'mission_studio_links', 'mission_outputs', 'mission_turn_context'].map(
    (table) => ['continuity', `table:${table}`],
  ),
  ['continuity', 'constraint:mission_owner_identity'],
  ...[
    'mission_capture_context(uuid,uuid,integer)',
    'mission_store_proposal(uuid,uuid,uuid,integer,jsonb,integer,integer,integer)',
    'mission_decide_proposal(uuid,boolean,jsonb)',
    'mission_pin_output(uuid,uuid)',
    'mission_open_studio(uuid,integer)',
  ].map((signature) => ['continuity', `function:public.${signature}`]),
  ...['mission_deliverables', 'mission_deliverable_versions'].map((table) => [
    'deliverables',
    `table:${table}`,
  ]),
  ['deliverables', 'view:mission_deliverable_summaries'],
  ...[
    'mission_create_deliverable(uuid,uuid,integer)',
    'mission_save_deliverable(uuid,uuid,integer,text,text,text)',
    'mission_review_deliverable(uuid,uuid,text)',
    'mission_delete_deliverable(uuid,integer)',
  ].map((signature) => ['deliverables', `function:public.${signature}`]),
  ...[
    'technology_grants',
    'technology_projects',
    'technology_site_versions',
    'technology_runs',
  ].map((table) => ['technology', `table:${table}`]),
  ...[
    'technology_save(uuid,uuid,integer,jsonb,uuid,integer)',
    'technology_review(uuid,uuid)',
    'technology_reserve(uuid,uuid,integer)',
  ].map((signature) => ['technology', `function:public.${signature}`]),
  ['technology', 'broker:technology_settle'],
];

// An operator-supplied snapshot is advisory evidence, not a signed receipt or
// proof of environment identity. Reject incomplete, stale and ambiguous input.
export function evaluateSnapshot(input, now = Date.now()) {
  let snapshot = input;
  if (Array.isArray(snapshot) && snapshot.length === 1) snapshot = snapshot[0];
  if (snapshot && typeof snapshot === 'object' && 'snapshot' in snapshot)
    snapshot = snapshot.snapshot;
  if (!snapshot || snapshot.contract !== 'public-mission-v1' || !Array.isArray(snapshot.checks))
    throw new Error('Invalid catalog snapshot.');
  const observed = Date.parse(snapshot.observed_at);
  if (!Number.isFinite(observed) || now - observed > 15 * 60 * 1000 || observed - now > 60 * 1000)
    throw new Error(
      'Catalog snapshot is stale or has an invalid timestamp. Run the read-only query again.',
    );
  const allowed = new Map(expectedChecks.map(([stage, object]) => [object, stage]));
  const seen = new Set();
  for (const check of snapshot.checks) {
    if (
      !check ||
      !allowed.has(check.object) ||
      allowed.get(check.object) !== check.stage ||
      seen.has(check.object) ||
      typeof check.present !== 'boolean' ||
      typeof check.ok !== 'boolean' ||
      (check.ok && !check.present)
    )
      throw new Error('Catalog snapshot contains an unknown, duplicated or invalid check.');
    seen.add(check.object);
  }
  if (seen.size !== allowed.size) throw new Error('Catalog snapshot is incomplete.');
  const failures = snapshot.checks.filter((check) => !check.ok);
  const stages = ['continuity', 'deliverables', 'technology'].map((stage) => {
    const checks = snapshot.checks.filter((check) => check.stage === stage);
    return {
      stage,
      status: checks.every((check) => check.ok)
        ? 'observed'
        : checks.every((check) => !check.present)
          ? 'pending'
          : 'blocked',
    };
  });
  const prerequisiteFailures = failures.filter((check) => check.stage === 'prerequisite');
  const blocked =
    prerequisiteFailures.length > 0 ||
    stages.some((stage) => stage.status === 'blocked') ||
    stages.some(
      (stage, index) =>
        stage.status === 'pending' &&
        stages.slice(index + 1).some((next) => next.status !== 'pending'),
    );
  return {
    contract: snapshot.contract,
    observedAt: new Date(observed).toISOString(),
    catalogStatus: blocked
      ? 'blocked'
      : stages.every((stage) => stage.status === 'observed')
        ? 'observed'
        : 'pending',
    stages,
    failedChecks: failures.map(({ stage, object }) => ({ stage, object })),
    migrationOrder: migrationFiles.map(([filename]) => filename),
    next: blocked
      ? 'Resolve prerequisite drift or partially present objects before applying anything.'
      : stages.every((stage) => stage.status === 'observed')
        ? 'Catalog checks observed. Complete hosted account, provider and device acceptance before release.'
        : 'Rehearse the three exact additive migrations in isolation, then record an explicit release decision.',
    releaseApproved: false,
    scope:
      'Operator-supplied catalog snapshot only; no hosted Auth, Storage, provider, device or migration-ledger acceptance.',
  };
}

export async function verifyMigrationFiles() {
  for (const [filename, hash] of migrationFiles) {
    const bytes = await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url));
    if (createHash('sha256').update(bytes).digest('hex') !== hash)
      throw new Error('The reviewed additive migration source changed; reconcile before release.');
  }
}

async function main(args) {
  await verifyMigrationFiles();
  if (args.length === 1 && args[0] === '--sql') {
    process.stdout.write(
      await readFile(new URL('./public-release-preflight.sql', import.meta.url), 'utf8'),
    );
    return;
  }
  if (args.length === 1 && args[0] === '--local') {
    const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
    const project = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
    if (!project) throw new Error('Local project identifier is unavailable.');
    const sql = await readFile(new URL('./public-release-preflight.sql', import.meta.url), 'utf8');
    // Only the fixed local CLI container; no hosted URL, credentials or caller-
    // supplied Docker target. SQL is additionally confined to a read-only txn.
    const output = execFileSync(
      'docker',
      [
        'exec',
        '-i',
        `supabase_db_${project}`,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-X',
        '-A',
        '-t',
        '-q',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      {
        input: `begin read only;\n${sql}\nrollback;`,
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 100000,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const report = evaluateSnapshot(JSON.parse(output.trim()));
    console.log(JSON.stringify(report, null, 2));
    if (report.catalogStatus !== 'observed') process.exitCode = 2;
    return;
  }
  if (args.length !== 2 || args[0] !== '--snapshot')
    throw new Error(
      'Usage: npm run release:preflight -- --sql | --snapshot <catalog-snapshot.json>',
    );
  if ((await stat(args[1])).size > 100000)
    throw new Error('Catalog snapshot exceeds the input limit.');
  let input;
  try {
    input = JSON.parse(await readFile(args[1], 'utf8'));
  } catch {
    throw new Error('Catalog snapshot must be valid JSON.');
  }
  const report = evaluateSnapshot(input);
  console.log(JSON.stringify(report, null, 2));
  if (report.catalogStatus !== 'observed') process.exitCode = 2;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    // Never dump an arbitrary snapshot, filesystem error or private path.
    console.error(
      'Release preflight could not complete. Check the documented command, reviewed source and a complete catalog snapshot from the last 15 minutes.',
    );
    process.exitCode = 1;
  });
}
