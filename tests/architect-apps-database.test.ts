import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';

const db = new PGlite();
const ownerPerson = '00000000-0000-4000-8000-000000000001';
const ownerAuth = '00000000-0000-4000-8000-0000000000aa';
const foreignPerson = '00000000-0000-4000-8000-000000000002';
const foreignAuth = '00000000-0000-4000-8000-0000000000bb';
const project = '00000000-0000-4000-8000-000000000003';
const request = '00000000-0000-4000-8000-000000000004';
const revision = '00000000-0000-4000-8000-000000000005';
const content = initialProject('Synthetic apps project', 'application');
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
const files = [{ path: 'src/App.tsx', content: 'export function App() { return null; }' }];
const collections = [{ name: 'notes', fields: [{ name: 'title', type: 'string', required: true, max: 80 }] }];
const behaviors = {
  navigation: true,
  forms: true,
  validation: true,
  filtering: true,
  calculations: true,
  persistence: true,
};
const generation = { mode: 'mock', notes: 'Labelled mocked provider.' };
const hash = 'a'.repeat(64);
const tree = 'b'.repeat(64);

async function asUser(authId: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${authId}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}

async function asWorker(sql: string) {
  await db.exec(`select set_config('architect.construct_worker','1',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec(`select set_config('architect.construct_worker','',false)`);
  }
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated;
 create table public.persons(id uuid primary key,auth_user_id uuid);
 create table public.founder_access(person_id uuid primary key);
 insert into public.persons values('${ownerPerson}','${ownerAuth}'),('${foreignPerson}','${foreignAuth}');
 insert into public.founder_access values('${ownerPerson}');
 grant select on public.persons to authenticated;
 create table public.ai_conversations(id uuid primary key,person_id uuid,title text);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015080000_architect_apps.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015120000_architect_apps_durable.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015140000_architect_apps_mutation.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015155000_architect_apps_retain_verified.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015156000_architect_apps_preview_sessions.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015156500_architect_apps_pilot_budget.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015156600_architect_apps_execution_gate.sql', 'utf8'));
  await asWorker(`select public.architect_apps_set_execution_policy(true)`);
  await asUser(ownerAuth, `select public.architect_origin_save('${project}','${request}',0,${literal(content)},'Synthetic save')`);
});

afterAll(() => db.close());

describe('Apps durable SQL owner policy and worker fencing (PGlite; not Supabase Auth)', () => {
  it('approves, starts once, fences the worker, and denies the other authenticated owner', async () => {
    expect(ownerPerson).not.toBe(ownerAuth);
    expect(
      (
        await asUser(
          ownerAuth,
          `select public.architect_apps_approve('${revision}','${project}','Field notes',null,'${tree}','${hash}',${literal(files)},${literal(collections)},${literal(behaviors)},${literal(generation)}) as id`,
        )
      ).rows,
    ).toEqual([{ id: revision }]);
    expect(
      (
        await asUser(
          ownerAuth,
          `select public.architect_apps_approve('${revision}','${project}','Field notes',null,'${tree}','${hash}',${literal(files)},${literal(collections)},${literal(behaviors)},${literal(generation)}) as id`,
        )
      ).rows,
    ).toEqual([{ id: revision }]);
    expect(
      (
        await asUser(
          ownerAuth,
          `select public.architect_apps_start('${revision}','${project}','${revision}','${hash}') as id`,
        )
      ).rows,
    ).toEqual([{ id: revision }]);
    expect(
      (
        await asUser(
          ownerAuth,
          `select public.architect_apps_start('${revision}','${project}','${revision}','${hash}') as id`,
        )
      ).rows,
    ).toEqual([{ id: revision }]);
    expect((await asUser(ownerAuth, `select count(*)::int as count from public.architect_app_jobs`)).rows).toEqual([
      { count: 1 },
    ]);
    expect((await asUser(foreignAuth, `select id from public.architect_apps`)).rows).toEqual([]);
    expect((await asUser(foreignAuth, `select id from public.architect_app_revisions`)).rows).toEqual([]);
    expect((await asUser(foreignAuth, `select id from public.architect_app_jobs`)).rows).toEqual([]);
    await expect(
      asUser(foreignAuth, `select public.architect_apps_cancel('${project}','${revision}')`),
    ).rejects.toThrow(/unavailable|Sign in/i);
    await expect(asUser(ownerAuth, `select public.architect_apps_claim('browser',120000)`)).rejects.toThrow(
      /Worker authority required|permission denied/,
    );
    const claimed = await asWorker(`select public.architect_apps_claim('worker-a',120000) as id`);
    expect(claimed.rows[0]).toEqual({ id: revision });
    const token = (
      await asWorker(`select lease_token::text as token from public.architect_app_jobs where id='${revision}'`)
    ).rows[0] as { token: string };
    expect(token.token).toMatch(/^[0-9a-f-]{36}$/i);
    expect(
      (
        await asWorker(
          `select public.architect_apps_mark_running('worker-a','${revision}','${token.token}') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asWorker(
          `select public.architect_apps_save_artifact('worker-a','${revision}','${token.token}','${revision}','${'c'.repeat(64)}',${literal([{ path: 'index.html', content: '<p>notes</p>' }])}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asWorker(
          `select public.architect_apps_mark_revision('worker-a','${revision}','${token.token}','${revision}','ready',true) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    await expect(
      asWorker(
        `select public.architect_apps_finish('worker-a','${revision}','${token.token}','succeeded','{"ok":true,"isolation":"host-fixture","sandbox":true,"typecheck":{"ok":true,"log":""},"bundle":{"ok":true,"log":""},"blocker":null,"stages":[]}'::jsonb)`,
      ),
    ).rejects.toThrow(/Invalid result/);
    expect(
      (
        await asWorker(
          `select public.architect_apps_finish('worker-a','${revision}','${token.token}','succeeded',${literal({
            ok: true,
            isolation: 'docker',
            sandbox: true,
            typecheck: { ok: true, log: '' },
            bundle: { ok: true, log: '' },
            blocker: null,
            stages: [],
          })}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect((await asUser(foreignAuth, `select revision_id from public.architect_app_artifacts`)).rows).toEqual([]);
    expect((await asUser(ownerAuth, `select person_id from public.architect_apps`)).rows).toEqual([
      { person_id: ownerPerson },
    ]);
    const record = await asUser(
      ownerAuth,
      `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Site visit' })},'create-1',null) as id`,
    );
    const replayCreate = await asUser(
      ownerAuth,
      `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Site visit' })},'create-1',null) as id`,
    );
    expect(replayCreate.rows[0]).toEqual(record.rows[0]);
    await expect(
      asUser(
        ownerAuth,
        `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Changed' })},'create-1',null) as id`,
      ),
    ).rejects.toThrow(/different record|mutation identity/i);
    const edited = await asUser(
      ownerAuth,
      `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Site visit edited' })},'edit-1','${(record.rows[0] as { id: string }).id}',1) as id`,
    );
    expect(edited.rows[0]).toEqual(record.rows[0]);
    const retryEdit = await asUser(
      ownerAuth,
      `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Site visit edited' })},'edit-1','${(record.rows[0] as { id: string }).id}',1) as id`,
    );
    expect(retryEdit.rows[0]).toEqual(record.rows[0]);
    await expect(
      asUser(
        ownerAuth,
        `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Should not revert' })},'edit-1','${(record.rows[0] as { id: string }).id}',1) as id`,
      ),
    ).rejects.toThrow(/different record|mutation identity/i);
    const editB = await asUser(
      ownerAuth,
      `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Site visit B' })},'edit-2','${(record.rows[0] as { id: string }).id}',2) as id`,
    );
    expect(editB.rows[0]).toEqual(record.rows[0]);
    await expect(
      asUser(
        ownerAuth,
        `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Stale' })},'edit-3','${(record.rows[0] as { id: string }).id}',2) as id`,
      ),
    ).rejects.toThrow(/Record changed/i);
    expect(
      (await asUser(ownerAuth, `select payload->>'title' as title, version from public.architect_app_records where id='${(record.rows[0] as { id: string }).id}'`))
        .rows,
    ).toEqual([{ title: 'Site visit B', version: 3 }]);
    expect((await asUser(foreignAuth, `select id from public.architect_app_records`)).rows).toEqual([]);
    expect(
      (
        await asWorker(
          `select public.architect_apps_heartbeat('worker-a','${revision}','${token.token}',120000) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    await asWorker(
      `update public.architect_app_jobs set status='running', lease_token=gen_random_uuid(), lease_until=now() - interval '1 second' where id='${revision}'`,
    );
    const lost = await asWorker(`select public.architect_apps_timeout() as n`);
    expect(Number((lost.rows[0] as { n?: number }).n ?? 0)).toBe(1);
  });

  it('ignores caller p_verified and p_source_kind when retaining design', async () => {
    const digest = 'c'.repeat(64);
    const pendingRequest = '00000000-0000-4000-8000-000000000091';
    const importRequest = '00000000-0000-4000-8000-000000000092';
    const talkRequest = '00000000-0000-4000-8000-000000000093';
    await asUser(
      ownerAuth,
      `select public.architect_apps_retain_design('${pendingRequest}','${project}','${digest}','{"schema":"talk-architect-direction/v1"}'::jsonb,'pending',true)`,
    );
    expect(
      (await asUser(ownerAuth, `select verified, source_kind from public.architect_design_directions where request_id='${pendingRequest}'`))
        .rows,
    ).toEqual([{ verified: false, source_kind: 'pending' }]);
    await asUser(
      ownerAuth,
      `select public.architect_apps_retain_design('${importRequest}','${project}','${'d'.repeat(64)}','{"schema":"talk-architect-handoff/v1"}'::jsonb,'text-import',true)`,
    );
    expect(
      (await asUser(ownerAuth, `select verified, source_kind from public.architect_design_directions where request_id='${importRequest}'`))
        .rows,
    ).toEqual([{ verified: false, source_kind: 'text-import' }]);
    await asUser(
      ownerAuth,
      `select public.architect_apps_retain_design('${talkRequest}','${project}','${'e'.repeat(64)}','{"schema":"talk-architect-direction/v1"}'::jsonb,'talk-authorized',true)`,
    );
    expect(
      (await asUser(ownerAuth, `select verified, source_kind from public.architect_design_directions where request_id='${talkRequest}'`))
        .rows,
    ).toEqual([{ verified: false, source_kind: 'pending' }]);
  });

  it('probes the real artifact contract and keeps preview revocation fail-closed', async () => {
    await expect(db.query('select id from public.architect_app_artifacts limit 0')).rejects.toThrow(/column .*id|does not exist/i);
    expect((await db.query('select revision_id from public.architect_app_artifacts limit 0')).rows).toEqual([]);
    const probe = await asWorker(`select public.architect_apps_schema_probe() as report`);
    const report = (
      probe.rows[0] as {
        report: {
          ok: boolean;
          missing: string[];
          contracts: { architect_app_artifacts: string; architect_apps_execution_policy: string };
        };
      }
    ).report;
    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.contracts.architect_app_artifacts).toBe('revision_id');
    expect(report.contracts.architect_apps_execution_policy).toBe('founder_pilot');
    await expect(asUser(ownerAuth, `select public.architect_apps_schema_probe()`)).rejects.toThrow(
      /permission denied|Worker authorization required/i,
    );
    const issued = await asUser(
      ownerAuth,
      `select public.architect_apps_preview_issue('${revision}','aaaaaaaaaaaaaaaa','v1.aaaaaaaaaaaaaaaa.7fffffff.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',${Math.floor(Date.now() / 1000) + 1800},false) as session`,
    );
    const token = (issued.rows[0] as { session: { token: string; nonce: string } }).session;
    expect(token.nonce).toBe('aaaaaaaaaaaaaaaa');
    await asUser(ownerAuth, `select public.architect_apps_preview_revoke('${revision}')`);
    expect(
      (await asUser(ownerAuth, `select public.architect_apps_preview_read('aaaaaaaaaaaaaaaa') as session`)).rows[0],
    ).toMatchObject({ session: expect.objectContaining({ revoked: true }) });
    expect((await asUser(ownerAuth, `select public.architect_apps_preview_current('${revision}') as session`)).rows[0]).toEqual({
      session: null,
    });
    await expect(
      asUser(
        foreignAuth,
        `select public.architect_apps_preview_issue('${revision}','bbbbbbbbbbbbbbbb','v1.bbbbbbbbbbbbbbbb.7fffffff.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',${Math.floor(Date.now() / 1000) + 1800},true)`,
      ),
    ).rejects.toThrow(/Revision unavailable|Sign in required/i);
  });

  it('reserves a founder-pilot budget, refuses ordinary owners, and reports worker presence', async () => {
    const run = '00000000-0000-4000-8000-000000000831';
    const first = '00000000-0000-4000-8000-000000000832';
    const second = '00000000-0000-4000-8000-000000000833';
    const third = '00000000-0000-4000-8000-000000000834';
    const digest = `sha256:${'ab'.repeat(32)}`;
    await expect(
      asUser(
        foreignAuth,
        `select public.architect_apps_reserve_generation('${first}','${run}',1000,4000)`,
      ),
    ).rejects.toThrow(/founder pilot|not enabled for this account/i);
    const reserved = await asUser(
      ownerAuth,
      `select public.architect_apps_reserve_generation('${first}','${run}',1000,4000) as receipt`,
    );
    expect((reserved.rows[0] as { receipt: { created: boolean; status: string } }).receipt).toMatchObject({
      created: true,
      status: 'reserved',
    });
    const replay = await asUser(
      ownerAuth,
      `select public.architect_apps_reserve_generation('${first}','${run}',1000,4000) as receipt`,
    );
    expect((replay.rows[0] as { receipt: { created: boolean } }).receipt.created).toBe(false);
    await asUser(ownerAuth, `select public.architect_apps_reserve_generation('${second}','${run}',1000,4000)`);
    await expect(
      asUser(ownerAuth, `select public.architect_apps_reserve_generation('${third}','${run}',1000,4000)`),
    ).rejects.toThrow(/two model calls/i);
    await asUser(
      ownerAuth,
      `select public.architect_apps_finish_generation('${second}','uncertain',null,null)`,
    );
    expect(
      (
        await asUser(
          ownerAuth,
          `select used_micros from public.architect_app_generation_runs where request_id='${second}'`,
        )
      ).rows,
    ).toEqual([{ used_micros: 210000 }]);
    await asUser(
      ownerAuth,
      `select public.architect_apps_finish_generation('${first}','cancelled',null,null)`,
    );
    expect(
      (
        await asUser(
          ownerAuth,
          `select used_micros from public.architect_app_generation_runs where request_id='${first}'`,
        )
      ).rows,
    ).toEqual([{ used_micros: 0 }]);
    const empty = await asUser(ownerAuth, `select public.architect_apps_worker_readiness(90) as report`);
    expect((empty.rows[0] as { report: { ok: boolean; missing: string[] } }).report).toMatchObject({
      ok: false,
      missing: ['worker'],
    });
    await asWorker(
      `select public.architect_apps_report_worker_presence('apps-cloud','${digest}','docker',true,true,true,'idle')`,
    );
    const ready = await asUser(ownerAuth, `select public.architect_apps_worker_readiness(90) as report`);
    expect((ready.rows[0] as { report: { ok: boolean; isolation: string } }).report).toMatchObject({
      ok: true,
      isolation: 'docker',
    });
    await db.exec(`update public.architect_app_worker_presence set seen_at = now() - interval '3 minutes'`);
    const stale = await asUser(ownerAuth, `select public.architect_apps_worker_readiness(90) as report`);
    expect((stale.rows[0] as { report: { ok: boolean } }).report.ok).toBe(false);
    await expect(
      asUser(
        ownerAuth,
        `select public.architect_apps_report_worker_presence('apps-cloud','${digest}','docker',true,true,true,'idle')`,
      ),
    ).rejects.toThrow(/Worker authorization required|permission denied/i);
  });

  it('denies ordinary owners and a disabled pilot on direct approve/start, and keeps settlement server-authoritative', async () => {
    const ordinaryProject = '00000000-0000-4000-8000-000000000703';
    const ordinaryRevision = '00000000-0000-4000-8000-000000000704';
    const disabledRevision = '00000000-0000-4000-8000-000000000705';
    const startedRequest = '00000000-0000-4000-8000-000000000835';
    const startedRun = '00000000-0000-4000-8000-000000000836';
    const reducedRequest = '00000000-0000-4000-8000-000000000837';
    const overrideRequest = '00000000-0000-4000-8000-000000000838';
    await asUser(
      foreignAuth,
      `select public.architect_origin_save('${ordinaryProject}','${ordinaryProject}',0,${literal(content)},'Ordinary owner project')`,
    );
    await expect(
      asUser(
        foreignAuth,
        `select public.architect_apps_approve('${ordinaryRevision}','${ordinaryProject}','Field notes',null,'${tree}','${hash}',${literal(files)},${literal(collections)},${literal(behaviors)},${literal(generation)})`,
      ),
    ).rejects.toThrow(/founder pilot|not enabled for this account/i);
    await expect(
      asUser(
        foreignAuth,
        `select public.architect_apps_start('${ordinaryRevision}','${ordinaryProject}','${ordinaryRevision}','${hash}')`,
      ),
    ).rejects.toThrow(/founder pilot|not enabled for this account/i);
    await expect(asUser(ownerAuth, `select public.architect_apps_set_execution_policy(true)`)).rejects.toThrow(
      /Worker authorization required|permission denied/i,
    );
    await asWorker(`select public.architect_apps_set_execution_policy(false)`);
    await expect(
      asUser(
        ownerAuth,
        `select public.architect_apps_approve('${disabledRevision}','${project}','Field notes',1,'${tree}','${hash}',${literal(files)},${literal(collections)},${literal(behaviors)},${literal(generation)})`,
      ),
    ).rejects.toThrow(/executable work stays off|Ownership of a project is not founder entitlement/i);
    await asWorker(`select public.architect_apps_set_execution_policy(true)`);
    await expect(
      asUser(
        ownerAuth,
        `select public.architect_apps_reserve_generation('${overrideRequest}','${startedRun}',1000,4000,'gpt-4o')`,
      ),
    ).rejects.toThrow(/gpt-6-astra|Unsupported model/i);
    const reserved = await asUser(
      ownerAuth,
      `select public.architect_apps_reserve_generation('${startedRequest}','${startedRun}',1000,4000) as receipt`,
    );
    expect((reserved.rows[0] as { receipt: { status: string; created: boolean } }).receipt).toMatchObject({
      created: true,
      status: 'reserved',
    });
    const begun = await asUser(
      ownerAuth,
      `select public.architect_apps_begin_generation('${startedRequest}') as receipt`,
    );
    expect((begun.rows[0] as { receipt: { status: string } }).receipt.status).toBe('started');
    const replayBegin = await asUser(
      ownerAuth,
      `select public.architect_apps_begin_generation('${startedRequest}') as receipt`,
    );
    expect((replayBegin.rows[0] as { receipt: { status: string } }).receipt.status).toBe('started');
    await expect(
      asUser(ownerAuth, `select public.architect_apps_finish_generation('${startedRequest}','cancelled',0,0)`),
    ).rejects.toThrow(/cannot be cancelled to zero/i);
    expect(
      (
        await asUser(
          ownerAuth,
          `select status, used_micros from public.architect_app_generation_runs where request_id='${startedRequest}'`,
        )
      ).rows,
    ).toEqual([{ status: 'started', used_micros: null }]);
    await asUser(
      ownerAuth,
      `select public.architect_apps_finish_generation('${startedRequest}','completed',1,1)`,
    );
    expect(
      (
        await asUser(
          ownerAuth,
          `select status, used_input, used_output, used_micros from public.architect_app_generation_runs where request_id='${startedRequest}'`,
        )
      ).rows,
    ).toEqual([{ status: 'completed', used_input: 1000, used_output: 4000, used_micros: 210000 }]);
    await asUser(
      ownerAuth,
      `select public.architect_apps_reserve_generation('${reducedRequest}','${startedRun}',800,4000)`,
    );
    await asUser(ownerAuth, `select public.architect_apps_begin_generation('${reducedRequest}')`);
    await asUser(
      ownerAuth,
      `select public.architect_apps_finish_generation('${reducedRequest}','uncertain',0,0)`,
    );
    expect(
      (
        await asUser(
          ownerAuth,
          `select status, used_micros from public.architect_app_generation_runs where request_id='${reducedRequest}'`,
        )
      ).rows,
    ).toEqual([{ status: 'uncertain', used_micros: 208000 }]);
    await expect(
      asUser(ownerAuth, `select public.architect_apps_finish_generation('${reducedRequest}','cancelled',0,0)`),
    ).rejects.toThrow(/cannot be cancelled to zero/i);
  });
});

describe('Apps schema probe against genuinely missing prerequisites (PGlite; not Supabase Auth)', () => {
  it('fails clearly when required tables are absent', async () => {
    const empty = new PGlite();
    await empty.exec(
      `create function public.architect_apps_worker_ok() returns boolean language sql stable as $$select true$$;`,
    );
    const sql = await readFile('supabase/migrations/20261015156000_architect_apps_preview_sessions.sql', 'utf8');
    const start = sql.indexOf('create or replace function public.architect_apps_schema_probe');
    const end = sql.indexOf('create or replace function public.architect_apps_preview_issue');
    await empty.exec(sql.slice(start, end));
    const probe = await empty.query(`select public.architect_apps_schema_probe() as report`);
    const report = (probe.rows[0] as { report: { ok: boolean; missing: string[] } }).report;
    expect(report.ok).toBe(false);
    expect(report.missing).toEqual(expect.arrayContaining(['architect_apps', 'architect_app_jobs', 'architect_apps_claim']));
    await empty.close();
  });
});
