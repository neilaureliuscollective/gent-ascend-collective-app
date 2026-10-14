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
 insert into public.persons values('${ownerPerson}','${ownerAuth}'),('${foreignPerson}','${foreignAuth}');
 grant select on public.persons to authenticated;
 create table public.ai_conversations(id uuid primary key,person_id uuid,title text);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015080000_architect_apps.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015120000_architect_apps_durable.sql', 'utf8'));
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
      `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Site visit' })},'idem-1',null) as id`,
    );
    const replay = await asUser(
      ownerAuth,
      `select public.architect_apps_write_record('${project}','${project}','notes',${literal({ title: 'Changed' })},'idem-1',null) as id`,
    );
    expect(replay.rows[0]).toEqual(record.rows[0]);
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
});
