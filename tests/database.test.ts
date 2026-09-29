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
  // Only the storage catalog surface used by migrations; this does not emulate Storage APIs.
  await db.exec(`create schema storage;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
   create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
   grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of (await readdir('supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(await readFile('supabase/seed.sql', 'utf8'));
});

describe('migration, seeds and owner security', () => {
  it('isolates Studio projects and versions, and reserves generation only once',async()=>{
    const project='91000000-0000-4000-8000-000000000001';
    const version='91000000-0000-4000-8000-000000000002';
    const own=`(select id from public.persons where auth_user_id='${founder}')`;
    await asUser(founder,`insert into public.ai_studio_projects(id,person_id,title) values('${project}',${own},'Portrait study')`);
    await asUser(founder,`update public.ai_studio_projects set creative_type='brand',brief='{"purpose":"A founder campaign","palette":"emerald and gold"}'::jsonb where id='${project}'`);
    expect((await asUser<{creative_type:string;brief:{purpose:string}}>(founder,`select creative_type,brief from public.ai_studio_projects where id='${project}'`)).rows[0]).toMatchObject({creative_type:'brand',brief:{purpose:'A founder campaign'}});
    expect((await asUser(member,'select * from public.ai_studio_projects')).rows).toHaveLength(0);
    expect((await asUser(member,`update public.ai_studio_projects set brief='{"purpose":"Intrusion"}'::jsonb where id='${project}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(member,`insert into public.ai_studio_projects(id,person_id,title) values(gen_random_uuid(),${own},'Intrusion')`)).rejects.toThrow();
    const begin=`select public.ai_studio_begin('${version}','${project}',null,null,'A portrait in soft light','gpt-image-2.5-flare','1024x1024') as saved`;
    expect((await asUser(founder,begin)).rows[0]).toEqual({saved:true});
    expect((await asUser(founder,begin)).rows[0]).toEqual({saved:false});
    expect((await asUser(member,'select * from public.ai_studio_versions')).rows).toHaveLength(0);
    await expect(asUser(member,`select public.ai_studio_finish('${version}','complete','${member}/${project}/bad.png')`)).rejects.toThrow();
    await expect(asUser(member,`select public.ai_studio_begin(gen_random_uuid(),'${project}',null,null,'Another portrait','gpt-image-2.5-flare','1024x1024')`)).rejects.toThrow();
    expect((await asUser(founder,`select public.ai_studio_finish('${version}','failed',null,'test') as saved`)).rows[0]).toEqual({saved:true});
    expect((await asUser(founder,'select * from public.ai_studio_usage')).rows).toHaveLength(1);
    expect((await asUser(member,'select * from public.ai_studio_usage')).rows).toHaveLength(0);
    await expect(asUser(founder,`update public.ai_studio_versions set status='complete' where id='${version}'`)).rejects.toThrow();
    await expect(asUser(founder,`delete from public.ai_studio_projects where id='${project}'`)).rejects.toThrow();
  });
  it('keeps storyboard scenes owner-bound, project-bound and within eight slots',async()=>{
    const grants=await db.query<{anon_insert:boolean;member_insert:boolean;member_rpc:boolean}>(`select
      has_table_privilege('anon','public.ai_studio_scenes','INSERT') as anon_insert,
      has_table_privilege('authenticated','public.ai_studio_scenes','INSERT') as member_insert,
      has_function_privilege('authenticated','public.ai_studio_scene_create(uuid,text,text,text,text,text)','EXECUTE') as member_rpc`);
    expect(grants.rows[0]).toEqual({anon_insert:false,member_insert:false,member_rpc:true});
    const project='92000000-0000-4000-8000-000000000001';
    const other='92000000-0000-4000-8000-000000000002';
    const own=`(select id from public.persons where auth_user_id='${founder}')`;
    await asUser(founder,`insert into public.ai_studio_projects(id,person_id,title) values('${project}',${own},'Campaign'),('${other}',${own},'Other')`);
    const create=(id:string)=>`select public.ai_studio_scene_create('${id}','Opening','Lead with a feeling','Emerald light','','social') as id`;
    const scene=(await asUser<{id:string}>(founder,create(project))).rows[0]?.id;
    expect(scene).toBeDefined();
    expect((await asUser(member,'select id from public.ai_studio_scenes')).rows).toHaveLength(0);
    await expect(asUser(member,create(project))).rejects.toThrow();
    await expect(asUser(founder,`insert into public.ai_studio_scenes(person_id,project_id,position,title) values(${own},'${project}',2,'Bypass')`)).rejects.toThrow();
    expect((await asUser(member,`update public.ai_studio_scenes set title='Intrusion' where id='${scene}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(founder,`update public.ai_studio_scenes set project_id='${other}' where id='${scene}'`)).rejects.toThrow();
    const unrelated='92000000-0000-4000-8000-000000000003';
    await asUser(founder,`select public.ai_studio_begin('${unrelated}','${other}',null,null,'Other frame','gpt-image-2.5-flare','1024x1024')`);
    await expect(asUser(founder,`update public.ai_studio_scenes set asset_version_id='${unrelated}' where id='${scene}'`)).rejects.toThrow();
    await asUser(founder,`select public.ai_studio_finish('${unrelated}','failed',null,'test')`);
    for(let index=0;index<7;index++) await asUser(founder,create(project));
    await expect(asUser(founder,create(project))).rejects.toThrow(/eight scenes/);
    await asUser(founder,`delete from public.ai_studio_scenes where id='${scene}'`);
    expect((await asUser<{id:string}>(founder,create(project))).rows).toHaveLength(1);
  });
  it('binds finishing compositions to one owner and one project image',async()=>{
    const project='93000000-0000-4000-8000-000000000001';
    const other='93000000-0000-4000-8000-000000000002';
    const version='93000000-0000-4000-8000-000000000003';
    const own=`(select id from public.persons where auth_user_id='${founder}')`;
    await asUser(founder,`insert into public.ai_studio_projects(id,person_id,title) values('${project}',${own},'Finish study'),('${other}',${own},'Other')`);
    await asUser(founder,`select public.ai_studio_begin('${version}','${project}',null,null,'Gold light','gpt-image-2.5-flare','1024x1024')`);
    const insert=(id:string)=>`insert into public.ai_studio_finishes(person_id,project_id,version_id,brand,headline) values(${own},'${id}','${version}','GENT ASCEND','A clearer way')`;
    await expect(asUser(founder,insert(other))).rejects.toThrow();
    await expect(asUser(member,insert(project))).rejects.toThrow();
    await asUser(founder,insert(project));
    expect((await asUser(member,'select id from public.ai_studio_finishes')).rows).toHaveLength(0);
    expect((await asUser(member,`update public.ai_studio_finishes set headline='Intrusion' where version_id='${version}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(founder,`update public.ai_studio_finishes set project_id='${other}' where version_id='${version}'`)).rejects.toThrow();
    await expect(asUser(founder,insert(project))).rejects.toThrow();
  });
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

describe('founding member pilot authorization', () => {
  it('requires the founder grant, verified matching email, and an explicit claim', async () => {
    await expect(asUser(member,"select public.pilot_reserve('member@aurelius.test')")).rejects.toThrow();
    const reserved = await asUser<{pilot_reserve:string}>(founder,"select public.pilot_reserve('MEMBER@AURELIUS.TEST')");
    expect(reserved.rows[0]?.pilot_reserve).toBeTruthy();
    await expect(asUser(founder,"select public.pilot_reserve('member@aurelius.test')")).rejects.toThrow();
    expect((await asUser(member,'select * from public.pilot_invitations')).rows).toHaveLength(0);
    await expect(asUser(member,"update public.membership_accounts set beta_access=true")).rejects.toThrow();
    await db.exec(`update auth.users set email_confirmed_at=null where id='${member}'`);
    await expect(asUser(member,'select public.pilot_claim()')).rejects.toThrow();
    await db.exec(`update auth.users set email_confirmed_at=now(),email='other@aurelius.test' where id='${member}'`);
    expect((await asUser<{pilot_claim:boolean}>(member,'select public.pilot_claim()')).rows[0]?.pilot_claim).toBe(false);
    await db.exec(`update auth.users set email='member@aurelius.test' where id='${member}'`);
    expect((await asUser<{pilot_claim:boolean}>(member,'select public.pilot_claim()')).rows[0]?.pilot_claim).toBe(true);
    expect((await asUser<{pilot_claim:boolean}>(member,'select public.pilot_claim()')).rows[0]?.pilot_claim).toBe(true);
    expect((await asUser<{beta_access:boolean}>(member,'select beta_access from public.membership_accounts')).rows[0]?.beta_access).toBe(true);
    expect((await asUser<{status:string}>(founder,'select status from public.pilot_invitations')).rows[0]?.status).toBe('claimed');
    await expect(asUser(member,"update public.pilot_invitations set status='revoked'")).rejects.toThrow();
  });
  it('keeps feedback voluntary and read only for the member and founder', async () => {
    await expect(asUser(member,"select public.pilot_submit_feedback('friction','')")).rejects.toThrow();
    await asUser(member,"select public.pilot_submit_feedback('friction','I could not find my next action')");
    expect((await asUser(member,'select * from public.pilot_feedback')).rows).toHaveLength(1);
    expect((await asUser(founder,'select * from public.pilot_feedback')).rows).toHaveLength(1);
    await expect(asUser(member,"update public.pilot_feedback set message='Altered'")).rejects.toThrow();
    await db.exec('set role anon');
    try { await expect(db.query('select * from public.pilot_feedback')).rejects.toThrow(); await expect(db.query('select public.pilot_claim()')).rejects.toThrow(); }
    finally { await db.exec('reset role'); }
  });
});

describe('Aethelios chat foundation',()=>{
  it('keeps message parts, search, archive and revisions owner-scoped', async () => {
    const chat='96000000-0000-4000-8000-000000000001';
    const first='96000000-0000-4000-8000-000000000002';
    const second='96000000-0000-4000-8000-000000000003';
    await asUser(founder,`select public.ai_begin_turn('${chat}','${first}','Plan my cedarwood grooming ritual','gpt-6-astra',false,'test')`);
    await asUser(founder,`select public.ai_finish_turn('${first}','Start with a gentle cleanse.','complete',80,20)`);
    const messages=await asUser<{role:string;content:string;parts:unknown}>(founder,`select role,content,parts from public.ai_messages where conversation_id='${chat}' order by created_at,position`);
    expect(messages.rows.map(m=>m.role)).toEqual(['user','assistant']);
    expect(messages.rows[1]?.content).toBe('Start with a gentle cleanse.');
    expect((await asUser(member,`select * from public.ai_messages where conversation_id='${chat}'`)).rows).toHaveLength(0);
    await expect(asUser(member,`update public.ai_messages set content='intrusion' where conversation_id='${chat}'`)).rejects.toThrow();
    const found=await asUser<{id:string}>(founder,"select id from public.ai_search_conversations('cedarwood',30)");
    expect(found.rows.some(row=>row.id===chat)).toBe(true);
    expect((await asUser(member,"select id from public.ai_search_conversations('cedarwood',30)")).rows).toHaveLength(0);
    await asUser(founder,`select public.ai_update_conversation('${chat}','Grooming ritual',true)`);
    await expect(asUser(founder,`select public.ai_begin_turn('${chat}','${second}','Continue','gpt-6-astra',false,'test')`)).rejects.toThrow();
    await asUser(founder,`select public.ai_update_conversation('${chat}',null,false)`);
    await asUser(founder,`select public.ai_begin_revision('${chat}','${first}','${second}','Plan my cedarwood grooming ritual','regenerate','gpt-6-astra',false,'test')`);
    const revision=await asUser<{parent_turn_id:string;revision_kind:string}>(founder,`select parent_turn_id,revision_kind from public.ai_turns where id='${second}'`);
    expect(revision.rows[0]).toMatchObject({parent_turn_id:first,revision_kind:'regenerate'});
    const auxiliary='96000000-0000-4000-8000-000000000004';
    await asUser(founder,`select public.ai_reserve_auxiliary('${auxiliary}','summary')`);
    await asUser(founder,`select public.ai_finish_auxiliary('${auxiliary}',400,60)`);
    expect((await asUser<{input_tokens:number}>(founder,`select input_tokens from public.ai_aux_usage where id='${auxiliary}'`)).rows[0]?.input_tokens).toBe(400);
    expect((await asUser(member,'select * from public.ai_aux_usage')).rows).toHaveLength(0);
    await expect(asUser(member,`select public.ai_update_conversation('${chat}','Intrusion',null)`)).resolves.toMatchObject({rows:[{ai_update_conversation:false}]});
    await asUser(founder,`select public.ai_finish_turn('${second}','Use a small amount after washing.','complete')`);
  });
});

describe('Performance transactions and isolation',()=>{
 const request=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const profile={goal:'strength',experience:'returning',daysPerWeek:3,minutes:40,equipment:'gym',limitations:'',unit:'lb'};
 const plan={title:'Strength',unit:'lb',exercises:[{id:request(50),name:'Row',sets:2,reps:8,load:40,restSeconds:90}]};
 const start=new Date(Date.now()-3600000).toISOString();
 const session={id:request(60),title:'Strength',planVersion:1,startedAt:start,endedAt:null,status:'active',unit:'lb',pain:false,note:'',sets:[{id:request(61),exerciseId:request(50),exercise:'Row',targetReps:8,targetLoad:40,reps:8,load:40,effort:7,done:true}]};
 const sql=(kind:string,n:number,version:number,payload:unknown)=>`select public.performance_save('${kind}','${request(n)}',${version},'${JSON.stringify(payload).replaceAll("'","''")}'::jsonb) as version`;
 it('saves typed profiles and refuses direct writes or stale replacements',async()=>{
  expect((await asUser(founder,sql('profile',1,0,profile))).rows).toEqual([{version:1}]);
  expect((await asUser(founder,sql('profile',1,0,profile))).rows).toEqual([{version:1}]);
  await expect(asUser(founder,sql('profile',1,0,{...profile,minutes:60}))).rejects.toThrow();
  await expect(asUser(founder,sql('profile',2,0,profile))).rejects.toThrow();
  await expect(asUser(founder,"update public.performance_profiles set minutes=120")).rejects.toThrow();
  expect((await asUser(member,'select * from public.performance_profiles')).rows).toHaveLength(0);
 });
 it('keeps plan revisions and rolls back malformed or foreign source changes',async()=>{
  await asUser(founder,sql('plan',3,0,plan));
  await expect(asUser(founder,sql('plan',4,1,{...plan,exercises:[{...plan.exercises[0],reps:0}]}))).rejects.toThrow();
  await expect(asUser(founder,sql('plan',5,1,{...plan,sourceSessionIds:[request(95),request(96)]}))).rejects.toThrow();
  expect((await asUser(founder,'select version from public.performance_plans')).rows).toEqual([{version:1}]);
  expect((await asUser(founder,'select version from public.performance_plan_revisions')).rows).toEqual([{version:1}]);
  expect((await asUser(member,'select * from public.performance_plan_revisions')).rows).toHaveLength(0);
 });
 it('replays a session save safely after a lost acknowledgement',async()=>{
  expect((await asUser(founder,sql('session',6,0,session))).rows).toEqual([{version:1}]);
  expect((await asUser(founder,sql('session',6,0,session))).rows).toEqual([{version:1}]);
  expect((await asUser(founder,'select id from public.performance_sets')).rows).toHaveLength(1);
  await expect(asUser(member,sql('session',7,0,session))).rejects.toThrow();
  expect((await asUser(member,'select * from public.performance_sessions')).rows).toHaveLength(0);
  expect((await asUser(member,'select * from public.performance_sets')).rows).toHaveLength(0);
 });
 it('rejects invalid sets atomically and preserves the previous record',async()=>{
  await expect(asUser(founder,sql('session',8,1,{...session,sets:[{...session.sets[0],reps:null}]}))).rejects.toThrow();
  await expect(asUser(founder,sql('session',9,1,{...session,unit:'kg'}))).rejects.toThrow();
  expect((await asUser(founder,'select version from public.performance_sessions')).rows).toEqual([{version:1}]);
  expect((await asUser(founder,'select reps from public.performance_sets')).rows).toEqual([{reps:8}]);
 });
 it('finishes once, emits one event, and prevents a stale tab from reopening it',async()=>{
  const finished={...session,status:'complete',endedAt:new Date().toISOString()};
  expect((await asUser(founder,sql('session',10,1,finished))).rows).toEqual([{version:2}]);
  expect((await asUser(founder,sql('session',10,1,finished))).rows).toEqual([{version:2}]);
  await expect(asUser(founder,sql('session',11,2,session))).rejects.toThrow();
  expect((await asUser(founder,"select id from public.personal_events where kind='performance.session.completed'")).rows).toHaveLength(1);
 });
 it('keeps partial intake distinct from missing data and denies anonymous access',async()=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const check={day:today,sleepMinutes:null,energy:3,soreness:'mild',weight:null,unit:'lb',calories:600,protein:30,waterMl:null,nutritionComplete:false};
  await asUser(founder,sql('checkin',12,0,check));
  expect((await asUser(founder,'select sleep_minutes,nutrition_complete from public.performance_checkins')).rows).toEqual([{sleep_minutes:null,nutrition_complete:false}]);
  expect((await asUser(member,'select * from public.performance_checkins')).rows).toHaveLength(0);
  await db.exec('set role anon');try{await expect(db.query(sql('profile',13,0,profile))).rejects.toThrow();await expect(db.query('select * from public.performance_sessions')).rejects.toThrow();}finally{await db.exec('reset role');}
 });
});

describe('Performance programs and immutable decisions',()=>{
 const slotA='c1000000-0000-4000-8000-000000000001';
 const slotB='c1000000-0000-4000-8000-000000000002';
 const ex={id:'c1000000-0000-4000-8000-000000000003',name:'Synthetic row',sets:3,reps:8,load:40,restSeconds:90};
 const plan={title:'Session A',unit:'lb',exercises:[ex]};
 const program={title:'A / B',sessions:[{id:slotA,plan},{id:slotB,plan:{...plan,title:'Session B'}}]};
 const call=(kind:string,version:number,payload:unknown,request=crypto.randomUUID())=>`select public.performance_save('${kind}','${request}',${version},'${JSON.stringify(payload).replaceAll("'","''")}'::jsonb) as version`;
 it('versions programs, enforces ownership and preserves replay receipts',async()=>{
  const request=crypto.randomUUID();
  expect((await asUser(member,call('program',0,program,request))).rows).toEqual([{version:1}]);
  expect((await asUser(member,call('program',0,program,request))).rows).toEqual([{version:1}]);
  await expect(asUser(member,call('program',0,{...program,title:'Changed'},request))).rejects.toThrow();
  await expect(asUser(member,call('program',0,program))).rejects.toThrow();
  expect((await asUser(founder,'select * from public.performance_programs')).rows).toHaveLength(0);
  expect((await asUser(founder,'select * from public.performance_program_revisions')).rows).toHaveLength(0);
  await expect(asUser(member,"update public.performance_programs set title='bypass'")).rejects.toThrow();
  await expect(asUser(member,call('program',1,{...program,sessions:[program.sessions[0],program.sessions[0]]}))).rejects.toThrow();
 });
 it('verifies decisions, advances exactly once and rejects forged or mutable provenance',async()=>{
  const {startProgramSession,preparePlan}=await import('../src/domains/performance/program');
  const {planSchema}=await import('../src/domains/performance/schema');
  const p=planSchema.parse(plan);
  const session=startProgramSession({ruleVersion:1,programVersion:1,slotId:slotA,mode:'lighter',timeBudget:40,originalPlan:p,plan:preparePlan(p,'lighter',40)});
  await expect(asUser(founder,call('session',0,session))).rejects.toThrow();
  const forged=structuredClone(session);forged.prescription.plan.exercises[0]!.load=100;
  await expect(asUser(member,call('session',0,forged))).rejects.toThrow();
  expect((await asUser(member,call('session',0,session))).rows).toEqual([{version:1}]);
  const mutated=structuredClone(session);mutated.prescription.timeBudget=20;
  await expect(asUser(member,call('session',1,mutated))).rejects.toThrow();
  const {prescription: _ignored,...missing}=session;void _ignored;
  await expect(asUser(member,call('session',1,missing))).rejects.toThrow();
  const complete={...session,status:'complete',endedAt:new Date().toISOString(),sets:session.sets.map(s=>({...s,done:true}))};
  const request=crypto.randomUUID();
  expect((await asUser(member,call('session',1,complete,request))).rows).toEqual([{version:2}]);
  expect((await asUser(member,call('session',1,complete,request))).rows).toEqual([{version:2}]);
  expect((await asUser(member,'select next_slot_id from public.performance_programs')).rows).toEqual([{next_slot_id:slotB}]);
  expect((await asUser(founder,'select * from public.performance_session_context')).rows).toHaveLength(0);
  expect((await asUser(member,'select * from public.performance_session_context')).rows).toHaveLength(1);
  expect((await asUser(member,`select * from public.personal_events where source_record_id='${session.id}'`)).rows).toHaveLength(1);
 });
 it('syncs an old offline revision after a program edit without advancing the new cycle',async()=>{
  const {startProgramSession}=await import('../src/domains/performance/program');
  const {planSchema}=await import('../src/domains/performance/schema');
  const p=planSchema.parse({...plan,title:'Session B'});
  const session=startProgramSession({ruleVersion:1,programVersion:1,slotId:slotB,mode:'planned',timeBudget:40,originalPlan:p,plan:p});
  expect((await asUser(member,call('program',1,{...program,title:'Revised cycle'}))).rows).toEqual([{version:2}]);
  const complete={...session,status:'complete',endedAt:new Date().toISOString(),sets:session.sets.map(s=>({...s,done:true}))};
  await asUser(member,call('session',0,complete));
  expect((await asUser(member,'select next_slot_id,version from public.performance_programs')).rows).toEqual([{next_slot_id:slotB,version:2}]);
  expect((await asUser(member,'select * from public.performance_program_revisions')).rows).toHaveLength(2);
 });
 it('matches server and client shortening for bounded session combinations',async()=>{
  const {preparePlan}=await import('../src/domains/performance/program');
  const {planSchema}=await import('../src/domains/performance/schema');
  for(const mode of ['planned','shorter','lighter'] as const) for(const budget of [10,15,40,120]) {
   const source=planSchema.parse({...plan,exercises:[ex,{...ex,id:slotB,sets:5,restSeconds:180}]});
   const result=await db.query<{plan:unknown}>(`select performance_private.prepare_plan_v1('${JSON.stringify(source)}'::jsonb,'${mode}',${budget}) as plan`);
   expect(result.rows[0]?.plan).toEqual(preparePlan(source,mode,budget));
  }
 });
});

describe('Performance progression evidence and approval', () => {
 beforeAll(async()=>{ await db.exec(`delete from public.performance_checkins where person_id=(select id from public.persons where auth_user_id='${founder}')`); });
 const slot=crypto.randomUUID(),other=crypto.randomUUID(),exercise=crypto.randomUUID();
 const plan={title:'Progression A',unit:'lb' as const,exercises:[{id:exercise,name:'Row',sets:2,reps:8,load:40,restSeconds:90}]};
 const program={title:'Learning cycle',sessions:[{id:slot,plan},{id:other,plan:{...plan,title:'Progression B'}}]};
 const call=(kind:string,version:number,payload:unknown,request=crypto.randomUUID())=>`select public.performance_save('${kind}','${request}',${version},'${JSON.stringify(payload).replaceAll("'","''")}'::jsonb) as version`;
 const review=async()=> (await asUser<{value:import('../src/domains/performance/progression').ProgressionReview[]}>(founder,'select public.performance_progression() as value')).rows[0]!.value;
 let token='',checkVersion=1;
 const check={day:new Date().toISOString().slice(0,10),sleepMinutes:450,energy:4,soreness:'none',weight:null,unit:'lb',calories:null,protein:null,waterMl:null,nutritionComplete:false};
 const accept=(request=crypto.randomUUID(),t=token,version=1)=>`select public.performance_progression_accept('${request}',${version},'${slot}','${t}') as version`;
 async function workout(daysAgo:number,mode:'planned'|'lighter'='planned',effort:number|null=7,slotId=slot) {
  const {startProgramSession,preparePlan}=await import('../src/domains/performance/program');
  const original=slotId===slot?plan:program.sessions[1]!.plan;
  const s=startProgramSession({ruleVersion:1,programVersion:1,slotId,mode,timeBudget:40,originalPlan:original,plan:preparePlan(original,mode,40)});
  s.startedAt=new Date(Date.now()-daysAgo*86400000-3600000).toISOString();
  const complete={...s,status:'complete',endedAt:new Date(Date.now()-daysAgo*86400000).toISOString(),sets:s.sets.map(x=>({...x,done:true,effort}))};
  await asUser(founder,call('session',0,complete));return complete;
 }
 it('holds with unknown recovery and matches two records for each slot rather than globally',async()=>{
  await asUser(founder,call('program',0,program));
  expect((await review())[0]!.reason).toContain('today’s');
  await asUser(founder,call('checkin',0,check));
  await workout(6);await workout(3);await workout(1,'planned',7,other);
  const reviews=await review();
  expect(reviews[0]).toMatchObject({status:'ready',proposal:{from:8,to:9,load:40}});
  expect(reviews[1]).toMatchObject({status:'hold',proposal:null});
  expect(reviews[1]!.reason).toContain('Two completed');
  token=reviews[0]!.proposal!.token;
 });
 it('rejects stale check-ins and forged tokens; owner-only reads and writes stay isolated',async()=>{
  await asUser(founder,call('checkin',checkVersion++,{...check,energy:5}));
  await expect(asUser(founder,accept())).rejects.toThrow(/Evidence changed/);
  token=(await review())[0]!.proposal!.token;
  await expect(asUser(member,accept())).rejects.toThrow();
  await expect(asUser(founder,accept(crypto.randomUUID(),'0'.repeat(64)))).rejects.toThrow();
  await expect(asUser(founder,"update public.performance_progression_decisions set to_version=99")).rejects.toThrow();
  await expect(asUser(founder,`select performance_private.progression_state((select id from public.persons limit 1))`)).rejects.toThrow();
  await db.exec('set role anon');try {await expect(db.query('select public.performance_progression()')).rejects.toThrow();}finally {await db.exec('reset role');}
 });
 it('does not skip adapted or unknown-effort sessions to cherry-pick older easy workouts',async()=>{
  await workout(.5,'lighter');
  expect((await review())[0]!.reason).toContain('adapted');
  await expect(asUser(founder,accept())).rejects.toThrow();
  // Remove synthetic test-only rows to isolate the next rule; production sessions are immutable.
  await db.exec(`delete from public.performance_sessions where person_id=(select id from public.persons where auth_user_id='${founder}') and started_at>now()-interval '1 day'`);
  const s=await workout(2,'planned',null);
  expect((await review())[0]).toMatchObject({status:'hold',proposal:null});
  await db.exec(`delete from public.performance_sessions where id='${s.id}'`);
 });
 it('pauses for active workouts, discomfort, limitations and demanding check-ins',async()=>{
  const own=`(select id from public.persons where auth_user_id='${founder}')`;
  await db.exec(`update public.performance_profiles set limitations='Recorded limitation' where person_id=${own}`);
  expect((await review())[0]!.reason).toContain('limitations');
  await db.exec(`update public.performance_profiles set limitations='' where person_id=${own};update public.performance_sessions set pain=true where person_id=${own} and status='complete'`);
  expect((await review())[0]!.reason).toContain('Discomfort');
  await db.exec(`update public.performance_sessions set pain=false where person_id=${own}`);
  await asUser(founder,call('checkin',checkVersion++,{...check,energy:2}));
  expect((await review())[0]!.reason).toContain('keeping targets');
  await asUser(founder,call('checkin',checkVersion++,check));
  const {startProgramSession}=await import('../src/domains/performance/program');
  const s=startProgramSession({ruleVersion:1,programVersion:1,slotId:slot,mode:'planned',timeBudget:40,originalPlan:plan,plan});
  await asUser(founder,call('session',0,s));
  expect((await review())[0]!.reason).toContain('active workout');
  await asUser(founder,call('session',1,{...s,status:'abandoned',endedAt:new Date().toISOString()}));
  token=(await review())[0]!.proposal!.token;
 });
 it('atomically versions one target, preserves the other session, records provenance and replays exactly once',async()=>{
  const request=crypto.randomUUID();
  expect((await asUser(founder,accept(request))).rows).toEqual([{version:2}]);
  expect((await asUser(founder,accept(request))).rows).toEqual([{version:2}]);
  await expect(asUser(founder,accept(request,'0'.repeat(64)))).rejects.toThrow(/reused/);
  await expect(asUser(founder,accept())).rejects.toThrow(/Program changed/);
  const saved=(await asUser<{sessions:typeof program.sessions}>(founder,'select sessions from public.performance_programs')).rows[0]!.sessions;
  expect(saved[0]!.plan.exercises[0]!.reps).toBe(9);
  expect(saved[1]).toEqual(program.sessions[1]);
  expect((await review())[0]!.reason).toContain('Targets changed');
  expect((await asUser(founder,'select * from public.performance_progression_decisions')).rows).toHaveLength(1);
  expect((await asUser(founder,"select id from public.personal_events where kind='performance.progression.approved'")).rows).toHaveLength(1);
  expect((await asUser(member,'select * from public.performance_progression_decisions')).rows).toHaveLength(0);
 });
 it('reads exact first attempts beyond history caps, stops at changed plans and isolates owners',async()=>{
  const { outcomeEvidenceSchema, decisionOutcome }=await import('../src/domains/performance/outcomes');
  const { startProgramSession }=await import('../src/domains/performance/program');
  const own=`(select id from public.persons where auth_user_id='${founder}')`;
  const get=async()=>outcomeEvidenceSchema.array().parse((await asUser<{value:unknown}>(founder,'select public.performance_outcomes() as value')).rows[0]!.value);
  expect((await get())[0]!.sessions).toHaveLength(0);
  expect((await asUser(member,'select public.performance_outcomes() as value')).rows).toEqual([{value:[]}]);
  await db.exec('set role anon');try {await expect(db.query('select public.performance_outcomes()')).rejects.toThrow();}finally {await db.exec('reset role');}
  expect((await db.query<{prosecdef:boolean}>("select prosecdef from pg_proc where oid='public.performance_outcomes()'::regprocedure")).rows[0]!.prosecdef).toBe(false);
  // Synthetic timeline: approval six days ago; avoid relying on wall-clock sleeps.
  await db.exec(`update public.performance_progression_decisions set created_at=now()-interval '6 days' where person_id=${own};
   update public.performance_program_revisions set recorded_at=now()-interval '6 days' where person_id=${own} and version=2`);
  const approvedPlan={...plan,exercises:plan.exercises.map(x=>({...x,reps:9}))};
  async function attempt(daysAgo:number,version=2,status:'complete'|'abandoned'='complete') {
   const session=startProgramSession({ruleVersion:1,programVersion:version,slotId:slot,mode:'planned',timeBudget:40,originalPlan:approvedPlan,plan:approvedPlan});
   session.startedAt=new Date(Date.now()-daysAgo*86400000-3600000).toISOString();
   session.endedAt=new Date(Date.now()-daysAgo*86400000).toISOString();session.status=status;
   session.sets=session.sets.map(x=>({...x,done:status==='complete',effort:8}));
   await asUser(founder,call('session',0,session));return session.id;
  }
  const first=await attempt(5,2,'abandoned');const second=await attempt(3);
  await attempt(1); // A third successful workout must not replace the abandoned first attempt.
  let evidence=(await get())[0]!;
  expect(evidence.sessions.map(s=>s.id)).toEqual([first,second]);
  expect(decisionOutcome(evidence,'UTC').attempts.map(a=>a.status)).toEqual(['abandoned','met']);
  // Changing another slot does not end this trial.
  const next={...program,sessions:[{id:slot,plan:approvedPlan},{id:other,plan:{...program.sessions[1]!.plan,title:'Other revised'}}]};
  await asUser(founder,call('program',2,next));
  expect((await get())[0]!.revisedAt).toBeNull();
  await asUser(founder,call('program',3,{...next,sessions:next.sessions.map(s=>s.id===slot?{...s,plan:{...s.plan,title:'Revised trial'}}:s)}));
  // Move the synthetic revision boundary between the first and second attempts.
  await db.exec(`update public.performance_program_revisions set recorded_at=now()-interval '4 days' where person_id=${own} and version=4`);
  evidence=(await get())[0]!;
  expect(evidence.revisedAt).not.toBeNull();expect(evidence.sessions.map(s=>s.id)).toEqual([first]);
  expect((await asUser(founder,'select * from public.performance_progression_decisions')).rows).toHaveLength(1);
 });

});

describe('Phase 5 owner-bound fuel references',()=>{
 const targets={calories:2400,protein:150,waterMl:2500,goalWeight:80,unit:'kg'};
 const request=crypto.randomUUID();
 const save=(expected=0,payload:object=targets,id=request)=>`select public.performance_save_fuel_targets('${id}',${expected},'${JSON.stringify(payload)}') as version`;
 it('saves and replays once; denies anonymous, direct writes and cross-owner reads',async()=>{
  expect((await asUser(founder,save())).rows).toEqual([{version:1}]);
  expect((await asUser(founder,save())).rows).toEqual([{version:1}]);
  for(const table of ['performance_fuel_targets','performance_fuel_target_revisions']){
   expect((await asUser(member,`select * from public.${table}`)).rows).toHaveLength(0);
   expect((await asUser(founder,`select * from public.${table}`)).rows).toHaveLength(1);
   await expect(asUser(founder,`delete from public.${table}`)).rejects.toThrow();
  }
  await db.exec('set role anon');try{await expect(db.query(save())).rejects.toThrow();}finally{await db.exec('reset role');}
  await expect(asUser(founder,save(0,targets,crypto.randomUUID()))).rejects.toThrow(/changed/);
  await expect(asUser(founder,save(0,{...targets,protein:160}))).rejects.toThrow(/reused/);
 });
 it('rejects malformed values atomically and retains prior revisions when cleared',async()=>{
  for(const change of [{calories:0},{waterMl:1.5},{goalWeight:701},{protein:'150'},{unit:'stone'},{owner:member}])await expect(asUser(founder,save(1,{...targets,...change},crypto.randomUUID()))).rejects.toThrow();
  expect((await asUser(founder,'select version from public.performance_fuel_targets')).rows).toEqual([{version:1}]);
  expect((await asUser(founder,save(1,{calories:null,protein:null,waterMl:null,goalWeight:null,unit:'lb'},crypto.randomUUID()))).rows).toEqual([{version:2}]);
  expect((await asUser(founder,'select targets from public.performance_fuel_target_revisions where version=1')).rows).toEqual([{targets}]);
  expect((await asUser(founder,save())).rows).toEqual([{version:1}]);
 });
});

describe('Phase 6 recovery routine integrity',()=>{
 let day:string;const request=crypto.randomUUID();let payload:{day:string;action:string;minutes:number;cue:string;outcome:null|string};
 const call=(expected:number,p:object=payload,id=request)=>`select public.performance_save_recovery_routine('${id}',${expected},'${JSON.stringify(p)}') as version`;
 it('uses owner-local today, saves/replays once, isolates reads and denies direct/anonymous writes',async()=>{
  day=(await db.query<{day:string}>(`select ((now() at time zone timezone)::date)::text as day from public.persons where auth_user_id='${founder}'`)).rows[0]!.day;
  payload={day,action:'quiet-time',minutes:15,cue:'Before my next sleep',outcome:null};
  expect((await asUser(founder,call(0))).rows).toEqual([{version:1}]);expect((await asUser(founder,call(0))).rows).toEqual([{version:1}]);
  for(const table of ['performance_recovery_routines','performance_recovery_revisions']){
   expect((await asUser(member,`select * from public.${table}`)).rows).toHaveLength(0);
   expect((await asUser(founder,`select * from public.${table}`)).rows).toHaveLength(1);
   await expect(asUser(founder,`delete from public.${table}`)).rejects.toThrow();
  }
  await db.exec('set role anon');try{await expect(db.query(call(0))).rejects.toThrow();}finally{await db.exec('reset role');}
  await expect(asUser(founder,call(0,payload,crypto.randomUUID()))).rejects.toThrow(/changed/);
  await expect(asUser(founder,call(0,{...payload,minutes:20}))).rejects.toThrow(/reused/);
 });
 it('rejects future/backfilled plans, premature outcomes and malformed input without a partial write',async()=>{
  const {shiftDay}=await import('../src/domains/performance/fuel');
  for(const change of [{day:shiftDay(day,1)},{day:shiftDay(day,-1)},{outcome:'done'},{minutes:1},{minutes:5.5},{cue:'x'.repeat(121)},{action:'treatment'},{owner:member}])await expect(asUser(founder,call(1,{...payload,...change},crypto.randomUUID()))).rejects.toThrow();
  expect((await asUser(founder,'select version from public.performance_recovery_routines')).rows).toEqual([{version:1}]);
  expect((await asUser(founder,call(1,{...payload,minutes:20},crypto.randomUUID()))).rows).toEqual([{version:2}]);
 });
 it('freezes past plans while versioning follow-through corrections and preserving original intent',async()=>{
  const {shiftDay}=await import('../src/domains/performance/fuel');const yesterday=shiftDay(day,-1);const past={...payload,day:yesterday};
  // Synthetic past plan: only test-admin SQL can create a backdated plan.
  const own=`(select id from public.persons where auth_user_id='${founder}')`;
  await db.exec(`insert into public.performance_recovery_routines values(${own},'${yesterday}','UTC','${JSON.stringify(past)}',1,now());insert into public.performance_recovery_revisions values(${own},'${yesterday}',1,'${JSON.stringify(past)}',gen_random_uuid(),'synthetic',now())`);
  await expect(asUser(founder,call(1,{...past,minutes:30,outcome:'done'},crypto.randomUUID()))).rejects.toThrow(/fixed/);
  const id=crypto.randomUUID();expect((await asUser(founder,call(1,{...past,outcome:'partial'},id))).rows).toEqual([{version:2}]);expect((await asUser(founder,call(1,{...past,outcome:'partial'},id))).rows).toEqual([{version:2}]);
  expect((await asUser(founder,call(2,past,crypto.randomUUID()))).rows).toEqual([{version:3}]);
  expect((await asUser(founder,`select routine from public.performance_recovery_revisions where day='${yesterday}' and version=1`)).rows).toEqual([{routine:past}]);
 });
});

describe('Phase 7 movement ownership and audit',()=>{
 let entry:{id:string;day:string;kind:string;minutes:number;distance:null|number;unit:string;intensity:null;note:string;voided:boolean};const request=crypto.randomUUID();
 const save=(expected=0,value:object=entry,id=request)=>`select public.performance_save_movement('${id}',${expected},'${JSON.stringify(value)}') as version`;
 it('saves, replays once and isolates owner records and revisions',async()=>{
  const day=(await db.query<{day:string}>(`select ((now() at time zone timezone)::date)::text as day from public.persons where auth_user_id='${founder}'`)).rows[0]!.day;
  entry={id:crypto.randomUUID(),day,kind:'walk',minutes:25,distance:1,unit:'mi',intensity:null,note:'Synthetic',voided:false};
  expect((await asUser(founder,save())).rows).toEqual([{version:1}]);expect((await asUser(founder,save())).rows).toEqual([{version:1}]);
  for(const table of ['performance_movements','performance_movement_revisions']){expect((await asUser(member,`select * from public.${table}`)).rows).toHaveLength(0);await expect(asUser(founder,`delete from public.${table}`)).rejects.toThrow();}
  await db.exec('set role anon');try{await expect(db.query(save())).rejects.toThrow();}finally{await db.exec('reset role');}
  await expect(asUser(founder,save(0,entry,crypto.randomUUID()))).rejects.toThrow(/changed/);await expect(asUser(founder,save(0,{...entry,minutes:30}))).rejects.toThrow(/reused/);
 });
 it('rejects invalid types, dates and modality values, then versions removal without erasing history',async()=>{
  const {shiftDay}=await import('../src/domains/performance/fuel');
  for(const patch of [{minutes:0},{minutes:1.1},{day:shiftDay(entry.day,1)},{day:shiftDay(entry.day,-28)},{distance:0},{kind:'mobility'},{intensity:'hard'},{unit:'meters'},{owner:member}])await expect(asUser(founder,save(1,{...entry,...patch},crypto.randomUUID()))).rejects.toThrow();
  expect((await asUser(founder,save(1,{...entry,voided:true},crypto.randomUUID()))).rows).toEqual([{version:2}]);expect((await asUser(founder,`select entry from public.performance_movement_revisions where id='${entry.id}' and version=1`)).rows).toEqual([{entry}]);
 });
 it('enforces daily quota including removed entries',async()=>{
  for(let i=1;i<20;i++)await asUser(founder,save(0,{...entry,id:crypto.randomUUID()},crypto.randomUUID()));
  await expect(asUser(founder,save(0,{...entry,id:crypto.randomUUID()},crypto.randomUUID()))).rejects.toThrow(/Twenty/);
 });
});

describe('Phase 7 exercise identity and manual progression',()=>{
 it('enforces catalog identity and keeps manual exercises out of otherwise eligible evidence',async()=>{
  const user=crypto.randomUUID();await db.exec(`insert into auth.users(id) values('${user}')`);
  const {catalogExercise,exerciseCatalog}=await import('../src/domains/performance/catalog');const {startProgramSession}=await import('../src/domains/performance/program');
  const ex={...catalogExercise(exerciseCatalog[10]),load:40};const plan={title:'Catalog test',unit:'lb' as const,exercises:[ex]};const slot=crypto.randomUUID();const program={title:'Manual test',sessions:[{id:slot,plan}]};
  const save=(kind:string,expected:number,payload:object)=>`select public.performance_save('${kind}',gen_random_uuid(),${expected},'${JSON.stringify(payload)}')`;
  const profile={goal:'strength',experience:'returning',daysPerWeek:3,minutes:40,equipment:'gym',limitations:'',unit:'lb'};
  await asUser(user,save('profile',0,profile));
  await expect(asUser(user,save('plan',0,{...plan,exercises:[{...ex,name:'Wrong catalog label'}]}))).rejects.toThrow(/identity/);
  await expect(asUser(user,save('program',0,{...program,sessions:[{id:slot,plan:{...plan,exercises:[{...ex,progression:'automatic'}]}}]}))).rejects.toThrow(/progression/);
  await asUser(user,save('plan',0,plan));await asUser(user,save('program',0,program));
  const today=new Date().toISOString().slice(0,10);
  await asUser(user,save('checkin',0,{day:today,sleepMinutes:480,energy:4,soreness:'none',weight:null,unit:'lb',calories:null,protein:null,waterMl:null,nutritionComplete:false}));
  const sources=[];
  for(const ago of [4,2]){const session=startProgramSession({ruleVersion:1,programVersion:1,slotId:slot,mode:'planned',timeBudget:40,originalPlan:plan,plan});session.startedAt=new Date(Date.now()-ago*86400000-3600000).toISOString();session.endedAt=new Date(Date.now()-ago*86400000).toISOString();session.status='complete';session.sets=session.sets.map(s=>({...s,done:true,effort:7}));await asUser(user,save('session',0,session));sources.push(session.id);}
  const review=async()=>(await asUser<{value:{status:string;proposal:{token:string}|null}[]}>(user,'select public.performance_progression() as value')).rows[0]!.value[0]!;
  expect((await review()).proposal).toBeNull();
  await expect(asUser(user,save('plan',1,{...plan,exercises:[{...ex,reps:9}],sourceSessionIds:sources}))).rejects.toThrow(/manual targets/);
  const own=`(select id from public.persons where auth_user_id='${user}')`;
  // Test-only matching historical prescriptions isolate the policy from the existing changed-plan gate.
  await db.exec(`update public.performance_programs set sessions=replace(sessions::text,'manual','review')::jsonb where person_id=${own};update public.performance_session_context set prescription=replace(prescription::text,'manual','review')::jsonb where person_id=${own}`);
  const ready=await review();expect(ready.status).toBe('ready');
  await db.exec(`update public.performance_programs set sessions=replace(sessions::text,'review','manual')::jsonb where person_id=${own}`);
  await expect(asUser(user,`select public.performance_progression_accept(gen_random_uuid(),1,'${slot}','${ready.proposal!.token}')`)).rejects.toThrow();
 });
});
