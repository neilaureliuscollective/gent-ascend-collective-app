// Actual migration SQL in PGlite; not real Supabase Auth/PostgREST acceptance.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const db = new PGlite();
const owner = 'f2000000-0000-4000-8000-000000000001';
const first = 'f1000000-0000-4000-8000-000000000001';
const second = 'f1000000-0000-4000-8000-000000000002';
const active = 'f1000000-0000-4000-8000-000000000003';
const ended = 'f1000000-0000-4000-8000-000000000004';
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create table public.ai_live_sessions(id uuid primary key,person_id uuid,call_id text,call_tag text,expires_at timestamptz,ended_at timestamptz,reason text,input_tokens bigint default 0,output_tokens bigint default 0);`);
  await db.exec(
    await readFile('supabase/migrations/20261012041646_live_expiry_leases.sql', 'utf8'),
  );
  await db.exec(`insert into public.ai_live_sessions(id,person_id,call_id,call_tag,expires_at,input_tokens) values
  ('${first}','${owner}','rtc_one',repeat('a',64),now()-interval '1 minute',17),
  ('${second}','${owner}','rtc_two',repeat('a',64),now()-interval '1 minute',0),
  ('${active}','${owner}','rtc_active',repeat('a',64),now()+interval '1 hour',0);`);
  await db.exec(`insert into public.ai_live_sessions(id,person_id,call_id,call_tag,expires_at,ended_at,reason)
    values('${ended}','${owner}','rtc_ended',repeat('a',64),now()-interval '1 minute',now(),'ended');`);
});
afterAll(() => db.close());
it('caps each batch while leaving remaining calls available to another worker', async () => {
  for (let i = 1; i <= 6; i++) {
    const id = `f4000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    await db.query(
      `insert into public.ai_live_sessions(id,person_id,call_id,call_tag,expires_at)
      values($1,$2,'rtc_batch',repeat('a',64),now()-interval '1 minute')`,
      [id, owner],
    );
  }
  const firstBatch = (await worker<{ id: string }>('select * from public.ai_live_claim_expired()'))
    .rows;
  expect(firstBatch.length).toBe(5);
  const secondBatch = (await worker<{ id: string }>('select * from public.ai_live_claim_expired()'))
    .rows;
  expect(secondBatch.every((x) => !firstBatch.some((y) => y.id === x.id))).toBe(true);
  await db.exec("delete from public.ai_live_sessions where id::text like 'f4000000%'");
  // Leave original fixture leases available for the recovery assertions below.
  await db.exec('delete from live_private.expiry_leases');
});
async function worker<T>(sql: string) {
  await db.exec('set role service_role');
  try {
    return await db.query<T>(sql);
  } finally {
    await db.exec('reset role');
  }
}
it('denies both ordinary roles access to worker functions and private leases', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query('select * from public.ai_live_claim_expired()')).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query(`select public.ai_live_confirm_expired('${first}','${owner}')`),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query('select * from live_private.expiry_leases')).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec('reset role');
    }
  }
});
it('leases expired calls once, recovers after worker loss and rejects an old lease', async () => {
  const claims = (
    await worker<{ id: string; lease_token: string }>(
      'select * from public.ai_live_claim_expired()',
    )
  ).rows;
  expect(claims.map((x) => x.id).sort()).toEqual([first, second, ended]);
  expect((await worker('select * from public.ai_live_claim_expired()')).rows).toEqual([]);
  const lease = claims.find((x) => x.id === first)!;
  expect(
    (await worker(`select public.ai_live_confirm_expired('${first}','${owner}') as confirmed`))
      .rows,
  ).toEqual([{ confirmed: false }]);
  await db.exec(
    `update live_private.expiry_leases set leased_until=now()-interval '1 second' where session_id='${first}'`,
  );
  const reclaimed = (
    await worker<{ id: string; lease_token: string }>(
      'select * from public.ai_live_claim_expired()',
    )
  ).rows[0]!;
  expect(reclaimed.id).toBe(first);
  expect(reclaimed.lease_token).not.toBe(lease.lease_token);
  expect(
    (
      await worker(
        `select public.ai_live_confirm_expired('${first}','${lease.lease_token}') as confirmed`,
      )
    ).rows,
  ).toEqual([{ confirmed: false }]);
  expect(
    (
      await worker(
        `select public.ai_live_confirm_expired('${first}','${reclaimed.lease_token}') as confirmed`,
      )
    ).rows,
  ).toEqual([{ confirmed: true }]);
  const saved = (
    await db.query<{ input_tokens: number; reason: string }>(
      'select input_tokens,reason from public.ai_live_sessions where id=$1',
      [first],
    )
  ).rows[0];
  expect(Number(saved?.input_tokens)).toBe(17);
  expect(saved?.reason).toBe('expired');
  const endedLease = claims.find((x) => x.id === ended)!;
  await worker(`select public.ai_live_confirm_expired('${ended}','${endedLease.lease_token}')`);
  expect(
    (await db.query('select reason from public.ai_live_sessions where id=$1', [ended])).rows,
  ).toEqual([{ reason: 'ended' }]);
  expect(
    (
      await worker(
        `select public.ai_live_confirm_expired('${active}','${reclaimed.lease_token}') as confirmed`,
      )
    ).rows,
  ).toEqual([{ confirmed: false }]);
});
