// Real disk-backed SQL using the repository migration chain; Auth/Storage remain test adapters.
import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VoiceLedger } from '@/domains/live/ledger';
it('persists typed and spoken turns with context consent across a database close/reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'live-founder-synthetic-'));
  let db = new PGlite(directory);
  const founder = '00000000-0000-4000-8000-000000000001';
  const member = '00000000-0000-4000-8000-000000000002';
  const conversation = 'f8000000-0000-4000-8000-000000000001';
  async function user<T>(identity: string, sql: string, params: unknown[] = []) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [identity]);
    await db.exec('set role authenticated');
    try {
      return await db.query<T>(sql, params);
    } finally {
      await db.exec('reset role');
    }
  }
  try {
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
    const typed = crypto.randomUUID();
    await user(founder, 'select public.ai_begin_turn($1,$2,$3,$4,$5,$6)', [
      conversation,
      typed,
      'Synthetic typed context',
      'gpt-realtime',
      false,
      'synthetic-test',
    ]);
    await user(founder, 'select public.ai_finish_turn($1,$2,$3,$4,$5)', [
      typed,
      'Synthetic typed answer',
      'complete',
      2,
      3,
    ]);
    const ledger = new VoiceLedger();
    const save = async (turn: import('@/domains/live/ledger').RecordedVoiceTurn) => {
      const request = crypto.randomUUID();
      await user(founder, 'select public.ai_begin_turn($1,$2,$3,$4,$5,$6)', [
        conversation,
        request,
        turn.user,
        'gpt-realtime',
        true,
        'synthetic-test',
      ]);
      await user(founder, 'select public.ai_finish_turn($1,$2,$3,$4,$5)', [
        request,
        turn.assistant,
        turn.status,
        turn.input,
        turn.output,
      ]);
    };
    for (const event of [
      { type: 'input_audio_buffer.committed', item_id: 'voice' },
      { type: 'response.created', response: { id: 'answer' } },
      {
        type: 'response.done',
        response: {
          id: 'answer',
          status: 'completed',
          output: [{ content: [{ transcript: 'Synthetic voice answer' }] }],
        },
      },
      { type: 'output_audio_buffer.stopped', response_id: 'answer' },
      {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'voice',
        transcript: 'Synthetic spoken continuation',
      },
    ])
      await ledger.accept(event, save);
    await db.close();
    db = new PGlite(directory);
    const sql =
      'select user_text,assistant_text,context_included,status from public.ai_turns where conversation_id=$1 order by created_at,id';
    expect((await user(founder, sql, [conversation])).rows).toEqual([
      {
        user_text: 'Synthetic typed context',
        assistant_text: 'Synthetic typed answer',
        context_included: false,
        status: 'complete',
      },
      {
        user_text: 'Synthetic spoken continuation',
        assistant_text: 'Synthetic voice answer',
        context_included: true,
        status: 'complete',
      },
    ]);
    expect((await user(member, sql, [conversation])).rows).toEqual([]);
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
