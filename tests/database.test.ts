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

describe('Aurelius private records and generation limits', () => {
  const chat = '30000000-0000-4000-8000-000000000001';
  const request = '40000000-0000-4000-8000-000000000001';
  const memory = '50000000-0000-4000-8000-000000000001';
  const begin = (id: string, conversation = chat) =>
    `select public.ai_begin_turn('${conversation}','${id}','Help me think','openai/gpt-6-astra',true,'test-v1')`;
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
