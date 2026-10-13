import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001',
  foreign = '00000000-0000-4000-8000-000000000002';
const project = '00000000-0000-4000-8000-000000000003',
  receipt = '00000000-0000-4000-8000-000000000004';
const content = initialProject('Synthetic premium skincare business', 'business');
const literal = (v: unknown) => "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}
const save = (id = receipt, expected = 0, value = content) =>
  `select public.architect_origin_save('${project}','${id}',${expected},${literal(value)},'Synthetic save') as revision`;
beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated;
 create table public.persons(id uuid primary key,auth_user_id uuid); insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
 grant select on public.persons to authenticated; create table public.ai_conversations(id uuid primary key,person_id uuid,title text);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
});
afterAll(() => db.close());
describe('Origin real SQL transactions and owner policy (PGlite; not Supabase Auth)', () => {
  it('creates a persisted project, owned Talk link and immutable version with exact replay', async () => {
    expect((await asUser(owner, save())).rows).toEqual([{ revision: 1 }]);
    expect((await asUser(owner, save())).rows).toEqual([{ revision: 1 }]);
    expect(
      (await asUser(owner, `select count(*)::int as count from public.architect_origin_versions`))
        .rows,
    ).toEqual([{ count: 1 }]);
    expect(
      (await db.query(`select person_id from public.ai_conversations where id='${project}'`)).rows,
    ).toEqual([{ person_id: owner }]);
    await expect(
      asUser(owner, save(receipt, 0, { ...content, name: 'Forged replay' })),
    ).rejects.toThrow(/Replay mismatch/);
  });
  it('denies foreign reads/writes, anonymous access and direct version overwrite', async () => {
    expect((await asUser(foreign, `select id from public.architect_origin_projects`)).rows).toEqual(
      [],
    );
    expect((await asUser(foreign, `select id from public.architect_origin_versions`)).rows).toEqual(
      [],
    );
    await expect(asUser(foreign, save('00000000-0000-4000-8000-000000000005', 1))).rejects.toThrow(
      /unavailable/,
    );
    await expect(
      asUser(owner, `update public.architect_origin_versions set note='overwrite'`),
    ).rejects.toThrow(/permission denied/);
    await db.exec('set role anon');
    await expect(db.query(`select * from public.architect_origin_projects`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query(save())).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
  it('rejects null/wrong schema fields through SQL as well as the API', async () => {
    const invalid = [
      { ...content, status: null },
      { ...content, discipline: null },
      {
        ...content,
        documents: [
          {
            id: null,
            title: 'Test',
            kind: 'Business plan',
            status: 'draft',
            content: 'content',
            basis: 1,
          },
        ],
      },
      { ...content, sources: [{ url: 'https://example.com', title: 'title', provenance: null }] },
    ];
    for (const value of invalid)
      expect(
        (await db.query(`select public.architect_origin_valid(${literal(value)}) as valid`)).rows,
      ).toEqual([{ valid: false }]);
  });
  it('archives without losing content, fences stale edits and restores as a new revision', async () => {
    const archived = { ...content, status: 'archived' as const };
    await asUser(owner, save('00000000-0000-4000-8000-000000000006', 1, archived));
    await expect(asUser(owner, save('00000000-0000-4000-8000-000000000007', 1))).rejects.toThrow(
      /changed/,
    );
    await asUser(owner, save('00000000-0000-4000-8000-000000000008', 2, content));
    expect(
      (
        await asUser(
          owner,
          `select revision from public.architect_origin_versions order by revision`,
        )
      ).rows,
    ).toEqual([{ revision: 1 }, { revision: 2 }, { revision: 3 }]);
  });
  it('reserves a draft separately, denies duplicate/foreign settlement and preserves quota after finish', async () => {
    const id = '00000000-0000-4000-8000-000000000009';
    const begin = (r = id) =>
      `select public.architect_origin_begin('${project}','${r}',3,'research','Explore alternatives','{}')`;
    await expect(asUser(foreign, begin())).rejects.toThrow(/unavailable/);
    await asUser(owner, begin());
    await expect(asUser(owner, begin())).rejects.toThrow(/already reserved/);
    expect(
      (await asUser(foreign, `select public.architect_origin_finish('${id}',null) as finished`))
        .rows,
    ).toEqual([{ finished: false }]);
    expect(
      (
        await asUser(
          owner,
          `select public.architect_origin_finish('${id}',${literal({ reply: 'Unapproved research', changes: [{ section: 'research', content: 'Unapproved finding', reason: 'Verify before acceptance' }], document: null, sources: [{ url: 'https://example.com/primary', title: 'Synthetic reference', provenance: 'provider' }], kind: 'Research dossier', model: 'synthetic', researchAvailable: true })}) as finished`,
        )
      ).rows,
    ).toEqual([{ finished: true }]);
    await expect(asUser(owner, begin('00000000-0000-4000-8000-000000000010'))).rejects.toThrow(
      /limit/,
    );
    expect(
      (
        await asUser(
          owner,
          `select revision,content->'blueprint'->>'research' as research from public.architect_origin_projects where id='${project}'`,
        )
      ).rows,
    ).toEqual([{ revision: 3, research: '' }]);
    expect(
      (await asUser(owner, `select public.architect_origin_finish('${id}',null) as finished`)).rows,
    ).toEqual([{ finished: false }]);
  });
});
