#!/usr/bin/env node
// Real PostgreSQL verification of Talk Origin unique-violation recovery.
// Does not mock success, disable plpgsql.variable_conflict, or edit 20261014040000.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { recoveryTarget } from './talk-import-recovery-target.mjs';

const target = recoveryTarget(process.env);
const database = target.database;
const quotedDatabase = target.quotedDatabase;
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const conversation = '00000000-0000-4000-8000-000000000003';
const briefId = '00000000-0000-4000-8000-000000000005';
const handoffId = '00000000-0000-4000-8000-000000000007';
const importId = '00000000-0000-4000-8000-000000000008';
const occupyBrief = '00000000-0000-4000-8000-000000000034';
const occupyHandoff = '00000000-0000-4000-8000-000000000035';
const targetBrief = '00000000-0000-4000-8000-000000000036';
const targetHandoff = '00000000-0000-4000-8000-000000000037';
const targetImport = '00000000-0000-4000-8000-000000000038';
const occupyReceipt = '00000000-0000-4000-8000-000000000039';

const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const briefOnly = {
  schema: 'talk-architect-handoff/v1',
  conversationId: conversation,
  preparedAt: '2026-10-14T00:00:00.000Z',
  discipline: 'business',
  idea: 'A premium brand and website.',
  description: '',
  decisions: 'Keep emerald restrained.',
  selections: [
    { kind: 'brief', lineageId: briefId, versionId: briefId, version: 1, title: 'Reserve site' },
  ],
  images: [],
  imported: false,
};
const occupyPackage = {
  ...briefOnly,
  selections: [{ kind: 'brief', lineageId: occupyBrief, versionId: occupyBrief, version: 1, title: 'Reserve site' }],
};
const targetPackage = {
  ...briefOnly,
  selections: [{ kind: 'brief', lineageId: targetBrief, versionId: targetBrief, version: 1, title: 'Reserve site' }],
};

function literal(value) {
  return "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
}

function psqlEnv() {
  return { ...process.env, PGPASSWORD: target.password, PGSSLMODE: 'disable' };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: psqlEnv(),
    ...options,
  });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}): ${detail}`);
  }
  return result.stdout;
}

function psqlArgs(db, extra = []) {
  return [
    '-h',
    target.host,
    '-p',
    String(target.port),
    '-U',
    target.user,
    '-v',
    'ON_ERROR_STOP=1',
    '-d',
    db,
    '-At',
    '-q',
    ...extra,
  ];
}

function sql(text, extraArgs = []) {
  return run('psql', [...psqlArgs(database), ...extraArgs, '-c', text]);
}

function sqlFile(path) {
  return run('psql', [...psqlArgs(database), '-f', path]);
}

function requirePsql() {
  const ready = spawnSync(
    'pg_isready',
    ['-h', target.host, '-p', String(target.port), '-U', target.user, '-d', target.maintenanceDatabase],
    { encoding: 'utf8', env: psqlEnv() },
  );
  if (ready.status !== 0) {
    throw new Error(
      `Local Supabase PostgreSQL is not ready on ${target.host}:${target.port}. Start it with supabase start. ${ready.stdout || ready.stderr || 'pg_isready failed'}`,
    );
  }
  const version = run('psql', [
    ...psqlArgs(target.maintenanceDatabase),
    '-c',
    'show server_version;',
  ]).trim();
  if (!/^17\./.test(version)) {
    throw new Error(
      `Expected local Supabase PostgreSQL 17 at ${target.host}:${target.port}, got ${version || 'no version'}`,
    );
  }
  return version;
}

function recreateDatabase() {
  const who = run('psql', [...psqlArgs(target.maintenanceDatabase), '-c', 'select current_user;']).trim();
  const currentDb = run('psql', [
    ...psqlArgs(target.maintenanceDatabase),
    '-c',
    'select current_database();',
  ]).trim();
  if (currentDb !== target.maintenanceDatabase) {
    throw new Error(`Refusing to manage databases while connected to ${currentDb}`);
  }
  if (quotedDatabase === `"${target.maintenanceDatabase}"`) {
    throw new Error('Refusing to drop or recreate the application/maintenance database.');
  }
  run('psql', [
    ...psqlArgs(target.maintenanceDatabase),
    '-c',
    `drop database if exists ${quotedDatabase};`,
  ]);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(who)) {
    throw new Error(`Refusing database owner ${JSON.stringify(who)}`);
  }
  run('psql', [
    ...psqlArgs(target.maintenanceDatabase),
    '-c',
    `create database ${quotedDatabase} owner "${who}";`,
  ]);
}

const migrations = [
  'supabase/migrations/20261012230000_architect_origin.sql',
  'supabase/migrations/20261013240000_talk_creation.sql',
  'supabase/migrations/20261013260000_talk_creation_candidates.sql',
  'supabase/migrations/20261014010000_talk_origin_import.sql',
  'supabase/migrations/20261014020000_talk_origin_import_bind.sql',
  'supabase/migrations/20261014030000_talk_origin_import_atomic.sql',
  'supabase/migrations/20261014040000_talk_origin_import_consistency.sql',
  'supabase/migrations/20261014100000_talk_design_board.sql',
];

function bootstrap() {
  sql(`
    do $roles$ begin
      if not exists (select 1 from pg_roles where rolname='authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname='anon') then
        create role anon nologin;
      end if;
    end $roles$;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create extension if not exists pgcrypto;
    create table public.persons(id uuid primary key, auth_user_id uuid);
    insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
    grant select on public.persons to authenticated;
    create table public.ai_conversations(
      id uuid primary key, person_id uuid not null, title text, company_id uuid, archived_at timestamptz,
      unique(person_id,id)
    );
    insert into public.ai_conversations(id,person_id,title) values('${conversation}','${owner}','Talk');
    create table public.ai_turns(id uuid primary key, person_id uuid, conversation_id uuid);
  `);
  for (const file of migrations) {
    sqlFile(file);
  }
}

function asUser(id, text, prelude = '') {
  return sql(`
    ${prelude}
    do $auth$ begin
      perform set_config('request.jwt.claim.sub','${id}',false);
    end $auth$;
    set role authenticated;
    ${text}
    reset role;
  `);
}

function expectMatch(label, actual, pattern) {
  if (!pattern.test(actual)) {
    throw new Error(`${label}: expected ${pattern} got ${JSON.stringify(actual)}`);
  }
}

function expectEq(label, actual, expected) {
  if (actual.trim() !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual.trim())}`);
  }
}

function expectThrows(label, fn, pattern) {
  try {
    fn();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (pattern.test(text)) return text;
    throw new Error(`${label}: threw unexpected error: ${text}`);
  }
  throw new Error(`${label}: expected a PostgreSQL error matching ${pattern}`);
}

function saveCreation(id, kind, content, predecessor = null) {
  asUser(
    owner,
    `select public.ai_talk_save_creation('${id}','${conversation}',null,'${kind}',${
      predecessor ? `'${predecessor}'` : 'null'
    },${literal(content)});`,
  );
}

function occupyTargetSave() {
  saveCreation(occupyBrief, 'brief', brief);
  saveCreation(occupyHandoff, 'handoff', occupyPackage);
  saveCreation(targetBrief, 'brief', brief);
  saveCreation(targetHandoff, 'handoff', targetPackage);
  const ids = sql(`
    select public.ai_talk_scoped_identity('talk-origin-project:${owner}:${targetHandoff}')::text
      || ',' ||
           public.ai_talk_scoped_identity('talk-origin-save:${owner}:${targetHandoff}')::text;
  `).trim();
  const [targetProject, targetSave] = ids.split(',');
  const mapped = sql(
    `select public.ai_talk_origin_mapped_project(${literal(targetPackage)},${literal(brief)},null,null,'[]'::jsonb);`,
  ).trim();
  asUser(
    owner,
    `select public.architect_origin_save(
      '${targetProject}'::uuid,
      '${targetSave}'::uuid,
      0,
      (${literal(JSON.parse(mapped))}->'content'),
      'Imported from Talk'
    );`,
  );
  sql(`
    insert into public.ai_talk_origin_imports(
      id,person_id,handoff_id,conversation_id,project_id,save_id,prepared_at,provenance,mapping_version
    ) values (
      '${occupyReceipt}','${owner}','${occupyHandoff}','${conversation}','${targetProject}','${targetSave}',
      '2026-10-14T00:00:00.000Z',
      (${literal(JSON.parse(mapped))}->'provenance'),
      'talk-origin-import/v1'
    );
  `);
  return { targetProject, targetSave };
}

const version = requirePsql();
recreateDatabase();
bootstrap();

function readVariableConflict() {
  try {
    const value = sql('show plpgsql.variable_conflict').trim();
    if (value) return value;
  } catch {
    // Supabase PostgreSQL 17 forbids LOAD 'plpgsql'; SHOW may still work.
  }
  try {
    const value = sql("select current_setting('plpgsql.variable_conflict', true);").trim();
    if (value) return value;
  } catch {
    // The historical-ambiguity probe is the proof that the default remains error.
  }
  return null;
}

const probe = expectThrows(
  'default PL/pgSQL substitution is ambiguous',
  () =>
    sql(`
      create or replace function public.talk_ambiguity_probe() returns void
      language plpgsql set search_path='' as $$
      declare save_id uuid := '${importId}';
      begin
        perform 1 from public.ai_talk_origin_imports where save_id = save_id;
      end $$;
      select public.talk_ambiguity_probe();
    `),
  /column reference "save_id" is ambiguous/i,
);
const conflict = readVariableConflict() ?? (/ambiguous/i.test(probe) ? 'error' : '');
expectEq('plpgsql.variable_conflict stays error', conflict, 'error');

saveCreation(briefId, 'brief', brief);
saveCreation(handoffId, 'handoff', briefOnly);
const firstOnHistorical = asUser(
  owner,
  `select public.ai_talk_import_origin('${importId}','${handoffId}','${conversation}');`,
).trim();
expectMatch('historical first insert', firstOnHistorical, /"recovered"\s*:\s*false/);

const occupied = occupyTargetSave();
const historicalRecovery = expectThrows(
  'historical 14040000 unique-violation recovery is ambiguous',
  () =>
    asUser(
      owner,
      `select public.ai_talk_import_origin('${targetImport}','${targetHandoff}','${conversation}');`,
    ),
  /column reference "(save_id|project_id)" is ambiguous/i,
);
expectEq(
  'historical failed recovery left the occupied pairing',
  asUser(
    owner,
    `select count(*)::text || ',' || count(*) filter (where id='${targetImport}')::text
       from public.ai_talk_origin_imports
      where project_id='${occupied.targetProject}' or save_id='${occupied.targetSave}' or handoff_id='${targetHandoff}';`,
  ).trim(),
  '1,0',
);

sqlFile('supabase/migrations/20261019120000_talk_origin_import_recovery.sql');
expectEq(
  'qualified recovery is present',
  sql(`
    select (prosrc like '%intended_save_id%' and prosrc like '%intended_project_id%')::text
    from pg_proc where oid = to_regprocedure('public.ai_talk_import_origin(uuid,uuid,uuid)');
  `).trim(),
  'true',
);
expectEq(
  'historical collision is gone',
  sql(`
    select (prosrc like '%save_id=save_id%' or prosrc like '%project_id=project_id%')::text
    from pg_proc where oid = to_regprocedure('public.ai_talk_import_origin(uuid,uuid,uuid)');
  `).trim(),
  'false',
);

const replay = asUser(
  owner,
  `select public.ai_talk_import_origin('${importId}','${handoffId}','${conversation}');`,
).trim();
expectMatch('same-request replay', replay, /"recovered"\s*:\s*true/);
expectEq(
  'replay is one receipt',
  asUser(owner, `select count(*)::text from public.ai_talk_origin_imports where handoff_id='${handoffId}';`).trim(),
  '1',
);

sql(`delete from public.ai_talk_origin_imports where id='${importId}';`);
const first = asUser(
  owner,
  `select public.ai_talk_import_origin('${importId}','${handoffId}','${conversation}');`,
).trim();
expectMatch('normal import', first, /"recovered"\s*:\s*false/);
expectMatch('normal import keeps request id', first, new RegExp(`"id"\\s*:\\s*"${importId}"`));

expectThrows(
  'unique-violation recovery rejects a mismatched occupied save',
  () =>
    asUser(
      owner,
      `select public.ai_talk_import_origin('${targetImport}','${targetHandoff}','${conversation}');`,
    ),
  /reused with different inputs/i,
);
expectThrows(
  'foreign owner cannot import',
  () =>
    asUser(
      foreign,
      `select public.ai_talk_import_origin('00000000-0000-4000-8000-00000000000c','${handoffId}','${conversation}');`,
    ),
  /unavailable|Sign in required/i,
);
expectEq(
  'foreign owner cannot read receipts',
  asUser(foreign, `select count(*)::text from public.ai_talk_origin_imports;`).trim(),
  '0',
);
const { targetProject, targetSave } = occupied;
expectEq(
  'failed recovery created no mismatched receipt',
  asUser(
    owner,
    `select count(*)::text || ',' || count(*) filter (where id='${targetImport}')::text
       from public.ai_talk_origin_imports
      where project_id='${targetProject}' or save_id='${targetSave}' or handoff_id='${targetHandoff}';`,
  ).trim(),
  '1,0',
);
expectEq(
  'occupied pairing is unchanged',
  asUser(
    owner,
    `select id::text || ',' || handoff_id::text || ',' || project_id::text || ',' || save_id::text
       from public.ai_talk_origin_imports where save_id='${targetSave}';`,
  ).trim(),
  `${occupyReceipt},${occupyHandoff},${targetProject},${targetSave}`,
);

const source = readFileSync('supabase/migrations/20261014040000_talk_origin_import_consistency.sql', 'utf8');
if (!source.includes('save_id=save_id') || !source.includes('project_id=project_id')) {
  throw new Error('historical 20261014040000 no longer contains the recorded collision');
}

const sha = (
  process.env.GITHUB_SHA ||
  run('git', ['rev-parse', 'HEAD'], { env: process.env }).trim()
);
const receipt = {
  commit: sha,
  engine: `PostgreSQL ${version}`,
  host: target.host,
  port: target.port,
  disposableDatabase: database,
  applicationDatabaseUntouched: true,
  sudoPeerEscalation: false,
  variableConflict: conflict,
  historicalAmbiguity: /ambiguous/i.test(probe) && /ambiguous/i.test(historicalRecovery),
  correctedRecoveryPath: true,
  normalImport: /"recovered"\s*:\s*false/.test(first),
  sameRequestReplay: /"recovered"\s*:\s*true/.test(replay),
  uniqueViolationRecovery: true,
  foreignOwnerRejected: true,
  failedRecoveryUnchanged: true,
  occupiedPairingPreserved: true,
  historicalFileUnchanged: true,
};
mkdirSync('docs/evidence/talk-origin-import-recovery', { recursive: true });
writeFileSync(
  'docs/evidence/talk-origin-import-recovery/receipt.json',
  `${JSON.stringify(receipt, null, 2)}\n`,
);
console.log(JSON.stringify(receipt, null, 2));
