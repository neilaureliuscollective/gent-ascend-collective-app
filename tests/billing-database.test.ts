import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000101';
const otherUser = '00000000-0000-4000-8000-000000000102';
const token = '00000000-0000-4000-8000-000000000201';
const otherToken = '00000000-0000-4000-8000-000000000202';
let person: string;
let other: string;
async function command(name: string, payload: unknown = {}, lease = token, owner = person) {
  await db.exec('set role service_role');
  try {
    return await db.query<{ result: unknown }>(
      'select public.billing_control($1,$2::uuid,$3::uuid,$4::jsonb) as result',
      [name, owner, lease, JSON.stringify(payload)],
    );
  } finally {
    await db.exec('reset role');
  }
}
async function asUser(sql: string, id = user) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated;`);
  await db.exec(
    await readFile('supabase/migrations/20260924150752_202609200001_foundation.sql', 'utf8'),
  );
  await db.exec(
    await readFile('supabase/migrations/20261002105745_founding_membership_billing.sql', 'utf8'),
  );
  await db.exec(`insert into auth.users(id) values('${user}'),('${otherUser}');`);
  const people = await db.query<{ id: string; auth_user_id: string }>(
    'select id,auth_user_id from public.persons',
  );
  person = people.rows.find((row) => row.auth_user_id === user)!.id;
  other = people.rows.find((row) => row.auth_user_id === otherUser)!.id;
});
afterAll(async () => {
  await db.close();
});
describe('provider control SQL and owner isolation', () => {
  it('restricts all provider commands and private receipts to service authority', async () => {
    await command('acquire');
    await command('bind', { customer: 'cus_owner' });
    await command('release');
    await command('acquire', {}, otherToken, other);
    await command('bind', { customer: 'cus_other' }, otherToken, other);
    await command('release', {}, otherToken, other);
    expect((await asUser('select * from public.billing_profiles')).rows).toHaveLength(1);
    expect((await asUser('select * from public.billing_profiles', otherUser)).rows).toHaveLength(1);
    await expect(asUser('select * from public.billing_controls')).rejects.toThrow();
    await expect(asUser('select * from public.billing_event_receipts')).rejects.toThrow();
    await expect(asUser('select * from public.billing_enrollment_receipts')).rejects.toThrow();
    await expect(
      asUser(`select public.billing_control('acquire','${person}','${token}','{}')`),
    ).rejects.toThrow();
    await expect(
      asUser(`update public.billing_profiles set paid_tier='reserve'`),
    ).rejects.toThrow();
    await expect(asUser(`update public.membership_accounts set tier='reserve'`)).rejects.toThrow();
  });
  it('serializes commands and rejects the wrong token or an expired lease', async () => {
    await command('acquire');
    await expect(command('acquire', {}, otherToken)).rejects.toThrow('busy');
    await expect(command('bind', { customer: 'cus_forged' }, otherToken)).rejects.toThrow(
      'expired',
    );
    await db.query(
      "update public.billing_controls set lease_until=now()-interval '1 second' where person_id=$1",
      [person],
    );
    await expect(command('bind', { customer: 'cus_forged' })).rejects.toThrow('expired');
    await command('acquire');
    await command('release');
  });
  it('audits the exact accepted offer and never overwrites the consent receipt on retry', async () => {
    await command('acquire');
    const attempt = {
      id: '00000000-0000-4000-8000-000000000301',
      tier: 'essential',
      price: 'price_essential',
      terms: 'test-v1',
      termsText: 'Synthetic launch terms',
      created: 1790942400,
      expires: 1790946000,
    };
    await command('reserve', attempt);
    await command('reserve', { ...attempt, session: 'cs_owner' });
    expect((await db.query('select * from public.billing_enrollment_receipts')).rows).toHaveLength(
      1,
    );
    expect(
      (
        await db.query<{ terms_text: string }>(
          'select terms_text from public.billing_enrollment_receipts',
        )
      ).rows[0]?.terms_text,
    ).toBe('Synthetic launch terms');
    await command('release');
  });
  it('commits event receipt and membership atomically, keeping beta privileges independent', async () => {
    await db.query('update public.membership_accounts set beta_access=true where person_id=$1', [
      person,
    ]);
    await command('acquire');
    const snapshot = {
      event: 'evt_paid',
      subscription: 'sub_owner',
      tier: 'signature',
      status: 'active',
      billing: 'active',
      until: '2026-11-02T12:00:00Z',
      cancel: false,
      hold: false,
    };
    await command('sync', snapshot);
    await command('sync', { ...snapshot, tier: 'reserve' });
    const row = (
      await db.query<{ tier: string; beta_access: boolean }>(
        'select tier,beta_access from public.membership_accounts where person_id=$1',
        [person],
      )
    ).rows[0];
    expect(row).toEqual({ tier: 'signature', beta_access: true });
    await expect(
      command('sync', { ...snapshot, event: 'evt_bad', tier: 'invented' }),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.billing_event_receipts where event_id='evt_bad'")).rows,
    ).toHaveLength(0);
    await command('sync', {
      ...snapshot,
      event: 'evt_refund',
      billing: 'unpaid',
      until: null,
      hold: true,
      holdKey: 'refund:ch_owner',
      holdValue: true,
    });
    await expect(command('sync', { ...snapshot, event: 'evt_silent_regrant' })).rejects.toThrow(
      'hold mismatch',
    );
    expect(
      (
        await db.query<{ billing_state: string; beta_access: boolean }>(
          'select billing_state,beta_access from public.membership_accounts where person_id=$1',
          [person],
        )
      ).rows[0],
    ).toEqual({ billing_state: 'unpaid', beta_access: true });
    await command('release');
  });
  it('prevents rebinding a customer or sharing one customer between owners', async () => {
    await command('acquire');
    await expect(command('bind', { customer: 'cus_other' })).rejects.toThrow('bound');
    await command('release');
    await command('acquire', {}, otherToken, other);
    await expect(command('bind', { customer: 'cus_owner' }, otherToken, other)).rejects.toThrow();
    await command('release', {}, otherToken, other);
  });
});
