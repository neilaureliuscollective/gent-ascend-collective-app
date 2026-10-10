import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { scaffold } from '@/domains/architect/project';
const db = new PGlite();
const a = '10000000-0000-4000-8000-000000000001',
  b = '10000000-0000-4000-8000-000000000002';
const project = '20000000-0000-4000-8000-000000000001',
  version = '30000000-0000-4000-8000-000000000001';
async function asOwner(owner: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`,
  );
}
async function save(id = version, expected = 0) {
  return db.query('select architect_save($1,$2,$3,$4)', [
    project,
    id,
    expected,
    JSON.stringify(scaffold('Test website', 'Synthetic source only')),
  ]);
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table persons(id uuid primary key,auth_user_id uuid);insert into persons values('${a}','${a}'),('${b}','${b}');grant select on persons to authenticated;`,
  );
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20261010120000_architect_projects.sql', import.meta.url),
      'utf8',
    ),
  );
});
afterAll(() => db.close());
describe('Architect SQL/RLS, not real Auth acceptance', () => {
  it('saves atomically and idempotently; blocks stale versions', async () => {
    await asOwner(a);
    await save();
    await save();
    expect((await db.query('select * from architect_versions')).rows).toHaveLength(1);
    await expect(save('30000000-0000-4000-8000-000000000002', 0)).rejects.toThrow(/changed/);
  });
  it('isolates a second person and denies direct writes and grant escalation', async () => {
    await asOwner(b);
    expect((await db.query('select * from architect_projects')).rows).toHaveLength(0);
    await expect(save()).rejects.toThrow(/unavailable/);
    await expect(
      db.exec(`insert into architect_allowances values('${b}',now()+interval '1 day',20)`),
    ).rejects.toThrow(/permission/);
    await expect(db.exec(`update architect_projects set name='other'`)).rejects.toThrow(
      /permission/,
    );
  });
  it('rejects generation without an operational grant', async () => {
    await asOwner(a);
    await expect(
      db.query('select architect_reserve($1,$2,1,$3,$4)', [
        '40000000-0000-4000-8000-000000000001',
        project,
        'a'.repeat(64),
        'gpt-4.1-mini',
      ]),
    ).rejects.toThrow(/not enabled/);
  });
  it('reserves once, enforces concurrency and counts failures against monthly allowance', async () => {
    await db.exec(
      `reset role;insert into architect_allowances values('${a}',now()+interval '1 day',2);`,
    );
    await asOwner(a);
    const job = '40000000-0000-4000-8000-000000000001';
    await db.query('select architect_reserve($1,$2,1,$3,$4)', [
      job,
      project,
      'a'.repeat(64),
      'gpt-4.1-mini',
    ]);
    await expect(
      db.query('select architect_reserve($1,$2,1,$3,$4)', [
        job,
        project,
        'a'.repeat(64),
        'gpt-4.1-mini',
      ]),
    ).rejects.toThrow(/already reserved/);
    const second = '40000000-0000-4000-8000-000000000002';
    await expect(
      db.query('select architect_reserve($1,$2,1,$3,$4)', [
        second,
        project,
        'a'.repeat(64),
        'gpt-4.1-mini',
      ]),
    ).rejects.toThrow(/limit/);
    await asOwner(b);
    await expect(db.query('select architect_finish($1,null)', [job])).rejects.toThrow(
      /unavailable/,
    );
    await asOwner(a);
    await db.query('select architect_finish($1,$2)', [
      job,
      JSON.stringify(scaffold('Test website', 'Proposed source, not saved')),
    ]);
    await expect(
      db.query('select architect_reserve($1,$2,1,$3,$4)', [
        second,
        project,
        'a'.repeat(64),
        'gpt-4.1-mini',
      ]),
    ).rejects.toThrow(/limit/);
    await db.exec(
      `reset role;update architect_jobs set created_at=now()-interval '3 minutes' where id='${job}';`,
    );
    await asOwner(a);
    await db.query('select architect_reserve($1,$2,1,$3,$4)', [
      second,
      project,
      'a'.repeat(64),
      'gpt-4.1-mini',
    ]);
    await db.query('select architect_finish($1,null)', [second]);
    await db.exec(
      `reset role;update architect_jobs set created_at=now()-interval '3 minutes' where id='${second}';`,
    );
    await asOwner(a);
    await expect(
      db.query('select architect_reserve($1,$2,1,$3,$4)', [
        '40000000-0000-4000-8000-000000000003',
        project,
        'a'.repeat(64),
        'gpt-4.1-mini',
      ]),
    ).rejects.toThrow(/limit/);
    expect((await db.query('select * from architect_versions')).rows).toHaveLength(1);
  });
  it('erases content while retaining usage; archived projects cannot be revived', async () => {
    await asOwner(a);
    await db.query('select architect_delete($1)', [project]);
    expect((await db.query('select * from architect_versions')).rows).toHaveLength(0);
    expect((await db.query('select * from architect_jobs')).rows).toHaveLength(2);
    expect(
      (await db.query('select output from architect_jobs where output is not null')).rows,
    ).toHaveLength(0);
    await expect(save()).rejects.toThrow(/unavailable/);
    await asOwner(b);
    await expect(db.query('select architect_delete($1)', [project])).rejects.toThrow(/unavailable/);
  });
  it('checks allowance expiry and the rolling-day cap independently of monthly limits', async () => {
    const otherProject = '20000000-0000-4000-8000-000000000002';
    await asOwner(b);
    await db.query('select architect_save($1,$2,0,$3)', [
      otherProject,
      '30000000-0000-4000-8000-000000000005',
      JSON.stringify(scaffold('Second person', 'Synthetic project')),
    ]);
    await db.exec(
      `reset role;insert into architect_allowances values('${b}',now()-interval '1 second',20);`,
    );
    await asOwner(b);
    await expect(
      db.query('select architect_reserve($1,$2,1,$3,$4)', [
        '40000000-0000-4000-8000-000000000010',
        otherProject,
        'b'.repeat(64),
        'gpt-4.1-mini',
      ]),
    ).rejects.toThrow(/not enabled/);
    await db.exec(
      `reset role;update architect_allowances set expires_at=now()+interval '1 day' where person_id='${b}';`,
    );
    await asOwner(b);
    for (const digit of ['010', '011', '012']) {
      const job = '40000000-0000-4000-8000-000000000' + digit;
      await db.query('select architect_reserve($1,$2,1,$3,$4)', [
        job,
        otherProject,
        'b'.repeat(64),
        'gpt-4.1-mini',
      ]);
      await db.query('select architect_finish($1,null)', [job]);
      await db.exec(
        `reset role;update architect_jobs set created_at=now()-interval '3 minutes' where person_id='${b}';`,
      );
      await asOwner(b);
    }
    await expect(
      db.query('select architect_reserve($1,$2,1,$3,$4)', [
        '40000000-0000-4000-8000-000000000013',
        otherProject,
        'b'.repeat(64),
        'gpt-4.1-mini',
      ]),
    ).rejects.toThrow(/limit/);
  });
  it('denies anonymous table reads and RPC execution', async () => {
    await db.exec('reset role;set role anon;');
    await expect(db.query('select * from architect_projects')).rejects.toThrow(/permission/);
    await expect(db.query('select architect_delete($1)', [project])).rejects.toThrow(/permission/);
  });
});
