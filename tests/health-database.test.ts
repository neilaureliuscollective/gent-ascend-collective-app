import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
const founder = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}
beforeAll(async () => {
  // Minimal Auth schema is a test adapter, not a Supabase Auth emulator.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text,email_change_token_current text,reauthentication_token text,last_sign_in_at timestamptz default now());
 create table auth.identities(id uuid primary key,user_id uuid,provider_id text,identity_data jsonb,provider text,created_at timestamptz,updated_at timestamptz,unique(provider_id,provider));
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated;`);
  // Only the storage catalog surface used by migrations; this does not emulate Storage APIs.
  await db.exec(`create schema storage;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
   alter table storage.objects enable row level security;
   create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
   grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of (await readdir('supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(await readFile('supabase/seed.sql', 'utf8'));
  await db.exec(
    `insert into public.founder_access(person_id,grant_reason) select id,'Trusted synthetic Health test founder' from public.persons where auth_user_id='${founder}'`,
  );
});

afterAll(async () => {
  await db.close();
});
const record = 'a2000000-0000-4000-8000-000000000001';
const observation = 'a1000000-0000-4000-8000-000000000001';
const value = {
  id: observation,
  name: 'Synthetic test',
  value: '12',
  unit: 'mg/dL',
  date: '2026-10-01',
  code: '',
  specimen: 'serum',
  method: 'synthetic',
  range: '5–15',
  flag: '',
};
function call(kind: string, payload: unknown, request = crypto.randomUUID()) {
  return `select public.health_mutate('${kind}','${request}','${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb)`;
}
describe('Health private schema (SQL emulation, not live Auth/Storage)', () => {
  it('denies ingestion before database activation and disallows direct writes/cross-owner reads', async () => {
    await expect(
      asUser(founder, call('consent', { purpose: 'records', granted: true, adult: true })),
    ).rejects.toThrow(/not activated/);
    await db.exec('update health_private.activation set ingestion=true,ai=true');
    await asUser(founder, call('consent', { purpose: 'records', granted: true, adult: true }));
    await db.exec('update health_private.activation set ingestion=false');
    await expect(
      asUser(
        founder,
        call('reserve', { id: record, title: 'Synthetic report', size: 30, mime: 'text/csv' }),
      ),
    ).rejects.toThrow(/not activated/);
    await db.exec('update health_private.activation set ingestion=true,ai=true');
    const req = crypto.randomUUID(),
      payload = { id: record, title: 'Synthetic report', size: 30, mime: 'text/csv' };
    await asUser(founder, call('reserve', payload, req));
    await asUser(founder, call('reserve', payload, req));
    await expect(
      asUser(founder, call('reserve', { ...payload, title: 'changed' }, req)),
    ).rejects.toThrow(/request changed/);
    expect((await asUser(member, 'select * from health_private.records')).rows).toHaveLength(0);
    await expect(
      asUser(
        member,
        call('finalize', {
          id: record,
          expected: 1,
          hash: 'a'.repeat(64),
          status: 'review_required',
          candidates: [value],
        }),
      ),
    ).rejects.toThrow(/consent/);
    await expect(
      asUser(founder, `delete from health_private.records where id='${record}'`),
    ).rejects.toThrow(/permission/);
    await expect(
      asUser(
        founder,
        call('finalize', {
          id: record,
          hash: 'a'.repeat(64),
          status: 'review_required',
          candidates: [value],
        }),
      ),
    ).rejects.toThrow(/Expected version/);
    await asUser(
      founder,
      call('finalize', {
        id: record,
        expected: 1,
        hash: 'a'.repeat(64),
        status: 'review_required',
        candidates: [value],
      }),
    );
  });
  it('does not derive sensitive beta capability from a paid Health tier', async () => {
    await db.exec(
      `update public.membership_accounts set tier='health',billing_state='active',access_until=now()+interval '1 month' where person_id=(select id from public.persons where auth_user_id='${member}')`,
    );
    const state = (await asUser(member, 'select public.health_read()')).rows[0] as {
      health_read: { activation: { ingestion: boolean } };
    };
    expect(state.health_read.activation.ingestion).toBe(false);
    await expect(
      asUser(member, call('consent', { purpose: 'records', granted: true, adult: true })),
    ).rejects.toThrow(/beta capability/);
  });
  it('confirms atomically, rejects stale writes and retains correction history', async () => {
    await expect(
      asUser(founder, call('confirm', { id: record, expected: 1, observations: [value] })),
    ).rejects.toThrow(/changed/);
    await asUser(founder, call('confirm', { id: record, expected: 2, observations: [value] }));
    await asUser(
      founder,
      call('amend', {
        id: observation,
        expected: 1,
        observation: { ...value, value: '13' },
        reason: 'Synthetic correction',
        excluded: false,
      }),
    );
    expect((await asUser(founder, 'select * from health_private.revisions')).rows).toHaveLength(1);
    await expect(
      asUser(
        founder,
        call('amend', {
          id: observation,
          expected: 1,
          observation: value,
          reason: 'Stale correction',
          excluded: false,
        }),
      ),
    ).rejects.toThrow(/changed/);
    expect((await asUser(member, 'select public.health_read()')).rows[0]).toBeDefined();
    expect((await asUser(member, 'select * from health_private.observations')).rows).toHaveLength(
      0,
    );
  });
  it('binds AI evidence to consent/version and prevents replay or saving after revocation', async () => {
    await asUser(founder, call('consent', { purpose: 'ai', granted: true, adult: true }));
    const request = crypto.randomUUID(),
      payload = {
        question: 'Explain this synthetic result',
        evidence: [observation],
        consentVersion: 1,
      };
    await asUser(founder, call('ask_begin', payload, request));
    await expect(asUser(founder, call('ask_begin', payload, request))).rejects.toThrow(
      /already started/,
    );
    await asUser(founder, call('consent', { purpose: 'ai', granted: false, adult: true }));
    await expect(
      asUser(
        founder,
        call('ask_finish', { id: request, status: 'complete', answer: 'Must not save' }),
      ),
    ).rejects.toThrow(/unavailable/);
    expect((await asUser(founder, 'select answer from health_private.turns')).rows[0]).toEqual({
      answer: '',
    });
  });
  it('denies stale authentication and anonymous/service operations', async () => {
    await db.exec(
      `update auth.users set last_sign_in_at=now()-interval '1 hour' where id='${founder}'`,
    );
    await expect(asUser(founder, call('export', {}))).rejects.toThrow(/Recent/);
    await db.exec(`update auth.users set last_sign_in_at=now() where id='${founder}'`);
    await db.exec('set role anon');
    try {
      await expect(db.query('select public.health_read()')).rejects.toThrow(/permission/);
    } finally {
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    try {
      await expect(db.query('select * from health_private.records')).rejects.toThrow(/permission/);
    } finally {
      await db.exec('reset role');
    }
  });
  it('enforces Storage ownership and refuses deletion completion while originals remain', async () => {
    const path = `${founder}/${record}/original`;
    await db.exec(
      `insert into storage.objects(bucket_id,name) values('aethelios-health','${path}')`,
    );
    expect(
      (await asUser(member, "select * from storage.objects where bucket_id='aethelios-health'"))
        .rows,
    ).toHaveLength(0);
    const job = crypto.randomUUID();
    await asUser(founder, call('delete', { id: record }, job));
    await expect(asUser(member, call('claim', { id: job }))).rejects.toThrow(/unavailable/);
    const claimed = await asUser(founder, call('claim', { id: job }));
    const lease = (claimed.rows[0] as { health_mutate: { lease: string } }).health_mutate.lease;
    await expect(asUser(founder, call('finish_job', { id: job, lease }))).rejects.toThrow(
      /originals/,
    );
    await asUser(founder, `delete from storage.objects where name='${path}'`);
    await asUser(founder, call('finish_job', { id: job, lease }));
    await asUser(founder, call('delete', { id: record }, job));
    await expect(
      asUser(
        founder,
        call('reserve', { id: record, title: 'Must not resurrect', mime: 'text/csv', size: 30 }),
      ),
    ).rejects.toThrow(/restored/);
    expect((await asUser(founder, 'select * from health_private.records')).rows).toHaveLength(0);
    expect((await asUser(founder, 'select * from health_private.revisions')).rows).toHaveLength(0);
    expect((await asUser(founder, 'select * from health_private.turns')).rows).toHaveLength(0);
  });
  it('persists owner workspaces, rejects exact-request payload changes, and hides them from another account', async () => {
    const id = 'a3000000-0000-4000-8000-000000000001';
    const request = 'a3000000-0000-4000-8000-000000000002';
    const settings = {
      presentation: {
        density: 'comfortable',
        arrangement: 'sequence',
        dateRange: false,
        comparisonDrawer: false,
        accent: 'quiet',
      },
    };
    const payload = {
      id,
      expected: 1,
      foundation: 'evening-routine',
      title: 'Evenings, made usable',
      sample: false,
      settings,
      progress: {
        constraint: { availableMinutes: 20, finishAt: '18:00', selected: ['cook-main'] },
        accepted: {},
        pending: null,
        timer: null,
        completed: [],
        notes: {},
        activeStepId: null,
      },
      architect: null,
      open: true,
    };
    await asUser(founder, call('workspace_save', payload, request));
    await asUser(founder, call('workspace_save', payload, request));
    await expect(
      asUser(founder, call('workspace_save', { ...payload, title: 'Changed' }, request)),
    ).rejects.toThrow(/request changed/);
    expect((await asUser(member, 'select * from health_private.workspaces')).rows).toHaveLength(0);
    const read = (await asUser(member, 'select public.health_read()')).rows[0] as {
      health_read: { workspaces: unknown[] };
    };
    expect(read.health_read.workspaces).toEqual([]);
    await expect(
      asUser(
        member,
        call('workspace_save', { ...payload, id: 'a3000000-0000-4000-8000-000000000009' }),
      ),
    ).resolves.toBeTruthy();
    const bridge = crypto.randomUUID();
    const issued = await asUser(
      founder,
      call(
        'workspace_bridge',
        { id, expected: 1, action: 'issue', fields: ['name', 'value'] },
        bridge,
      ),
    );
    const token = (issued.rows[0] as { health_mutate: { token: string } }).health_mutate.token;
    await expect(asUser(member, `select public.health_bridge_read('${token}')`)).rejects.toThrow(
      /unavailable/,
    );
    await asUser(founder, call('workspace_bridge', { id, expected: 1, action: 'revoke' }));
    await expect(asUser(founder, `select public.health_bridge_read('${token}')`)).rejects.toThrow(
      /unavailable/,
    );
  });
});
