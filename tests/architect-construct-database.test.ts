import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { approvalHash } from '@/domains/architect-construct/hash';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const project = '00000000-0000-4000-8000-000000000003';
const request = '00000000-0000-4000-8000-000000000004';
const content = initialProject('Synthetic construct project', 'application');
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
const source = fixtureSource(owner, request);
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
          `select public.architect_construct_import_source('${source.id}','fixture','${source.repository}',null,'${source.label.replace(/'/g, "''")}','${source.tree_hash}',${literal(source.files)}) as ok`,
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
    expect(
      (
        await asWorker(
          `select public.architect_construct_finish('worker-a','${request}','blocked',${literal({
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
