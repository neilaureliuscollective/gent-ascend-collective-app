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

describe('migration, seeds and owner security', () => {
  it('versions confirmed Ascend Profile facts and isolates history between users', async () => {
    const first='84000000-0000-4000-8000-000000000001';
    const second='84000000-0000-4000-8000-000000000002';
    const call=(request:string,value:string,version:number)=>`select public.ascend_profile_confirm('${request}','direction','${value}',${version},'ai_proposal','My own answer') as version`;
    expect((await asUser<{version:number}>(founder,call(first,'Build a steady life',0))).rows[0]?.version).toBe(1);
    expect((await asUser<{version:number}>(founder,call(first,'Build a steady life',0))).rows[0]?.version).toBe(1);
    expect((await asUser<{version:number}>(founder,call(second,'Grow the company with discipline',1))).rows[0]?.version).toBe(2);
    await expect(asUser(founder,`select public.ascend_profile_confirm('84000000-0000-4000-8000-000000000003','direction','Old truth',1,'user',null)`)).rejects.toThrow();
    expect((await asUser<{value:string}>(founder,"select value from public.ascend_profile_facts where fact_key='direction'")).rows[0]?.value).toBe('Grow the company with discipline');
    expect((await asUser<{old_value:string|null;new_value:string}>(founder,"select old_value,new_value from public.ascend_profile_revisions order by new_version")).rows.map(row=>row.old_value)).toEqual([null,'Build a steady life']);
    expect((await asUser(member,'select * from public.ascend_profile_facts')).rows).toHaveLength(0);
    expect((await asUser(member,'select * from public.ascend_profile_revisions')).rows).toHaveLength(0);
    await expect(asUser(member,`select public.ascend_profile_confirm('${first}','direction','Intrusion',2,'user',null)`)).rejects.toThrow();
    await expect(asUser(founder,"update public.ascend_profile_facts set value='Bypass'")).rejects.toThrow();
    expect((await asUser<{version:number}>(founder,`select public.ascend_profile_confirm('84000000-0000-4000-8000-000000000004','direction',null,2,'user',null) as version`)).rows[0]?.version).toBe(3);
    expect((await asUser<{value:string|null}>(founder,"select value from public.ascend_profile_facts where fact_key='direction'")).rows[0]?.value).toBeNull();
  });
  it('reserves a proposal in the existing owner-only AI usage ledger',async()=>{
    const id='85000000-0000-4000-8000-000000000001';
    await asUser(founder,`select public.ai_reserve_proposal('${id}')`);
    expect((await asUser(founder,`select id from public.ai_usage where id='${id}'`)).rows).toHaveLength(1);
    expect((await asUser(member,`select id from public.ai_usage where id='${id}'`)).rows).toHaveLength(0);
    await expect(asUser(founder,`select public.ai_reserve_proposal('${id}')`)).rejects.toThrow();
    // Isolate this fixture from the existing chat quota assertions below.
    await db.exec(`delete from public.ai_usage where id='${id}'`);
  });
  it('keeps captured thoughts owner-scoped and prevents ownership changes', async () => {
    const capture = '83000000-0000-4000-8000-000000000001';
    const own = `(select id from public.persons where auth_user_id='${founder}')`;
    await asUser(founder, `insert into public.life_captures(id,person_id,content) values('${capture}',${own},'Rethink membership')`);
    expect((await asUser(founder, `select * from public.life_captures where id='${capture}'`)).rows).toHaveLength(1);
    expect((await asUser(member, `select * from public.life_captures where id='${capture}'`)).rows).toHaveLength(0);
    expect((await asUser(member, `update public.life_captures set status='acted' where id='${capture}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(member, `insert into public.life_captures(id,person_id,content) values('83000000-0000-4000-8000-000000000002',${own},'Intrusion')`)).rejects.toThrow();
    await expect(asUser(founder, `update public.life_captures set person_id=${own} where id='${capture}'`)).rejects.toThrow();
    await expect(asUser(founder, `delete from public.life_captures where id='${capture}'`)).rejects.toThrow();
  });
  it('keeps founder grants owner-readable and unavailable to member writes', async () => {
    expect((await asUser(founder, 'select * from public.founder_access')).rows).toHaveLength(0);
    await expect(asUser(founder, `insert into public.founder_access(person_id,grant_reason) values((select id from public.persons where auth_user_id='${founder}'),'Self promotion')`)).rejects.toThrow();
    await db.exec(`insert into public.founder_access(person_id,grant_reason) values((select id from public.persons where auth_user_id='${founder}'),'Trusted founder grant')`);
    expect((await asUser(founder, 'select * from public.founder_access')).rows).toHaveLength(1);
    expect((await asUser(member, 'select * from public.founder_access')).rows).toHaveLength(0);
    await expect(asUser(member, 'delete from public.founder_access')).rejects.toThrow();
  });
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

describe('Aethelios private records and generation limits', () => {
  const chat = '30000000-0000-4000-8000-000000000001';
  const request = '40000000-0000-4000-8000-000000000001';
  const memory = '50000000-0000-4000-8000-000000000001';
  const begin = (id: string, conversation = chat) =>
    `select public.ai_begin_turn('${conversation}','${id}','Help me think','gpt-6-astra',true,'test-v1')`;
  it('saves explicit memory, rejects stale correction and isolates the other person', async () => {
    await asUser(
      founder,
      `select public.ai_save_memory('${memory}','Prefer concise answers','preference',0)`,
    );
    expect((await asUser(member, 'select * from public.ai_memories')).rows).toHaveLength(0);
    await expect(
      asUser(member, `select public.ai_save_memory('${memory}','Overwrite','fact',1)`),
    ).rejects.toThrow();
    const corrected = await asUser<{ ai_save_memory: number }>(
      founder,
      `select public.ai_save_memory('${memory}','Prefer direct answers','preference',1)`,
    );
    expect(corrected.rows[0]?.ai_save_memory).toBe(2);
    await expect(
      asUser(founder, `select public.ai_save_memory('${memory}','Stale','preference',1)`),
    ).rejects.toThrow();
    await expect(
      asUser(
        founder,
        "insert into public.ai_memories(id,person_id,content,kind) values(gen_random_uuid(),(select id from public.persons),'Bypass','fact')",
      ),
    ).rejects.toThrow();
  });
  it('reserves a request once and forbids concurrent replies', async () => {
    await asUser(founder, begin(request));
    expect((await asUser(founder, 'select * from public.ai_turns')).rows).toHaveLength(1);
    await expect(asUser(founder, begin(request))).rejects.toThrow();
    await expect(asUser(founder, begin('40000000-0000-4000-8000-000000000002'))).rejects.toThrow();
    expect((await asUser(founder, 'select * from public.ai_usage')).rows).toHaveLength(1);
  });
  it('prevents cross-user conversation reads, writes and completion', async () => {
    for (const table of ['ai_conversations', 'ai_turns', 'ai_usage'])
      expect((await asUser(member, `select * from public.${table}`)).rows).toHaveLength(0);
    await expect(asUser(member, begin('40000000-0000-4000-8000-000000000003'))).rejects.toThrow();
    expect(
      (
        await asUser<{ ai_finish_turn: boolean }>(
          member,
          `select public.ai_finish_turn('${request}','Intruder','complete')`,
        )
      ).rows[0]?.ai_finish_turn,
    ).toBe(false);
    expect(
      (await asUser(member, `delete from public.ai_conversations where id='${chat}' returning id`))
        .rows,
    ).toHaveLength(0);
    await expect(
      asUser(founder, "update public.ai_turns set assistant_text='Direct spoof'"),
    ).rejects.toThrow();
    await db.exec('set role anon');
    try {
      await expect(db.query(begin('40000000-0000-4000-8000-000000000004'))).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
  });
  it('finalizes once, records usage and permits feedback without changing the reply', async () => {
    await expect(
      asUser(founder, `select public.ai_finish_turn('${request}','','complete')`),
    ).rejects.toThrow();
    expect(
      (
        await asUser<{ ai_finish_turn: boolean }>(
          founder,
          `select public.ai_finish_turn('${request}','A considered next step.','complete',100,20)`,
        )
      ).rows[0]?.ai_finish_turn,
    ).toBe(true);
    expect(
      (
        await asUser<{ ai_finish_turn: boolean }>(
          founder,
          `select public.ai_finish_turn('${request}','Overwrite','complete')`,
        )
      ).rows[0]?.ai_finish_turn,
    ).toBe(false);
    await asUser(founder, `update public.ai_turns set feedback='helpful' where id='${request}'`);
    expect(
      (await asUser<{ input_tokens: number }>(founder, 'select input_tokens from public.ai_usage'))
        .rows[0]?.input_tokens,
    ).toBe(100);
  });
  it('deletes content without erasing rate limits or reviving a request', async () => {
    await asUser(founder, `delete from public.ai_conversations where id='${chat}'`);
    expect((await asUser(founder, 'select * from public.ai_turns')).rows).toHaveLength(0);
    expect((await asUser(founder, 'select * from public.ai_usage')).rows).toHaveLength(1);
    expect((await asUser(founder, 'select * from public.ai_memories')).rows).toHaveLength(1);
    await expect(asUser(founder, begin(request))).rejects.toThrow();
    expect(
      (
        await asUser<{ ai_finish_turn: boolean }>(
          founder,
          `select public.ai_finish_turn('${request}','Resurrect','complete')`,
        )
      ).rows[0]?.ai_finish_turn,
    ).toBe(false);
    expect(
      (
        await asUser<{ ai_delete_memory: boolean }>(
          member,
          `select public.ai_delete_memory('${memory}',2)`,
        )
      ).rows[0]?.ai_delete_memory,
    ).toBe(false);
    expect(
      (
        await asUser<{ ai_delete_memory: boolean }>(
          founder,
          `select public.ai_delete_memory('${memory}',1)`,
        )
      ).rows[0]?.ai_delete_memory,
    ).toBe(false);
    expect(
      (
        await asUser<{ ai_delete_memory: boolean }>(
          founder,
          `select public.ai_delete_memory('${memory}',2)`,
        )
      ).rows[0]?.ai_delete_memory,
    ).toBe(true);
  });
  it('expires abandoned requests and prevents old completion from overwriting', async () => {
    const abandoned = '40000000-0000-4000-8000-000000000010';
    const next = '40000000-0000-4000-8000-000000000011';
    await asUser(founder, begin(abandoned));
    await db.exec(
      `update public.ai_turns set created_at=now()-interval '3 minutes' where id='${abandoned}'`,
    );
    await asUser(founder, begin(next));
    expect(
      (
        await asUser<{ status: string }>(
          founder,
          `select status from public.ai_turns where id='${abandoned}'`,
        )
      ).rows[0]?.status,
    ).toBe('failed');
    expect(
      (
        await asUser<{ ai_finish_turn: boolean }>(
          founder,
          `select public.ai_finish_turn('${abandoned}','Late result','complete')`,
        )
      ).rows[0]?.ai_finish_turn,
    ).toBe(false);
    await asUser(founder, `select public.ai_finish_turn('${next}','Partial','cancelled')`);
  });
  it('enforces a durable per-person rolling request ceiling', async () => {
    await db.exec(
      `insert into public.ai_usage(id,person_id,created_at) select gen_random_uuid(),(select id from public.persons where auth_user_id='${member}'),now()-interval '2 hours' from generate_series(1,120)`,
    );
    await expect(
      asUser(
        member,
        begin('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000002'),
      ),
    ).rejects.toThrow('Usage limit');
    await expect(asUser(member, 'delete from public.ai_usage')).rejects.toThrow();
  });
});

describe('daily records: transactional snapshots and ownership', () => {
  const today = "(current_timestamp at time zone 'America/Chicago')::date";
  const actions = JSON.stringify([
    { id: '62000000-0000-4000-8000-000000000001', title: 'One deliberate step', done: false },
  ]);
  const save = (version: number, energy = '4', value = actions, date = today) =>
    `select public.daily_save(${date},${version},${energy},450,'A meaningful day','', '${value}'::jsonb)`;
  it('creates an owned day and actions atomically, then rejects stale writes', async () => {
    expect((await asUser<{ daily_save: number }>(founder, save(0))).rows[0]?.daily_save).toBe(1);
    expect(
      (await asUser(founder, `select * from public.daily_actions where day=${today}`)).rows,
    ).toHaveLength(1);
    await expect(asUser(founder, save(0))).rejects.toThrow('changed');
    expect((await asUser<{ daily_save: number }>(founder, save(1))).rows[0]?.daily_save).toBe(2);
  });
  it('denies other-person reads, direct writes and anonymous operations', async () => {
    expect((await asUser(member, 'select * from public.daily_entries')).rows).toHaveLength(0);
    expect((await asUser(member, 'select * from public.daily_actions')).rows).toHaveLength(0);
    await expect(asUser(founder, 'update public.daily_entries set energy=5')).rejects.toThrow();
    await expect(asUser(member, 'delete from public.daily_actions')).rejects.toThrow();
    await db.exec('set role anon');
    try {
      await expect(db.query(save(0))).rejects.toThrow();
      await expect(db.query('select * from public.daily_entries')).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
  });
  it('rolls back invalid action batches and rejects invalid observations and a stale local date', async () => {
    const duplicate = JSON.stringify(
      Array(2).fill({
        id: '62000000-0000-4000-8000-000000000001',
        title: 'Duplicate',
        done: false,
      }),
    );
    await expect(asUser(founder, save(2, '4', duplicate))).rejects.toThrow();
    await expect(asUser(founder, save(2, '6'))).rejects.toThrow();
    await expect(asUser(founder, save(2, '4', actions, `${today}-1`))).rejects.toThrow(
      'local day changed',
    );
    expect(
      (
        await asUser<{ version: number }>(
          founder,
          `select version from public.daily_entries where day=${today}`,
        )
      ).rows[0]?.version,
    ).toBe(2);
    expect(
      (await asUser(founder, `select * from public.daily_actions where day=${today}`)).rows,
    ).toHaveLength(1);
  });
});

describe('confirmed Aethelios action boundary',()=>{
  const conversation='86000000-0000-4000-8000-000000000001';
  const turn='86000000-0000-4000-8000-000000000002';
  const proposal='86000000-0000-4000-8000-000000000003';
  it('requires a complete owner turn and keeps proposals private',async()=>{
    const owner=`(select id from public.persons where auth_user_id='${founder}')`;
    await db.exec(`insert into public.ai_conversations(id,person_id,title) values('${conversation}',${owner},'Synthetic action review');
      insert into public.ai_turns(id,person_id,conversation_id,user_text,assistant_text,status,model,context_included,prompt_version)
      values('${turn}',${owner},'${conversation}','Plan my next step','Start with one action','complete','fixture',false,'fixture');`);
    await asUser(founder,`select public.ai_propose_daily_action('${proposal}','${turn}','Review my plan')`);
    expect((await asUser(member,'select * from public.ai_action_proposals')).rows).toHaveLength(0);
    await expect(asUser(member,`select public.ai_decide_daily_action('${proposal}',true)`)).rejects.toThrow();
    await expect(asUser(member,`select public.ai_propose_daily_action('86000000-0000-4000-8000-000000000004','${turn}','Intrusion')`)).rejects.toThrow();
    expect((await asUser(founder,`select public.ai_propose_daily_action('${proposal}','${turn}','Review my plan')`)).rows).toHaveLength(1);
    await expect(asUser(founder,`select public.ai_propose_daily_action('86000000-0000-4000-8000-000000000005','${turn}','Different')`)).rejects.toThrow();
  });
  it('executes once after approval and leaves existing daily content intact',async()=>{
    const before=(await asUser<{version:number;intention:string}>(founder,'select version,intention from public.daily_entries order by day desc limit 1')).rows[0]!;
    const result=await asUser<{ai_decide_daily_action:string}>(founder,`select public.ai_decide_daily_action('${proposal}',true)`);
    const day=new Date(result.rows[0]!.ai_decide_daily_action).toISOString().slice(0,10);
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await asUser(founder,`select title from public.daily_actions where id='${proposal}'`)).rows).toEqual([{title:'Review my plan'}]);
    const after=(await asUser<{version:number;intention:string}>(founder,`select version,intention from public.daily_entries where day='${day}'`)).rows[0]!;
    expect(after.version).toBe(before.version+1);
    expect(after.intention).toBe(before.intention);
    expect(new Date((await asUser<{ai_decide_daily_action:string}>(founder,`select public.ai_decide_daily_action('${proposal}',true)`)).rows[0]!.ai_decide_daily_action).toISOString().slice(0,10)).toBe(day);
    expect((await asUser(founder,`select id from public.daily_actions where id='${proposal}'`)).rows).toHaveLength(1);
    await expect(asUser(founder,`select public.ai_decide_daily_action('${proposal}',false)`)).rejects.toThrow();
  });
  it('dismisses without a daily write',async()=>{
    const next='86000000-0000-4000-8000-000000000006';
    const turn2='86000000-0000-4000-8000-000000000007';
    const owner=`(select id from public.persons where auth_user_id='${founder}')`;
    await db.exec(`insert into public.ai_turns(id,person_id,conversation_id,user_text,assistant_text,status,model,context_included,prompt_version)
      values('${turn2}',${owner},'${conversation}','Think through an idea','Consider one step','complete','fixture',false,'fixture')`);
    await asUser(founder,`select public.ai_propose_daily_action('${next}','${turn2}','Work on idea')`);
    await asUser(founder,`select public.ai_decide_daily_action('${next}',false)`);
    expect((await asUser(founder,`select id from public.daily_actions where id='${next}'`)).rows).toHaveLength(0);
    await expect(asUser(founder,`select public.ai_decide_daily_action('${next}',true)`)).rejects.toThrow();
  });
});
describe('confirmed evening review and next-day continuity',()=>{
 const today="(current_timestamp at time zone 'America/Chicago')::date";
 const first='87000000-0000-4000-8000-000000000001';
 const second='87000000-0000-4000-8000-000000000002';
 const call=(request:string,expected:number,dayVersion:number,progress:string,blocker:string,tomorrow:string)=>
  `select public.daily_confirm_review('${request}',${today},${expected},${dayVersion},'${progress}','${blocker}','${tomorrow}') as version`;
 it('requires a current owned saved day and keeps review history private',async()=>{
  const dayVersion=(await asUser<{version:number}>(founder,`select version from public.daily_entries where day=${today}`)).rows[0]!.version;
  expect((await asUser<{version:number}>(founder,call(first,0,dayVersion,'Finished a deliberate action','Lost focus after lunch','Start with the most important decision'))).rows[0]?.version).toBe(1);
  expect((await asUser(member,'select * from public.daily_reviews')).rows).toHaveLength(0);
  expect((await asUser(member,'select * from public.daily_review_revisions')).rows).toHaveLength(0);
  await expect(asUser(member,call('87000000-0000-4000-8000-000000000003',0,dayVersion,'Intrusion','',''))).rejects.toThrow();
  await expect(asUser(founder,"update public.daily_reviews set tomorrow='Bypass'")).rejects.toThrow();
  await expect(asUser(founder,call('87000000-0000-4000-8000-000000000004',0,dayVersion+1,'Invalid','',''))).rejects.toThrow();
  await expect(asUser(founder,call('87000000-0000-4000-8000-000000000005',0,dayVersion,'','',''))).rejects.toThrow();
  await expect(asUser(founder,`select public.daily_confirm_review('87000000-0000-4000-8000-000000000006',${today}-1,0,${dayVersion},'Past','','')`)).rejects.toThrow();
  await db.exec('set role anon');
  try {await expect(db.query('select * from public.daily_reviews')).rejects.toThrow();await expect(db.query(call('87000000-0000-4000-8000-000000000007',0,dayVersion,'Intrusion','',''))).rejects.toThrow();}
  finally {await db.exec('reset role');}
 });
 it('supports correction with revision history and idempotent confirmation',async()=>{
  const dayVersion=(await asUser<{version:number}>(founder,`select version from public.daily_entries where day=${today}`)).rows[0]!.version;
  expect((await asUser<{version:number}>(founder,call(second,1,dayVersion,'Completed the plan','Schedule slipped','Protect the first hour'))).rows[0]?.version).toBe(2);
  await expect(asUser(founder,call(second,1,dayVersion,'Altered retry','',''))).rejects.toThrow();
  expect((await asUser<{version:number}>(founder,call(second,1,dayVersion,'Completed the plan','Schedule slipped','Protect the first hour'))).rows[0]?.version).toBe(2);
  await expect(asUser(founder,call('87000000-0000-4000-8000-000000000008',1,dayVersion,'Stale','',''))).rejects.toThrow();
  expect((await asUser<{tomorrow:string}>(founder,`select tomorrow from public.daily_reviews where day=${today}`)).rows[0]?.tomorrow).toBe('Protect the first hour');
  expect((await asUser<{tomorrow:string}>(founder,`select tomorrow from public.daily_review_revisions where day=${today} order by version`)).rows.map(row=>row.tomorrow)).toEqual(['Start with the most important decision','Protect the first hour']);
  const entry=(await asUser<{version:number}>(founder,`select version from public.daily_entries where day=${today}`)).rows[0]!.version;
  expect(entry).toBe(dayVersion);
 });
});
afterAll(() => db.close());
