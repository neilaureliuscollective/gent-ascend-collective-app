import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
const founder = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
async function asUser<T>(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query<T>(sql);
  } finally {
    await db.exec('reset role');
  }
}
beforeAll(async () => {
  // Minimal Auth schema is a test adapter, not a Supabase Auth emulator.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text,email_change_token_current text,reauthentication_token text);
 create table auth.identities(id uuid primary key,user_id uuid,provider_id text,identity_data jsonb,provider text,created_at timestamptz,updated_at timestamptz,unique(provider_id,provider));
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated;`);
  for (const file of (await readdir('supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(await readFile('supabase/seed.sql', 'utf8'));
});
afterAll(() => db.close());
describe('migration, seeds and owner security', () => {
  it('provisions both people and free memberships via auth trigger', async () => {
    expect((await db.query('select * from public.persons')).rows).toHaveLength(2);
    expect(
      (
        await db.query(
          "select * from public.membership_accounts where tier='free' and beta_access=false",
        )
      ).rows,
    ).toHaveLength(2);
  });
  it('allows owner read/write and excludes the second person', async () => {
    const result = await asUser<{ auth_user_id: string }>(founder, 'select * from public.persons');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.auth_user_id).toBe(founder);
    await asUser(founder, "update public.persons set display_name='Founder'");
    expect(
      (await asUser(member, "select * from public.persons where display_name='Founder'")).rows,
    ).toHaveLength(0);
  });
  it('prevents ownership reassignment and billing self-escalation', async () => {
    await expect(
      asUser(founder, `update public.persons set auth_user_id='${member}'`),
    ).rejects.toThrow();
    await expect(
      asUser(founder, "update public.membership_accounts set tier='health'"),
    ).rejects.toThrow();
  });
  it('restricts event reads to owner', async () => {
    expect((await asUser(founder, 'select * from public.personal_events')).rows).toHaveLength(1);
    expect((await asUser(member, 'select * from public.personal_events')).rows).toHaveLength(0);
  });
  it('denies anonymous reads and direct person creation', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from public.persons')).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
    await expect(
      asUser(founder, `insert into public.persons(auth_user_id) values('${member}')`),
    ).rejects.toThrow();
  });
  it('can reapply seed without duplicating records', async () => {
    await db.exec(await readFile('supabase/seed.sql', 'utf8'));
    expect((await db.query('select * from public.persons')).rows).toHaveLength(2);
    expect((await db.query('select * from public.personal_events')).rows).toHaveLength(1);
  });
});

describe('personal profile and goal transactions', () => {
  const firstGoal = '10000000-0000-4000-8000-000000000001';
  const secondGoal = '10000000-0000-4000-8000-000000000002';
  const ownPerson = `(select id from public.persons where auth_user_id='${founder}')`;
  it('versions profile changes and rejects stale writes and invalid preferences', async () => {
    const before = (
      await asUser<{ version: number }>(founder, 'select version from public.persons')
    ).rows[0]!.version;
    const saved = await asUser<{ version: number }>(
      founder,
      `update public.persons set priority='Move with intention',unit_system='metric',timezone='America/Chicago' where version=${before} returning version`,
    );
    expect(saved.rows[0]?.version).toBe(before + 1);
    expect(
      (
        await asUser(
          founder,
          `update public.persons set priority='Stale' where version=${before} returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(founder, "update public.persons set timezone='Not/AZone'"),
    ).rejects.toThrow();
    await expect(
      asUser(founder, "update public.persons set unit_system='unknown'"),
    ).rejects.toThrow();
    await expect(asUser(founder, "update public.persons set display_name='   '")).rejects.toThrow();
    await expect(asUser(founder, 'update public.persons set version=1')).rejects.toThrow();
  });
  it('creates a goal with a linked event and rejects a second active goal', async () => {
    await asUser(
      founder,
      `insert into public.goals(id,person_id,title,domain,next_step) values('${firstGoal}',${ownPerson},'Build consistency','life','Plan tomorrow')`,
    );
    expect(
      (
        await asUser(
          founder,
          `select * from public.personal_events where goal_id='${firstGoal}' and kind='goal.created'`,
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      asUser(
        founder,
        `insert into public.goals(person_id,title,domain,next_step) values(${ownPerson},'Another','life','Begin')`,
      ),
    ).rejects.toThrow();
    expect((await asUser(founder, 'select * from public.goals')).rows).toHaveLength(1);
  });
  it('isolates goal reads, inserts, edits, ownership and events', async () => {
    const owner = (
      await db.query<{ person_id: string }>(
        `select person_id from public.goals where id='${firstGoal}'`,
      )
    ).rows[0]!.person_id;
    expect((await asUser(member, 'select * from public.goals')).rows).toHaveLength(0);
    expect(
      (
        await asUser(
          member,
          `update public.goals set title='Intruder' where id='${firstGoal}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(
        member,
        `insert into public.goals(person_id,title,domain,next_step) values('${owner}','Intruder','life','Begin')`,
      ),
    ).rejects.toThrow();
    await expect(asUser(founder, `update public.goals set person_id='${owner}'`)).rejects.toThrow();
    await expect(asUser(founder, 'update public.goals set version=100')).rejects.toThrow();
    await expect(asUser(founder, 'delete from public.goals')).rejects.toThrow();
    await expect(asUser(founder, 'select public.record_goal_event()')).rejects.toThrow();
    expect((await asUser(member, 'select * from public.personal_events')).rows).toHaveLength(0);
  });
  it('updates atomically and prevents an older tab from overwriting it', async () => {
    const result = await asUser<{ version: number }>(
      founder,
      `update public.goals set next_step='Write a plan' where id='${firstGoal}' and version=1 returning version`,
    );
    expect(result.rows[0]?.version).toBe(2);
    expect(
      (
        await asUser(
          founder,
          `update public.goals set next_step='Old draft' where id='${firstGoal}' and version=1 returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          founder,
          `select * from public.personal_events where goal_id='${firstGoal}' and kind='goal.updated'`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it('completes a goal, preserves history and denies editing closed goals', async () => {
    await expect(
      asUser(
        founder,
        `update public.goals set title='Changed',status='completed' where id='${firstGoal}'`,
      ),
    ).rejects.toThrow();
    const result = await asUser<{ status: string; closed_at: string; version: number }>(
      founder,
      `update public.goals set status='completed' where id='${firstGoal}' and version=2 returning status,closed_at,version`,
    );
    expect(result.rows[0]).toMatchObject({ status: 'completed', version: 3 });
    expect(result.rows[0]?.closed_at).toBeTruthy();
    await expect(
      asUser(founder, `update public.goals set title='Rewrite history' where id='${firstGoal}'`),
    ).rejects.toThrow();
    expect(
      (
        await asUser(
          founder,
          `select * from public.personal_events where goal_id='${firstGoal}' and kind='goal.completed'`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it('can create and archive a new focus after completion', async () => {
    await asUser(
      founder,
      `insert into public.goals(id,person_id,title,domain,next_step) values('${secondGoal}',${ownPerson},'Next chapter','mind','Reflect')`,
    );
    await asUser(founder, `update public.goals set status='archived' where id='${secondGoal}'`);
    expect((await asUser(founder, 'select * from public.goals')).rows).toHaveLength(2);
    expect(
      (
        await asUser(
          founder,
          `select * from public.personal_events where goal_id='${secondGoal}' and kind='goal.archived'`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it('rolls back both the goal and event when a transaction fails', async () => {
    const countBefore = (await db.query('select * from public.personal_events')).rows.length;
    await db.exec('begin');
    try {
      await asUser(
        founder,
        `insert into public.goals(person_id,title,domain,next_step) values(${ownPerson},'Rolled back','life','Begin')`,
      );
      await expect(db.query('select 1/0')).rejects.toThrow();
    } finally {
      await db.exec('rollback');
    }
    expect((await db.query('select * from public.goals')).rows).toHaveLength(2);
    expect((await db.query('select * from public.personal_events')).rows).toHaveLength(countBefore);
  });
  it('rejects forged event ownership even for a privileged writer', async () => {
    await expect(
      db.query(
        `insert into public.personal_events(person_id,kind,occurred_at,source,source_record_id,goal_id) values((select id from public.persons where auth_user_id='${member}'),'goal.created',now(),'user','${firstGoal}','${firstGoal}')`,
      ),
    ).rejects.toThrow();
  });
});
