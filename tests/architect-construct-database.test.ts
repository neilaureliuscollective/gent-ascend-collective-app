import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';
import { fixtureScope, importedFixtureSource } from '@/domains/architect-construct/fixture';
import { approvalHash } from '@/domains/architect-construct/hash';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const project = '00000000-0000-4000-8000-000000000003';
const request = '00000000-0000-4000-8000-000000000004';
const content = initialProject('Synthetic construct project', 'application');
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
const source = importedFixtureSource(owner, request);
const scope = fixtureScope({
  projectId: project,
  projectRevision: 1,
  sourceId: source.id,
  sourceTreeHash: source.tree_hash,
});

async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
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
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''), current_user)$$;
 grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid(),auth.role() to authenticated;
 create table public.persons(id uuid primary key,auth_user_id uuid); insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
 grant select on public.persons to authenticated; create table public.ai_conversations(id uuid primary key,person_id uuid,title text);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013160000_architect_construct.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013180000_architect_construct_worker_plane.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013193000_architect_construct_isolation.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013220000_architect_construct_lease_freshness.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013230000_architect_construct_finish_event.sql', 'utf8'));
  await asUser(
    owner,
    `select public.architect_origin_save('${project}','${request}',0,${literal(content)},'Synthetic save')`,
  );
});
afterAll(() => db.close());

describe('Construct SQL owner policy and worker authority (PGlite; not Supabase Auth)', () => {
  it('imports a labelled source, approves a pin, and starts one idempotent run', async () => {
    expect(
      (
        await asUser(
          owner,
          `select public.architect_construct_import_source('${source.id}','imported','${source.repository}',null,'${source.label.replace(/'/g, "''")}','${source.tree_hash}',${literal(source.files)}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asUser(
          owner,
          `select public.architect_construct_approve_brief('${request}','${project}',1,'${source.id}','${approvalHash(scope)}',${literal(scope)}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asUser(
          owner,
          `select public.architect_construct_start('${project}','${request}','${request}',1) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asUser(
          owner,
          `select public.architect_construct_start('${project}','${request}','${request}',1) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (await asUser(owner, `select count(*)::int as count from public.architect_construct_runs`)).rows,
    ).toEqual([{ count: 1 }]);
  });

  it('denies foreign reads, forged worker claim and client-written success', async () => {
    expect((await asUser(foreign, `select id from public.architect_construct_runs`)).rows).toEqual([]);
    await expect(
      asUser(foreign, `select public.architect_construct_cancel('${project}','${request}')`),
    ).rejects.toThrow(/unavailable|Sign in/i);
    await expect(asUser(owner, `select public.architect_construct_claim('browser',45000)`)).rejects.toThrow(
      /Worker authority required|permission denied/,
    );
    await expect(
      asUser(
        owner,
        `update public.architect_construct_runs set status='succeeded', result='{"sandbox":true}'`,
      ),
    ).rejects.toThrow(/permission denied/);
    const claimed = await asWorker(`select public.architect_construct_claim('worker-a',45000) as id`);
    expect(claimed.rows[0]).toEqual({ id: request });
    const token = (
      await asWorker(`select lease_token::text as token from public.architect_construct_runs where id='${request}'`)
    ).rows[0] as { token: string };
    expect(token.token).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(
      asUser(
        owner,
        `select public.architect_construct_import_source('${crypto.randomUUID()}','fixture','${source.repository}',null,'Owner fixture','${source.tree_hash}',${literal(source.files)})`,
      ),
    ).rejects.toThrow(/Invalid source/i);
    expect(
      (
        await asWorker(
          `select public.architect_construct_finish('worker-a','${request}','${token.token}','blocked',${literal({
            isolation: 'unavailable',
            runtime_available: false,
            sandbox: false,
            blocker: 'Synthetic blocked receipt',
            source_hash: source.tree_hash,
            result_hash: null,
            changed_files: [],
            diff: '',
            checks: [],
            preview: { path: null, body: '', unavailable_reason: 'blocked' },
            artifacts: [],
          })}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asWorker(
          `select public.architect_construct_finish('stale-worker','${request}','${token.token}','succeeded',${literal({
            isolation: 'unavailable',
            runtime_available: false,
            sandbox: false,
            blocker: 'stale',
            source_hash: source.tree_hash,
            result_hash: null,
            changed_files: [],
            diff: '',
            checks: [],
            preview: { path: null, body: '', unavailable_reason: 'stale' },
            artifacts: [],
          })}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    expect(
      (await asWorker(`select kind from public.architect_construct_events where run_id='${request}' order by seq`))
        .rows,
    ).toEqual(expect.arrayContaining([{ kind: 'blocked' }]));
    expect(
      (
        await asWorker(
          `select public.architect_construct_append_event('worker-a','${request}','${token.token}','finished','late append after lease clear') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
  });

  it('persists a finished event atomically and keeps lease freshness', async () => {
    const finished = '00000000-0000-4000-8000-000000000008';
    const finishedSource = importedFixtureSource(owner, finished);
    const finishedScope = fixtureScope({
      projectId: project,
      projectRevision: 1,
      sourceId: finishedSource.id,
      sourceTreeHash: finishedSource.tree_hash,
    });
    await asUser(
      owner,
      `select public.architect_construct_import_source('${finishedSource.id}','imported','${finishedSource.repository}',null,'${finishedSource.label.replace(/'/g, "''")}','${finishedSource.tree_hash}',${literal(finishedSource.files)}) as ok`,
    );
    await asUser(
      owner,
      `select public.architect_construct_approve_brief('${finished}','${project}',1,'${finishedSource.id}','${approvalHash(finishedScope)}',${literal(finishedScope)}) as ok`,
    );
    await asUser(owner, `select public.architect_construct_start('${project}','${finished}','${finished}',1)`);
    const claimed = await asWorker(`select public.architect_construct_claim('finish-worker',45000) as id`);
    expect(claimed.rows[0]).toEqual({ id: finished });
    const token = (
      await asWorker(`select lease_token::text as token from public.architect_construct_runs where id='${finished}'`)
    ).rows[0] as { token: string };
    expect(
      (
        await asWorker(
          `select public.architect_construct_finish('finish-worker','${finished}','${token.token}','succeeded',${literal({
            isolation: 'unavailable',
            runtime_available: false,
            sandbox: false,
            blocker: null,
            source_hash: finishedSource.tree_hash,
            result_hash: null,
            changed_files: [],
            diff: '',
            checks: [],
            preview: { path: null, body: '', unavailable_reason: 'synthetic' },
            artifacts: [],
          })}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (await asWorker(`select kind from public.architect_construct_events where run_id='${finished}' order by seq`))
        .rows.map((row) => (row as { kind: string }).kind),
    ).toContain('finished');
    expect(
      (await asWorker(`select lease_until from public.architect_construct_runs where id='${finished}'`)).rows,
    ).toEqual([{ lease_until: null }]);
    expect(
      (
        await asWorker(
          `select public.architect_construct_append_event('finish-worker','${finished}','${token.token}','finished','after clear') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
  });

  it('refuses heartbeat and finish after lease expiry without a replacement claim', async () => {
    const expired = '00000000-0000-4000-8000-000000000007';
    const expiredSource = importedFixtureSource(owner, expired);
    const expiredScope = fixtureScope({
      projectId: project,
      projectRevision: 1,
      sourceId: expiredSource.id,
      sourceTreeHash: expiredSource.tree_hash,
    });
    await asUser(
      owner,
      `select public.architect_construct_import_source('${expiredSource.id}','imported','${expiredSource.repository}',null,'${expiredSource.label.replace(/'/g, "''")}','${expiredSource.tree_hash}',${literal(expiredSource.files)}) as ok`,
    );
    await asUser(
      owner,
      `select public.architect_construct_approve_brief('${expired}','${project}',1,'${expiredSource.id}','${approvalHash(expiredScope)}',${literal(expiredScope)}) as ok`,
    );
    await asUser(owner, `select public.architect_construct_start('${project}','${expired}','${expired}',1)`);
    const claimed = await asWorker(`select public.architect_construct_claim('expired-worker',45000) as id`);
    expect(claimed.rows[0]).toEqual({ id: expired });
    const token = (
      await asWorker(
        `select lease_token::text as token from public.architect_construct_runs where id='${expired}'`,
      )
    ).rows[0] as { token: string };
    await db.exec(
      `update public.architect_construct_runs set lease_until=now()-interval '1 second' where id='${expired}'`,
    );
    expect(
      (await asWorker(`select public.architect_construct_heartbeat('expired-worker','${expired}','${token.token}',45000) as ok`))
        .rows,
    ).toEqual([{ ok: false }]);
    expect(
      (
        await asWorker(
          `select public.architect_construct_finish('expired-worker','${expired}','${token.token}','succeeded',${literal({
            isolation: 'unavailable',
            runtime_available: false,
            sandbox: false,
            blocker: 'stale expiry',
            source_hash: expiredSource.tree_hash,
            result_hash: null,
            changed_files: [],
            diff: '',
            checks: [],
            preview: { path: null, body: '', unavailable_reason: 'stale' },
            artifacts: [],
          })}) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    expect(
      (await asWorker(`select status from public.architect_construct_runs where id='${expired}'`)).rows,
    ).toEqual([{ status: 'claimed' }]);
  });

  it('rejects a stale project revision after a newer Origin save', async () => {
    const next = '00000000-0000-4000-8000-000000000006';
    await asUser(
      owner,
      `select public.architect_origin_save('${project}','${next}',1,${literal({ ...content, name: 'Changed' })},'Synthetic next')`,
    );
    await expect(
      asUser(owner, `select public.architect_construct_start('${project}','${next}','${request}',1)`),
    ).rejects.toThrow(/changed|invalidated/i);
  });
});
