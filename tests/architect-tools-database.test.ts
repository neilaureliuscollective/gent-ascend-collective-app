import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';
import { sampleEstimatorConfig } from '@/domains/architect-tools/engine';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const project = '00000000-0000-4000-8000-000000000003';
const tool = '00000000-0000-4000-8000-000000000030';
const receipt = '00000000-0000-4000-8000-000000000031';
const invokeId = '00000000-0000-4000-8000-000000000032';
const content = initialProject('Synthetic estimator host project', 'custom');
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
  await db.exec(`create role authenticated; create role anon; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated;
 create table public.persons(id uuid primary key,auth_user_id uuid); insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
 grant select on public.persons to authenticated; create table public.ai_conversations(id uuid primary key,person_id uuid,title text);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014080000_architect_origin_tools.sql', 'utf8'));
  await asUser(
    owner,
    `select public.architect_origin_save('${project}','00000000-0000-4000-8000-000000000004',0,${literal(content)},'Host project')`,
  );
});
afterAll(() => db.close());

describe('Architect tool SQL ownership and versioning (PGlite; not Supabase Auth)', () => {
  it('saves an estimator revision with exact replay and stale-edit rejection', async () => {
    const config = sampleEstimatorConfig();
    expect(
      (await asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','${receipt}',0,'Plywood estimator',${literal(config)},'First tool save') as revision`,
      )).rows,
    ).toEqual([{ revision: 1 }]);
    expect(
      (await asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','${receipt}',0,'Plywood estimator',${literal(config)},'First tool save') as revision`,
      )).rows,
    ).toEqual([{ revision: 1 }]);
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','${receipt}',0,'Forged',${literal(config)},'First tool save')`,
      ),
    ).rejects.toThrow(/Replay mismatch/);
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','00000000-0000-4000-8000-000000000033',0,'Stale',${literal(config)},'Stale create')`,
      ),
    ).rejects.toThrow(/changed|unavailable/);
  });

  it('denies foreign reads, anonymous access and unknown revisions', async () => {
    expect((await asUser(foreign, `select id from public.architect_origin_tools`)).rows).toEqual([]);
    expect((await asUser(foreign, `select id from public.architect_origin_tool_versions`)).rows).toEqual(
      [],
    );
    await expect(
      asUser(
        foreign,
        `select public.architect_origin_tool_save('00000000-0000-4000-8000-000000000034','${project}','00000000-0000-4000-8000-000000000035',0,'Foreign',${literal(sampleEstimatorConfig())},'Foreign save')`,
      ),
    ).rejects.toThrow(/unavailable/);
    await db.exec('set role anon');
    await expect(db.query(`select * from public.architect_origin_tools`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });

  it('records an invocation against the exact saved revision', async () => {
    const result = { total: '392.15', currency: 'USD' };
    expect(
      (
        await asUser(
          owner,
          `select public.architect_origin_tool_record_invocation('${invokeId}','${tool}',1,${literal({ quantities: {} })},${literal(result)},'architect') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asUser(
          owner,
          `select public.architect_origin_tool_record_invocation('${invokeId}','${tool}',1,${literal({ quantities: {} })},${literal(result)},'architect') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_record_invocation('00000000-0000-4000-8000-000000000036','${tool}',9,${literal({ quantities: {} })},${literal(result)},'architect')`,
      ),
    ).rejects.toThrow(/Revision unavailable/);
  });

  it('keeps existing Origin project validation unchanged', async () => {
    const extra = { ...content, extra: true };
    await expect(
      asUser(
        owner,
        `select public.architect_origin_save('${project}','00000000-0000-4000-8000-000000000037',1,${literal(extra)},'Illegal extra key')`,
      ),
    ).rejects.toThrow(/Invalid project/);
  });
});
