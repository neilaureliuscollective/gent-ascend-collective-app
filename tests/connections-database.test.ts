import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const connection = '00000000-0000-4000-8000-000000000003';
const flow = '00000000-0000-4000-8000-000000000004';

async function asUser(id: string | null, sql: string) {
  if (id) {
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`,
    );
  } else {
    await db.exec('set role anon');
  }
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create table public.persons(id uuid primary key, auth_user_id uuid);
    insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
    grant select on public.persons to authenticated;
    create table public.founder_access(person_id uuid primary key, grant_reason text);
    insert into public.founder_access values('${owner}','Synthetic Connections founder');
    grant select on public.founder_access to authenticated;`);
  await db.exec(
    await readFile('supabase/migrations/20261013183000_service_connections.sql', 'utf8'),
  );
});
afterAll(() => db.close());

describe('Connections SQL owner policy (PGlite; not Supabase Auth)', () => {
  it('persists owner metadata, hides secrets from table grants, and denies foreign/anonymous access', async () => {
    const begin = await asUser(
      owner,
      `select public.service_connection_begin_flow('${flow}','github','state-token-aaaaaaaaaaaa','nonce-token-aaaaaaaaaaaa','verifier-token-aaaaaaaaaa', now() + interval '10 minutes') as ok`,
    );
    expect(begin.rows).toEqual([{ ok: true }]);
    await asUser(
      owner,
      `select public.service_connection_upsert('${connection}','github','connected','neil','7','42','99','owner/repo','{"writes":false}'::jsonb, now(), null)`,
    );
    await asUser(
      owner,
      `select public.service_connection_put_secret('${connection}','${'c'.repeat(40)}')`,
    );
    expect(
      (await asUser(owner, `select account_login from public.service_connections`)).rows,
    ).toEqual([{ account_login: 'neil' }]);
    await expect(
      asUser(owner, `select ciphertext from public.service_connection_secrets`),
    ).rejects.toThrow(/permission denied/);
    expect(
      (await asUser(foreign, `select account_login from public.service_connections`)).rows,
    ).toEqual([]);
    await expect(
      asUser(foreign, `select public.service_connection_read('github')`),
    ).rejects.toThrow(/Founder access required/);
    await expect(asUser(null, `select * from public.service_connections`)).rejects.toThrow(
      /permission denied/,
    );
    expect(
      (await asUser(owner, `select public.service_connection_clear('github') as ok`)).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (await asUser(owner, `select public.service_connection_read('github') as row`)).rows,
    ).toEqual([{ row: null }]);
  });

  it('consumes a flow once and deduplicates webhook deliveries', async () => {
    await asUser(
      owner,
      `select public.service_connection_begin_flow('00000000-0000-4000-8000-000000000005','vercel','state-token-bbbbbbbbbbbb','nonce-token-bbbbbbbbbbbb','verifier-token-bbbbbbbbbb', now() + interval '10 minutes')`,
    );
    expect(
      (
        await asUser(
          owner,
          `select public.service_connection_consume_flow('state-token-bbbbbbbbbbbb', now()) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asUser(
          owner,
          `select public.service_connection_consume_flow('state-token-bbbbbbbbbbbb', now()) as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    expect(
      (
        await db.query(
          `select public.service_connection_record_event('github','delivery-1234') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await db.query(
          `select public.service_connection_record_event('github','delivery-1234') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
  });
});
