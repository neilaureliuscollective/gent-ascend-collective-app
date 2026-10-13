import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const conversation = '00000000-0000-4000-8000-000000000003';
const turn = '00000000-0000-4000-8000-000000000004';
const first = '00000000-0000-4000-8000-000000000005';
const second = '00000000-0000-4000-8000-000000000006';
const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";

async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated;
 create table public.persons(id uuid primary key, auth_user_id uuid);
 insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
 grant select on public.persons to authenticated;
 create table public.ai_conversations(id uuid primary key, person_id uuid not null, title text, company_id uuid, archived_at timestamptz, unique(person_id,id));
 insert into public.ai_conversations(id,person_id,title) values('${conversation}','${owner}','Talk');
 create table public.ai_turns(id uuid primary key, person_id uuid, conversation_id uuid);
 insert into public.ai_turns values('${turn}','${owner}','${conversation}');`);
  await db.exec(await readFile('supabase/migrations/20261013240000_talk_creation.sql', 'utf8'));
});
afterAll(() => db.close());

describe('Talk creation SQL versions and ownership (PGlite; not Supabase Auth)', () => {
  it('saves a first version, then a refinement, and rejects a stale predecessor', async () => {
    const save = (id: string, predecessor: string | null, title: string) =>
      `select public.ai_talk_save_creation('${id}','${conversation}','${turn}','brief',${
        predecessor ? `'${predecessor}'` : 'null'
      },${literal({ ...brief, title })}) as receipt`;
    expect((await asUser(owner, save(first, null, 'Reserve site'))).rows[0]).toMatchObject({
      receipt: { id: first, lineageId: first, version: 1 },
    });
    expect((await asUser(owner, save(second, first, 'Reserve site refined'))).rows[0]).toMatchObject({
      receipt: { id: second, lineageId: first, version: 2 },
    });
    await expect(asUser(owner, save('00000000-0000-4000-8000-000000000007', first, 'Stale'))).rejects.toThrow(
      /Stale creation version/,
    );
    expect(
      (await asUser(owner, `select id,version,superseded_by from public.ai_talk_creations order by version`))
        .rows,
    ).toEqual([
      { id: first, version: 1, superseded_by: second },
      { id: second, version: 2, superseded_by: null },
    ]);
  });

  it('denies foreign reads, anonymous access and last-write overwrite of a current version', async () => {
    expect((await asUser(foreign, `select id from public.ai_talk_creations`)).rows).toEqual([]);
    await expect(
      asUser(
        foreign,
        `select public.ai_talk_save_creation('00000000-0000-4000-8000-000000000008','${conversation}',null,'brief',null,${literal(brief)})`,
      ),
    ).rejects.toThrow(/unavailable/i);
    await db.exec('set role anon');
    await expect(db.query(`select * from public.ai_talk_creations`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await expect(
      asUser(owner, `update public.ai_talk_creations set content=${literal({ ...brief, title: 'Overwrite' })}`),
    ).rejects.toThrow(/permission denied/);
  });
});
