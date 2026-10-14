import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';
import { originProjectIdentity, originSaveIdentity } from '@/domains/talk-creation/persist';

const db = new PGlite({ extensions: { pgcrypto } });
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const conversation = '00000000-0000-4000-8000-000000000003';
const briefId = '00000000-0000-4000-8000-000000000005';
const handoffId = '00000000-0000-4000-8000-000000000007';
const importId = '00000000-0000-4000-8000-000000000008';
const projectId = originProjectIdentity(owner, handoffId);
const saveId = originSaveIdentity(owner, handoffId);
const unrelatedProject = '00000000-0000-4000-8000-000000000009';
const unrelatedSave = '00000000-0000-4000-8000-00000000000a';
const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const handoff = {
  schema: 'talk-architect-handoff/v1',
  conversationId: conversation,
  preparedAt: '2026-10-14T00:00:00.000Z',
  discipline: 'business',
  idea: 'A premium brand and website.',
  description: '',
  decisions: 'Keep emerald restrained.',
  selections: [
    {
      kind: 'brief',
      lineageId: briefId,
      versionId: briefId,
      version: 1,
      title: 'Reserve site',
    },
  ],
  images: [],
  imported: false,
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
 create table public.ai_turns(id uuid primary key, person_id uuid, conversation_id uuid);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013240000_talk_creation.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013260000_talk_creation_candidates.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014010000_talk_origin_import.sql', 'utf8'));
  await db.exec('create extension if not exists pgcrypto');
  await db.exec(await readFile('supabase/migrations/20261014020000_talk_origin_import_bind.sql', 'utf8'));
});
afterAll(() => db.close());

describe('Talk Origin import SQL receipts (PGlite; not Supabase Auth)', () => {
  it('records one import after the Origin project exists and replays the same receipt', async () => {
    expect(
      (
        await asUser(
          owner,
          `select public.ai_talk_save_creation('${briefId}','${conversation}',null,'brief',null,${literal(brief)}) as receipt`,
        )
      ).rows[0],
    ).toMatchObject({ receipt: { id: briefId, version: 1 } });
    expect(
      (
        await asUser(
          owner,
          `select public.ai_talk_save_creation('${handoffId}','${conversation}',null,'handoff',null,${literal(handoff)}) as receipt`,
        )
      ).rows[0],
    ).toMatchObject({ receipt: { id: handoffId, version: 1 } });
    const content = initialProject('A premium brand and website.', 'business');
    expect(
      (
        await asUser(
          owner,
          `select public.architect_origin_save('${projectId}','${saveId}',0,${literal(content)},'Imported from Talk') as revision`,
        )
      ).rows[0],
    ).toEqual({ revision: 1 });
    expect(
      (
        await asUser(
          owner,
          `select public.ai_talk_scoped_identity('talk-origin-project:${owner}:${handoffId}') as id`,
        )
      ).rows[0],
    ).toEqual({ id: projectId });
    expect(
      (
        await asUser(
          owner,
          `select public.ai_talk_scoped_identity('talk-origin-save:${owner}:${handoffId}') as id`,
        )
      ).rows[0],
    ).toEqual({ id: saveId });
    const record = `select public.ai_talk_record_origin_import('${importId}','${handoffId}','${projectId}','${saveId}','${conversation}','2026-10-14T00:00:00.000Z','{"imagesCopied":false}'::jsonb) as receipt`;
    expect((await asUser(owner, record)).rows[0]).toMatchObject({
      receipt: { id: importId, handoffId, projectId, saveId, recovered: false },
    });
    expect((await asUser(owner, record)).rows[0]).toMatchObject({
      receipt: { id: importId, handoffId, projectId, saveId, recovered: true },
    });
    expect(
      (
        await asUser(
          owner,
          `select public.ai_talk_record_origin_import('00000000-0000-4000-8000-00000000000b','${handoffId}','${projectId}','${saveId}','${conversation}','2026-10-14T00:00:00.000Z') as receipt`,
        )
      ).rows[0],
    ).toMatchObject({ receipt: { handoffId, projectId, saveId, recovered: true } });
    expect(
      (await asUser(owner, `select count(*)::int as count from public.ai_talk_origin_imports`)).rows,
    ).toEqual([{ count: 1 }]);
    expect((await asUser(foreign, `select id from public.ai_talk_origin_imports`)).rows).toEqual([]);
    await expect(
      asUser(
        owner,
        `select public.ai_talk_record_origin_import('${importId}','00000000-0000-4000-8000-000000000099','${projectId}','${saveId}','${conversation}','2026-10-14T00:00:00.000Z')`,
      ),
    ).rejects.toThrow(/reused with different inputs|Project unavailable/i);
    const otherContent = initialProject('Unrelated owned project', 'business');
    expect(
      (
        await asUser(
          owner,
          `select public.architect_origin_save('${unrelatedProject}','${unrelatedSave}',0,${literal(otherContent)},'Imported from Talk') as revision`,
        )
      ).rows[0],
    ).toEqual({ revision: 1 });
    await expect(
      asUser(
        owner,
        `select public.ai_talk_record_origin_import('00000000-0000-4000-8000-00000000000d','${handoffId}','${unrelatedProject}','${unrelatedSave}','${conversation}','2026-10-14T00:00:00.000Z')`,
      ),
    ).rejects.toThrow(/Project unavailable/i);
    await expect(
      asUser(
        owner,
        `select public.ai_talk_record_origin_import('00000000-0000-4000-8000-00000000000e','${handoffId}','${projectId}','${unrelatedSave}','${conversation}','2026-10-14T00:00:00.000Z')`,
      ),
    ).rejects.toThrow(/Project unavailable/i);
    await expect(
      asUser(
        foreign,
        `select public.ai_talk_record_origin_import('00000000-0000-4000-8000-00000000000c','${handoffId}','${projectId}','${saveId}','${conversation}','2026-10-14T00:00:00.000Z')`,
      ),
    ).rejects.toThrow(/unavailable|Sign in required/i);
    await db.exec('set role anon');
    await expect(db.query(`select * from public.ai_talk_origin_imports`)).rejects.toThrow(
      /permission denied/,
    );
    await db.exec('reset role');
  });
});
