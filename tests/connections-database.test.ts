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
      `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claim.role','authenticated',false)`,
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

async function asBroker(sql: string) {
  await db.exec(`select set_config('request.jwt.claim.role','service_role',false)`);
  try {
    await db.exec('set role service_role');
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
    await db.exec(`select set_config('request.jwt.claim.role','',false)`);
  }
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role;
    create table public.persons(id uuid primary key, auth_user_id uuid);
    insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
    grant select on public.persons to authenticated;
    create table public.founder_access(person_id uuid primary key, grant_reason text);
    insert into public.founder_access values('${owner}','Synthetic Connections founder');
    grant select on public.founder_access to authenticated;`);
  await db.exec(
    await readFile('supabase/migrations/20261013183000_service_connections.sql', 'utf8'),
  );
  await db.exec(
    await readFile('supabase/migrations/20261013194500_connection_trusted_writes.sql', 'utf8'),
  );
});
afterAll(() => db.close());

describe('Connections SQL owner policy (PGlite; not Supabase Auth)', () => {
  it('denies authenticated founders forging verified identity or swapping installations', async () => {
    const begin = await asUser(
      owner,
      `select public.service_connection_begin_flow('${flow}','github','state-token-aaaaaaaaaaaa','nonce-token-aaaaaaaaaaaa','verifier-token-aaaaaaaaaa', now() + interval '10 minutes') as ok`,
    );
    expect(begin.rows).toEqual([{ ok: true }]);
    await expect(
      asUser(
        owner,
        `select public.service_connection_upsert('${owner}','${connection}','github','connected','neil','7','999','99','forged/repo','{"writes":false}'::jsonb, now(), null, 'active')`,
      ),
    ).rejects.toThrow(/permission denied|Trusted connection broker required/);
    await expect(
      asUser(
        owner,
        `select public.service_connection_put_secret('${owner}','${connection}','${'c'.repeat(40)}')`,
      ),
    ).rejects.toThrow(/permission denied|Trusted connection broker required/);
    await expect(
      asUser(
        owner,
        `select public.service_connection_claim_install('${owner}','state-token-aaaaaaaaaaaa','999')`,
      ),
    ).rejects.toThrow(/permission denied|Trusted connection broker required/);
    expect(
      (
        await asBroker(
          `select public.service_connection_upsert('${owner}','${connection}','github','connecting','neil','7','42',null,null,'{}'::jsonb, null, null, 'active') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asUser(
          owner,
          `select public.service_connection_set_selection('github','99','owner/repo') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    const intent = await asUser(
      owner,
      `select status, selected_name, last_verified_at, installation_id from public.service_connections`,
    );
    expect(intent.rows).toEqual([
      {
        status: 'connecting',
        selected_name: 'owner/repo',
        last_verified_at: null,
        installation_id: '42',
      },
    ]);
    expect(
      (
        await asBroker(
          `select public.service_connection_upsert('${owner}','${connection}','github','connected','neil','7','42','99','owner/repo','{"writes":false}'::jsonb, now(), null, 'active') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    await expect(
      asUser(
        owner,
        `select public.service_connection_upsert('${owner}','${connection}','github','connected','neil','7','999','99','swapped/repo','{"writes":true}'::jsonb, now(), null, 'active')`,
      ),
    ).rejects.toThrow(/permission denied|Trusted connection broker required/);
    expect(
      (await asUser(owner, `select installation_id, status from public.service_connections`)).rows,
    ).toEqual([{ installation_id: '42', status: 'connected' }]);
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

  it('consumes a flow once, deduplicates deliveries, and keeps user revocation distinct', async () => {
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
        await asBroker(
          `select public.service_connection_record_event('github','delivery-1234') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asBroker(
          `select public.service_connection_record_event('github','delivery-1234') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    await asBroker(
      `select public.service_connection_upsert('${owner}','${connection}','github','connected','neil','7','42','99','owner/repo','{}'::jsonb, now(), null, 'active')`,
    );
    await asBroker(
      `select public.service_connection_put_secret('${owner}','${connection}','${'c'.repeat(40)}')`,
    );
    expect(
      (
        await asBroker(
          `select public.service_connection_apply_account('github','7','expired','GitHub user authorization was revoked.') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect(
      (
        await asUser(
          owner,
          `select status, user_authorization, installation_id from public.service_connections`,
        )
      ).rows,
    ).toEqual([{ status: 'expired', user_authorization: 'revoked', installation_id: '42' }]);
    expect(
      (
        await asBroker(
          `select public.service_connection_take_secret('${owner}','${connection}') as secret`,
        )
      ).rows,
    ).toEqual([{ secret: null }]);
    await expect(
      asBroker(
        `select public.service_connection_apply_account('github','7','revoked','must stay distinct')`,
      ),
    ).rejects.toThrow(/cannot mark an installation deleted/);
    expect(
      (
        await asBroker(
          `select public.service_connection_apply_status('github','42','revoked','The GitHub App installation was removed.') as ok`,
        )
      ).rows,
    ).toEqual([{ ok: true }]);
    expect((await asUser(owner, `select status from public.service_connections`)).rows).toEqual([
      { status: 'revoked' },
    ]);
  });
});
