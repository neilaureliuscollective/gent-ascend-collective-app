import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
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
  await db.exec(await readFile('supabase/migrations/202609200001_foundation.sql', 'utf8'));
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
