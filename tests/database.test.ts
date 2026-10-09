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
   alter table storage.objects enable row level security;
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
  it('atomically records daily rituals, safely replays receipts and preserves reviewed version history', async () => {
    const today = `(now() at time zone (select timezone from public.persons where auth_user_id='${founder}'))::date`;
    const request = 'd7000000-0000-4000-8000-000000000001',
      second = 'd7000000-0000-4000-8000-000000000002',
      review = 'd7000000-0000-4000-8000-000000000003';
    const ritual = (
      await asUser<{ grooming_set_ritual: string }>(
        founder,
        "select public.grooming_set_ritual('evening','Evening standard','Follow familiar care\\nNotice comfort')",
      )
    ).rows[0]!.grooming_set_ritual;
    const version = (
      await asUser<{ version: number }>(
        founder,
        `select version from public.grooming_rituals where id='${ritual}'`,
      )
    ).rows[0]!.version;
    const call = (id: string, day = today, v = version) =>
      `select public.grooming_record_practice('${id}','${ritual}',${v},${day},'') as receipt`;
    const first = (await asUser<{ receipt: { id: string } }>(founder, call(request))).rows[0]!
      .receipt;
    expect(first.id).toBe(request);
    expect(
      (await asUser<{ receipt: { id: string } }>(founder, call(second))).rows[0]!.receipt.id,
    ).toBe(request);
    expect(
      (await asUser(founder, `select * from public.grooming_checkins where ritual_id='${ritual}'`))
        .rows,
    ).toHaveLength(1);
    expect(
      (await asUser(member, `select * from public.grooming_checkins where ritual_id='${ritual}'`))
        .rows,
    ).toHaveLength(0);
    await expect(asUser(member, call(request,`(now() at time zone (select timezone from public.persons where auth_user_id='${member}'))::date`))).rejects.toThrow(/Ritual changed/);
    await expect(asUser(founder, call(request, `(${today})-1`))).rejects.toThrow(/request changed/);
    await expect(
      asUser(founder, call('d7000000-0000-4000-8000-000000000004', `(${today})-1`)),
    ).rejects.toThrow(/day changed/);
    await expect(
      asUser(founder, call('d7000000-0000-4000-8000-000000000005', today, version + 1)),
    ).rejects.toThrow(/changed/);
    await asUser(founder, `select public.grooming_practice_feedback('${first.id}','Comfortable')`);
    await asUser(founder, `select public.grooming_practice_feedback('${first.id}','Comfortable')`);
    await expect(
      asUser(member, `select public.grooming_practice_feedback('${first.id}','Comfortable')`),
    ).rejects.toThrow(/not found/);
    await expect(
      asUser(
        founder,
        `select public.grooming_practice_feedback('${first.id}','Something irritated')`,
      ),
    ).rejects.toThrow(/already recorded/);
    const owner = `(select id from public.persons where auth_user_id='${founder}')`;
    await asUser(
      founder,
      `insert into public.grooming_products(person_id,name,category,relation,ritual_id) values(${owner},'My external oil','beard','in_use','${ritual}')`,
    );
    const save = `select public.grooming_review_ritual('${review}','evening',${version},'Refined standard','Keep my familiar care',null) as id`;
    const next = (await asUser<{ id: string }>(founder, save)).rows[0]!.id;
    expect((await asUser<{ id: string }>(founder, save)).rows[0]!.id).toBe(next);
    expect(
      (
        await asUser(
          founder,
          `select * from public.grooming_products where name='My external oil' and ritual_id='${next}'`,
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (await asUser(founder, `select * from public.grooming_checkins where ritual_id='${ritual}'`))
        .rows,
    ).toHaveLength(1);
    // Exact replay remains valid after the ritual is retired.
    expect(
      (await asUser<{ receipt: { id: string } }>(founder, call(request))).rows[0]!.receipt.id,
    ).toBe(first.id);
    await expect(
      asUser(founder, save.replace(review, 'd7000000-0000-4000-8000-000000000006')),
    ).rejects.toThrow(/Ritual changed/);
    await expect(
      asUser(founder, save.replace('Refined standard', 'Changed payload')),
    ).rejects.toThrow(/request changed/);
    await expect(
      asUser(
        founder,
        `insert into public.grooming_checkins(person_id,ritual_id,done) values(${owner},'${next}',true)`,
      ),
    ).rejects.toThrow();
    await db.exec('set role anon');
    try {
      await expect(db.query(call(request))).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
    await db.exec(
      `delete from public.grooming_products where name='My external oil';delete from public.grooming_rituals where id in ('${ritual}','${next}')`,
    );
  });

  it('isolates Cabinet records, protects identity and versions edits',async()=>{
    const id='ce000000-0000-4000-8000-000000000001';
    const owner=`(select id from public.persons where auth_user_id='${founder}')`;
    await asUser(founder,`insert into public.grooming_products(id,person_id,name,category,relation,catalog_product_id,version) values('${id}',${owner},'Test beard oil','beard','saved','gid://shopify/Product/9001',99)`);
    expect((await asUser<{version:number}>(founder,`select version from public.grooming_products where id='${id}'`)).rows[0]?.version).toBe(1);
    expect((await asUser(member,`select * from public.grooming_products where id='${id}'`)).rows).toHaveLength(0);
    expect((await asUser(member,`update public.grooming_products set relation='in_use' where id='${id}' returning id`)).rows).toHaveLength(0);
    expect((await asUser(member,`delete from public.grooming_products where id='${id}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(founder,`update public.grooming_products set catalog_product_id='gid://shopify/Product/9002' where id='${id}'`)).rejects.toThrow();
    await expect(asUser(founder,`update public.grooming_products set version=99 where id='${id}'`)).rejects.toThrow();
    await asUser(founder,`update public.grooming_products set relation='running_low',note='Member reported' where id='${id}' and version=1`);
    expect((await asUser<{version:number;relation:string}>(founder,`select version,relation from public.grooming_products where id='${id}'`)).rows).toEqual([{version:2,relation:'running_low'}]);
    expect((await asUser(founder,`update public.grooming_products set relation='finished' where id='${id}' and version=1 returning id`)).rows).toHaveLength(0);
    await expect(asUser(founder,`insert into public.grooming_products(person_id,name,category,relation,catalog_product_id) values(${owner},'Duplicate','beard','saved','gid://shopify/Product/9001')`)).rejects.toThrow();
    await expect(asUser(founder,`insert into public.grooming_products(person_id,name,category,relation) values(${owner},'Fake purchase','beard','verified_order')`)).rejects.toThrow();
    await db.exec('set role anon');
    try{await expect(db.query('select * from public.grooming_products')).rejects.toThrow();}finally{await db.exec('reset role');}
    await asUser(founder,`delete from public.grooming_products where id='${id}' and version=2`);
  });
  it('rejects Cabinet links to another member ritual',async()=>{
    const owner=`(select id from public.persons where auth_user_id='${founder}')`;
    const ritual=(await asUser<{grooming_set_ritual:string}>(member,"select public.grooming_set_ritual('weekly','Member ritual','Cleanse and condition')")).rows[0]!.grooming_set_ritual;
    await expect(asUser(founder,`insert into public.grooming_products(person_id,name,category,relation,ritual_id) values(${owner},'Cross-owner oil','beard','in_use','${ritual}')`)).rejects.toThrow();
    await db.exec(`delete from public.grooming_rituals where id='${ritual}'`);
  });
  it('isolates Council and Table histories on the existing turn/message ledger',async()=>{
    const conversation='cb000000-0000-4000-8000-000000000001',turn='cb000000-0000-4000-8000-000000000002';
    const otherConversation='cb000000-0000-4000-8000-000000000003',otherTurn='cb000000-0000-4000-8000-000000000004';
    await asUser(founder,`select public.ai_begin_turn('${conversation}','${turn}','Founder-only question','test-model',true,'council.1.t.athena,themis')`);
    await asUser(founder,`select public.ai_finish_turn('${turn}','Founder-only Table synthesis','complete',40,60)`);
    await asUser(member,`select public.ai_begin_turn('${otherConversation}','${otherTurn}','Member-only question','test-model',false,'council.1.s.apollo')`);
    await asUser(member,`select public.ai_finish_turn('${otherTurn}','Member-only creative reply','complete',10,20)`);
    expect((await asUser(member,`select * from public.ai_turns where id='${turn}'`)).rows).toHaveLength(0);
    expect((await asUser(member,`select * from public.ai_messages where conversation_id='${conversation}'`)).rows).toHaveLength(0);
    expect((await asUser(founder,`select * from public.ai_turns where id='${otherTurn}'`)).rows).toHaveLength(0);
    expect((await asUser(member,`select assistant_text,prompt_version from public.ai_turns where id='${otherTurn}'`)).rows).toEqual([{assistant_text:'Member-only creative reply',prompt_version:'council.1.s.apollo'}]);
    await expect(asUser(member,`select public.ai_begin_turn('${conversation}','cb000000-0000-4000-8000-000000000005','Unauthorized Council request','test-model',true,'council.1.s.athena')`)).rejects.toThrow();
    expect((await asUser<{ai_finish_turn:boolean}>(member,`select public.ai_finish_turn('${turn}','Tampered synthesis','complete',0,0)`)).rows[0]?.ai_finish_turn).toBe(false);
    await db.exec('set role anon');
    try {await expect(db.query('select * from public.ai_turns')).rejects.toThrow();} finally {await db.exec('reset role');}
    await db.exec(`delete from public.ai_conversations where id in ('${conversation}','${otherConversation}');delete from public.ai_usage where id in ('${turn}','${otherTurn}')`);
  });

  it('isolates command history, atomically versions feedback, rejects stale and anonymous writes', async () => {
    const arrival = JSON.stringify({sleepMinutes: null, energy: null, soreness: null, bandwidth: null, minutes: null});
    const snapshot = JSON.stringify({day: 'DAY', ruleVersion: 1, state: 'STEADY', decisions: [{id:'focus'}]});
    const request = 'db000000-0000-4000-8000-000000000001';
    const day = `(now() at time zone (select timezone from public.persons where auth_user_id='${founder}'))::date`;
    const sqlSnapshot = `replace('${snapshot}','DAY',(${day})::text)::jsonb`;
    const call = `select public.daily_command_save('${request}',${day},0,'arrival','${arrival}'::jsonb,${sqlSnapshot},null)`;
    expect((await asUser<{daily_command_save:number}>(founder,call)).rows[0]?.daily_command_save).toBe(1);
    expect((await asUser<{daily_command_save:number}>(founder,call)).rows[0]?.daily_command_save).toBe(1);
    expect((await asUser(member,'select * from public.daily_command_records')).rows).toHaveLength(0);
    expect((await asUser(member,'select * from public.daily_command_revisions')).rows).toHaveLength(0);
    await expect(asUser(founder,`update public.daily_command_records set version=9`)).rejects.toThrow();
    await expect(asUser(founder,call.replace(request,'db000000-0000-4000-8000-000000000002'))).rejects.toThrow(/changed/);
    await expect(asUser(founder,call.replace('"energy":null','"energy":9').replace(request,'db000000-0000-4000-8000-000000000003'))).rejects.toThrow();
    const outcome = `'{"decisions":[{"id":"focus","result":"skipped"}],"fit":"too-much","tomorrow":"Keep it smaller"}'::jsonb`;
    const close = `select public.daily_command_save('db000000-0000-4000-8000-000000000004',${day},1,'outcome','${arrival}'::jsonb,${sqlSnapshot},${outcome})`;
    expect((await asUser<{daily_command_save:number}>(founder,close)).rows[0]?.daily_command_save).toBe(2);
    expect((await asUser(founder,'select * from public.daily_command_revisions')).rows).toHaveLength(2);
    await expect(asUser(founder,close.replace('000000000004','000000000005').replace(",1,'outcome'",",2,'outcome'").replace('"id":"focus","result"','"id":"invented","result"'))).rejects.toThrow(/Unknown decision/);
    await db.exec('set role anon');
    try { await expect(db.query(call)).rejects.toThrow(); await expect(db.query('select * from public.daily_command_records')).rejects.toThrow(); } finally { await db.exec('reset role'); }
  });

  it('keeps grooming evidence private and professional proposals member-controlled',async()=>{
    const owner=`(select id from public.persons where auth_user_id='${founder}')`;
    const scan='9a000000-0000-4000-8000-000000000001',photo='9a000000-0000-4000-8000-000000000002',look='9a000000-0000-4000-8000-000000000003',pass='9a000000-0000-4000-8000-000000000004',proposal='9a000000-0000-4000-8000-000000000005',code='a'.repeat(64);
    await asUser(founder,`insert into public.grooming_profiles(person_id,beard_focus,preferred_look) values(${owner},'Keep chin length','A full beard')`);
    expect((await asUser(member,'select * from public.grooming_profiles')).rows).toHaveLength(0);
    const ritual=(await asUser<{grooming_set_ritual:string}>(founder,"select public.grooming_set_ritual('morning','Beard routine','Cleanse, then condition')")).rows[0]!.grooming_set_ritual;
    await expect(asUser(member,`insert into public.grooming_checkins(person_id,ritual_id,done) values((select id from public.persons where auth_user_id='${member}'),'${ritual}',true)`)).rejects.toThrow();
    expect((await asUser<{grooming_begin_scan:boolean}>(founder,`select public.grooming_begin_scan('${scan}')`)).rows[0]?.grooming_begin_scan).toBe(true);
    await asUser(founder,`insert into public.grooming_photos(id,person_id,scan_id,storage_key,view,captured_on,media_type,byte_size) values('${photo}',${owner},'${scan}','${founder}/${photo}.jpg','front',current_date,'image/jpeg',1000)`);
    expect((await asUser(member,'select * from public.grooming_photos')).rows).toHaveLength(0);
    expect((await asUser<{grooming_finish_scan:boolean}>(founder,`select public.grooming_finish_scan('${scan}','complete','','Visible beard shape','Discuss line upkeep','[{"area":"beard","description":"Fuller at the chin","confidence":"medium"}]'::jsonb)`)).rows[0]?.grooming_finish_scan).toBe(true);
    expect((await asUser(member,'select * from public.grooming_scan_observations')).rows).toHaveLength(0);
    expect((await asUser<{grooming_begin_look:boolean}>(member,`select public.grooming_begin_look('${look}','${photo}','beard','short-boxed')`)).rows[0]?.grooming_begin_look).toBe(false);
    expect((await asUser<{grooming_begin_look:boolean}>(founder,`select public.grooming_begin_look('${look}','${photo}','beard','short-boxed')`)).rows[0]?.grooming_begin_look).toBe(true);
    await expect(asUser(founder,`insert into public.grooming_scan_observations(person_id,scan_id,area,description,confidence,source_version) values(${owner},'${scan}','beard','Forged score','high','fake')`)).rejects.toThrow();
    await expect(asUser(member,`insert into storage.objects(bucket_id,name) values('grooming-private','${founder}/${photo}.jpg')`)).rejects.toThrow();
    await asUser(founder,`insert into public.grooming_professional_passes(id,person_id,label,beard,expires_at) values('${pass}',${owner},'Trim visit','Keep chin length',now()+interval '6 days')`);
    expect((await asUser(member,'select * from public.grooming_professional_passes')).rows).toHaveLength(0);
    expect((await asUser<{grooming_store_pass_code:boolean}>(founder,`select public.grooming_store_pass_code('${pass}','${code}')`)).rows[0]?.grooming_store_pass_code).toBe(true);
    expect((await asUser<{grooming_claim_pass:string|null}>(founder,`select public.grooming_claim_pass('${code}')`)).rows[0]?.grooming_claim_pass).toBe(null);
    await expect(asUser(member,'select * from public.grooming_professional_codes')).rejects.toThrow();
    expect((await asUser<{grooming_claim_pass:string|null}>(member,`select public.grooming_claim_pass('${code}')`)).rows[0]?.grooming_claim_pass).toBe(pass);
    expect((await asUser<{beard:string}>(member,`select beard from public.grooming_professional_passes where id='${pass}'`)).rows[0]?.beard).toBe('Keep chin length');
    expect((await asUser<{grooming_propose_service:boolean}>(member,`select public.grooming_propose_service('${pass}','${proposal}',current_date,'Beard trim','Preserved chin, shaped sides','Four weeks')`)).rows[0]?.grooming_propose_service).toBe(true);
    expect((await asUser(member,`select * from public.grooming_looks where id='${proposal}'`)).rows).toHaveLength(0);
    expect((await asUser<{grooming_decide_service:boolean}>(member,`select public.grooming_decide_service('${proposal}',true)`)).rows[0]?.grooming_decide_service).toBe(false);
    expect((await asUser<{grooming_decide_service:boolean}>(founder,`select public.grooming_decide_service('${proposal}',true)`)).rows[0]?.grooming_decide_service).toBe(true);
    expect((await asUser<{title:string}>(founder,`select title from public.grooming_looks where id='${proposal}'`)).rows[0]?.title).toBe('Beard trim');
    await asUser(founder,`update public.grooming_professional_passes set revoked_at=now() where id='${pass}'`);
    expect((await asUser(member,`select id from public.grooming_professional_passes where id='${pass}'`)).rows).toHaveLength(0);
    expect((await asUser(member,`select id from public.grooming_service_proposals where id='${proposal}'`)).rows).toHaveLength(0);
    await expect(asUser(founder,'select * from public.grooming_look_usage')).rejects.toThrow();
    await expect(asUser(founder,'select * from public.grooming_scan_usage')).rejects.toThrow();
  });
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
  it('confirms exactly one owner action, rejects stale and foreign decisions, and permits a safe retry', async () => {
    const action='62000000-0000-4000-8000-000000000001';
    const call=(version:number,id=action)=>`select public.daily_complete_action(${today},'${id}',${version}) as version`;
    await expect(asUser(member,call(2))).rejects.toThrow();
    await expect(asUser(founder,call(2,'62000000-0000-4000-8000-000000000099'))).rejects.toThrow();
    await expect(asUser(founder,call(1))).rejects.toThrow('changed');
    expect((await asUser<{version:number}>(founder,call(2))).rows[0]?.version).toBe(3);
    expect((await asUser<{version:number}>(founder,call(2))).rows[0]?.version).toBe(3);
    expect((await asUser<{done:boolean}>(founder,`select done from public.daily_actions where id='${action}'`)).rows[0]?.done).toBe(true);
    await db.exec('set role anon');
    try { await expect(db.query(call(3))).rejects.toThrow(); }
    finally { await db.exec('reset role'); }
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
  it('stores an edited action only after the owner approves the pending proposal',async()=>{
    const turn3='86000000-0000-4000-8000-000000000008';
    const next='86000000-0000-4000-8000-000000000009';
    const owner=`(select id from public.persons where auth_user_id='${founder}')`;
    await db.exec(`insert into public.ai_turns(id,person_id,conversation_id,user_text,assistant_text,status,model,context_included,prompt_version)
      values('${turn3}',${owner},'${conversation}','Plan a specific move','Take one step','complete','fixture',false,'fixture')`);
    await asUser(founder,`select public.ai_propose_daily_action('${next}','${turn3}','Vague step')`);
    await expect(asUser(member,`select public.ai_decide_daily_action_v2('${next}',true,'Intrusion')`)).rejects.toThrow();
    await expect(asUser(founder,`select public.ai_decide_daily_action_v2('${next}',true,' ')`)).rejects.toThrow();
    expect((await asUser(founder,`select status from public.ai_action_proposals where id='${next}'`)).rows).toEqual([{status:'pending'}]);
    await asUser(founder,`select public.ai_decide_daily_action_v2('${next}',true,'Send the proposal to Katie')`);
    expect((await asUser(founder,`select title from public.daily_actions where id='${next}'`)).rows).toEqual([{title:'Send the proposal to Katie'}]);
    expect((await asUser(founder,`select title,status from public.ai_action_proposals where id='${next}'`)).rows).toEqual([{title:'Send the proposal to Katie',status:'executed'}]);
    await asUser(founder,`select public.ai_decide_daily_action_v2('${next}',true,'Send the proposal to Katie')`);
    expect((await asUser(founder,`select id from public.daily_actions where id='${next}'`)).rows).toHaveLength(1);
    await expect(asUser(founder,`select public.ai_decide_daily_action_v2('${next}',true,'Different action')`)).rejects.toThrow('different title');
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
 beforeAll(async()=>{
  await db.exec(`delete from public.performance_checkins where person_id=(select id from public.persons where auth_user_id='${founder}')`);
  // Recovery eligibility uses the member's calendar day, which can differ from UTC.
  check.day=(await db.query<{day:string}>(`select ((now() at time zone timezone)::date)::text as day from public.persons where auth_user_id='${founder}'`)).rows[0]!.day;
 });
 const slot=crypto.randomUUID(),other=crypto.randomUUID(),exercise=crypto.randomUUID();
 const plan={title:'Progression A',unit:'lb' as const,exercises:[{id:exercise,name:'Row',sets:2,reps:8,load:40,restSeconds:90}]};
 const program={title:'Learning cycle',sessions:[{id:slot,plan},{id:other,plan:{...plan,title:'Progression B'}}]};
 const call=(kind:string,version:number,payload:unknown,request=crypto.randomUUID())=>`select public.performance_save('${kind}','${request}',${version},'${JSON.stringify(payload).replaceAll("'","''")}'::jsonb) as version`;
 const review=async()=> (await asUser<{value:import('../src/domains/performance/progression').ProgressionReview[]}>(founder,'select public.performance_progression() as value')).rows[0]!.value;
 let token='',checkVersion=1;
 const check={day:'',sleepMinutes:450,energy:4,soreness:'none',weight:null,unit:'lb',calories:null,protein:null,waterMl:null,nutritionComplete:false};
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

describe('account claim: atomic import, isolation and conflict recovery',()=>{
  it('imports once, preserves existing records, rejects silent replacement and cross-user writes',async()=>{
    const user='9b000000-0000-4000-8000-000000000001',other='9b000000-0000-4000-8000-000000000002';
    const request='9b100000-0000-4000-8000-000000000001',second='9b100000-0000-4000-8000-000000000002';
    await db.exec(`insert into auth.users(id) values('${user}'),('${other}')`);
    const call=(id:string,text:string,replace=false,expected=0,day="null")=>`select public.onboarding_claim('${id}','body','${text}','America/Chicago',now(),${replace},${expected},${day}) as receipt`;
    type Receipt={receipt:{status:string;day:string;version:number}};
    const first=(await asUser<Receipt>(user,call(request,'Train deliberately'))).rows[0]!.receipt;
    expect(first.status).toBe('saved');
    const repeated=(await asUser<Receipt>(user,call(request,'Train deliberately'))).rows[0]!.receipt;
    expect(repeated.status).toBe('saved');
    expect((await asUser(user,'select * from public.onboarding_claims')).rows).toHaveLength(1);
    expect((await asUser(user,'select version from public.daily_entries')).rows).toEqual([{version:1}]);
    await expect(asUser(user,call(request,'Changed payload'))).rejects.toThrow(/changed/);
    expect((await asUser(other,'select * from public.onboarding_claims')).rows).toHaveLength(0);
    await expect(asUser(other,`insert into public.onboarding_claims(person_id,request_id,focus,day,intention) values((select id from public.persons where auth_user_id='${other}'),'${request}','body',current_date,'Forged')`)).rejects.toThrow();
    await db.exec(`update public.daily_entries set energy=4,sleep_minutes=420,reflection='Private reflection' where person_id=(select id from public.persons where auth_user_id='${user}');
      insert into public.daily_actions(person_id,day,id,title,done,position) select person_id,day,'9b200000-0000-4000-8000-000000000001','Make the call',false,0 from public.daily_entries where person_id=(select id from public.persons where auth_user_id='${user}')`);
    const conflict=(await asUser<Receipt>(user,call(second,'Protect my time'))).rows[0]!.receipt;
    expect(conflict.status).toBe('conflict');
    expect((await asUser<Receipt>(user,call(second,'Protect my time',true,0))).rows[0]!.receipt.status).toBe('conflict');
    expect((await asUser<Receipt>(user,call(second,'Protect my time',true,1,"'2020-01-01'"))).rows[0]!.receipt.status).toBe('day_changed');
    expect((await asUser<Receipt>(user,call(second,'Protect my time',true,1,`'${first.day}'`))).rows[0]!.receipt.status).toBe('saved');
    expect((await asUser(user,'select intention,version from public.daily_entries')).rows).toEqual([{intention:'Protect my time',version:2}]);
    expect((await asUser(user,'select energy,sleep_minutes,reflection from public.daily_entries')).rows).toEqual([{energy:4,sleep_minutes:420,reflection:'Private reflection'}]);
    expect((await asUser(user,'select title,done from public.daily_actions')).rows).toEqual([{title:'Make the call',done:false}]);
    expect((await asUser(user,'select onboarding_completed,timezone from public.persons')).rows).toEqual([{onboarding_completed:true,timezone:'America/Chicago'}]);
    await db.exec('set role anon');
    try {await expect(db.query(call(request,'Train deliberately'))).rejects.toThrow(/permission/);} finally {await db.exec('reset role');}
  });
});

describe('owner-only company rooms and immutable Talk scope', () => {
  const authA = 'c9000000-0000-4000-8000-000000000001';
  const authB = 'c9000000-0000-4000-8000-000000000002';
  let personA = '';
  let personB = '';
  const companyA = 'c9000000-0000-4000-8000-000000000005';
  const companyB = 'c9000000-0000-4000-8000-000000000006';
  const thread = 'c9000000-0000-4000-8000-000000000007';
  const request = 'c9000000-0000-4000-8000-000000000008';
  const begin = (company = companyA, conversation = thread, req = request) => `select public.company_begin_turn('${company}','${conversation}','${req}','Synthetic Company Sentinel','test-model','company-test')`;
  beforeAll(async () => {
    await db.exec(`insert into auth.users(id) values('${authA}'),('${authB}');`);
    personA = (await db.query<{id: string}>(`select id from public.persons where auth_user_id='${authA}'`)).rows[0]!.id;
    personB = (await db.query<{id: string}>(`select id from public.persons where auth_user_id='${authB}'`)).rows[0]!.id;
  });
  it('permits owner creation, denies forged ownership and preserves brief versions', async () => {
    await asUser(authA, `insert into public.companies(id,person_id,name,brief) values('${companyA}','${personA}','Synthetic A','A confidential brief'),('${companyB}','${personA}','Synthetic B','B confidential brief')`);
    expect((await asUser(authB, 'select * from public.companies')).rows).toHaveLength(0);
    await expect(asUser(authB, `insert into public.companies(person_id,name) values('${personA}','Forged')`)).rejects.toThrow(/row-level security/);
    expect((await asUser(authB, `update public.companies set name='Intrusion',version=2 where id='${companyA}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(authA, `update public.companies set person_id='${personB}' where id='${companyA}'`)).rejects.toThrow(/permission denied/);
    await expect(asUser(authA, `update public.companies set brief='Unversioned' where id='${companyA}'`)).rejects.toThrow(/Invalid brief version/);
    expect((await asUser(authA, `update public.companies set brief='Reviewed A',version=2 where id='${companyA}' and version=1 returning version`)).rows).toEqual([{version: 2}]);
    expect((await asUser(authA, `update public.companies set brief='Stale A',version=2 where id='${companyA}' and version=1 returning version`)).rows).toHaveLength(0);
  });
  it('reserves a company-bound turn and stores its exact brief snapshot', async () => {
    await asUser(authA, begin());
    const row = (await asUser<{ company_id: string; context_included: boolean }>(authA, `select c.company_id,t.context_included from public.ai_turns t join public.ai_conversations c on c.id=t.conversation_id where t.id='${request}'`)).rows[0]!;
    expect(row).toEqual({company_id: companyA, context_included: false});
    await asUser(authA, `update public.companies set brief='Later A',version=3 where id='${companyA}'`);
    expect((await asUser(authA, `select brief,version from public.company_turn_context where request_id='${request}'`)).rows).toEqual([{brief: 'Reviewed A',version: 2}]);
    expect((await asUser(authB, 'select * from public.company_turn_context')).rows).toHaveLength(0);
    await expect(asUser(authA, `update public.company_turn_context set brief='Corrupt' where request_id='${request}'`)).rejects.toThrow(/permission denied/);
    await asUser(authA, `select public.ai_finish_turn('${request}','Synthetic reply','complete')`);
  });
  it('rejects cross-company reuse, cross-person access, legacy entry and internal quota bypass', async () => {
    await expect(asUser(authA, begin(companyB, thread, crypto.randomUUID()))).rejects.toThrow(/scope mismatch/);
    await expect(asUser(authB, begin(companyA, crypto.randomUUID(), crypto.randomUUID()))).rejects.toThrow(/Company not found/);
    await expect(asUser(authA, `select public.ai_begin_turn('${thread}','${crypto.randomUUID()}','Personal data','model',true,'legacy')`)).rejects.toThrow(/Use company Talk/);
    await expect(asUser(authA, `select public.ai_begin_revision('${thread}','${request}','${crypto.randomUUID()}','Personal revision','regenerate','model',true,'legacy')`)).rejects.toThrow(/Use company Talk/);
    await expect(asUser(authA, `select public.ai_reserve_turn_internal('${thread}','${crypto.randomUUID()}','Bypass','model',true,'legacy')`)).rejects.toThrow(/permission denied/);
    await expect(db.exec(`update public.ai_conversations set company_id='${companyB}' where id='${thread}'`)).rejects.toThrow(/immutable/);
    expect((await asUser(authA, "select * from public.ai_search_conversations('Sentinel')")).rows).toHaveLength(0);
  });
  it('cannot adopt an existing unassigned thread and rolls back failed reservations', async () => {
    const legacyThread = crypto.randomUUID(), legacyRequest = crypto.randomUUID();
    await asUser(authA, `select public.ai_begin_turn('${legacyThread}','${legacyRequest}','Legacy context','model',false,'legacy');`);
    await asUser(authA, `select public.ai_finish_turn('${legacyRequest}','Legacy reply','complete')`);
    await expect(asUser(authA, begin(companyA, legacyThread, crypto.randomUUID()))).rejects.toThrow(/scope mismatch/);
    const failed = crypto.randomUUID();
    await expect(asUser(authA, `select public.company_begin_turn('${companyA}','${failed}','${crypto.randomUUID()}','','model','company-test')`)).rejects.toThrow();
    expect((await asUser(authA, `select id from public.ai_conversations where id='${failed}'`)).rows).toHaveLength(0);
    await expect(asUser(authA, begin(companyA, thread, request))).rejects.toThrow(/Duplicate request/);
  });
  it('denies anonymous table reads and function execution', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from public.companies')).rejects.toThrow(/permission denied/);
      await expect(db.query('select * from public.company_turn_context')).rejects.toThrow(/permission denied/);
      await expect(db.query(begin())).rejects.toThrow(/permission denied/);
    } finally { await db.exec('reset role'); }
  });
});

describe('connected company jobs and immutable reviewed work',()=>{
 const a='d9000000-0000-4000-8000-000000000001', b='d9000000-0000-4000-8000-000000000002';
 const ca='d9000000-0000-4000-8000-000000000003',cb='d9000000-0000-4000-8000-000000000004';
 const job='d9000000-0000-4000-8000-000000000005',conversation='d9000000-0000-4000-8000-000000000006';
 const v1='d9000000-0000-4000-8000-000000000007',v2='d9000000-0000-4000-8000-000000000008';
 const turn='d9000000-0000-4000-8000-000000000009';
 let owner='';
 const scope=JSON.stringify({request:'Synthetic positioning job',audience:'Founder',outcome:'A deck',constraints:'',acceptance:'A useful brief',evidence:[],figures:[]});
 const create=`select public.company_create_job('${job}','${ca}','${conversation}','${scope}') as id`;
 const save=(id=v1,expected=0,company=ca,content='{"title":"Synthetic strategy"}',source='null')=>`select public.company_save_work('${id}','${company}','${job}',${expected},'${content}',${source}) as id`;
 beforeAll(async()=>{
  await db.exec(`insert into auth.users(id) values('${a}'),('${b}');`);
  owner=(await db.query<{id:string}>(`select id from public.persons where auth_user_id='${a}'`)).rows[0]!.id;
  await asUser(a,`insert into public.companies(id,person_id,name,brief) values('${ca}','${owner}','Synthetic Work A','Original A brief'),('${cb}','${owner}','Synthetic Work B','Other B brief')`);
 });
 it('creates once with a fixed thread and retains the confirmed scope/brief',async()=>{
  expect((await asUser<{id:string}>(a,create)).rows[0]!.id).toBe(job);
  expect((await asUser<{id:string}>(a,create)).rows[0]!.id).toBe(job);
  await expect(asUser(b,create)).rejects.toThrow(/Company not found/);
  await expect(asUser(a,create.replace('Synthetic positioning job','Changed job'))).rejects.toThrow(/request changed/);
  await asUser(a,`update public.companies set brief='New confirmed A',version=2 where id='${ca}'`);
  const row=(await asUser<{company_brief:string;brief_version:number;company_id:string}>(a,`select * from public.company_jobs where id='${job}'`)).rows[0]!;
  expect(row.company_brief).toBe('Original A brief');expect(row.brief_version).toBe(1);expect(row.company_id).toBe(ca);
  expect((await asUser(b,`select * from public.company_jobs`)).rows).toHaveLength(0);
  await expect(asUser(a,`update public.company_jobs set company_id='${cb}' where id='${job}'`)).rejects.toThrow(/permission denied/);
 });
 it('atomically saves versions, replays exact saves, and rejects stale/cross-company writes',async()=>{
  expect((await asUser<{id:string}>(a,save())).rows[0]!.id).toBe(v1);
  expect((await asUser<{id:string}>(a,save())).rows[0]!.id).toBe(v1);
  await expect(asUser(a,save(v1,0,ca,'{"title":"Changed retry"}'))).rejects.toThrow(/request changed/);
  await expect(asUser(a,save(v2,0))).rejects.toThrow(/Work changed/);
  await expect(asUser(a,save(v2,1,cb))).rejects.toThrow(/Job not found/);
  await expect(asUser(b,save(v2,1))).rejects.toThrow(/Job not found/);
  expect((await asUser(b,'select * from public.company_work_versions')).rows).toHaveLength(0);
  await expect(asUser(a,`update public.company_work_versions set content='{}' where id='${v1}'`)).rejects.toThrow(/permission denied/);
  await expect(asUser(a,`delete from public.company_work_versions where id='${v1}'`)).rejects.toThrow(/permission denied/);
 });
 it('reviews an immutable snapshot without silently reviewing later revisions',async()=>{
  const review=`select public.company_review_work('${ca}','${job}','${v1}')`;
  await asUser(a,review);
  const first=(await asUser<{reviewed_at:string}>(a,`select reviewed_at from public.company_work_versions where id='${v1}'`)).rows[0]!.reviewed_at;
  await asUser(a,review);
  expect((await asUser<{reviewed_at:string}>(a,`select reviewed_at from public.company_work_versions where id='${v1}'`)).rows[0]!.reviewed_at).toEqual(first);
  await expect(asUser(b,review)).rejects.toThrow(/Version not found/);
  await expect(asUser(a,review.replace(ca,cb))).rejects.toThrow(/Version not found/);
  await asUser(a,save(v2,1,ca,'{"title":"Next strategy"}'));
  const versions=(await asUser<{revision:number;reviewed_at:string|null;content:{title:string}}>(a,`select * from public.company_work_versions where job_id='${job}' order by revision`)).rows;
  expect(versions[0]!.content.title).toBe('Synthetic strategy');expect(versions[0]!.reviewed_at).toEqual(first);expect(versions[1]!.reviewed_at).toBeNull();
 });
 it('requires a completed generation in this exact job and base revision',async()=>{
  await asUser(a,`select public.company_begin_turn('${ca}','${conversation}','${turn}','[Job work v2] Create strategy','test-model','company-work')`);
  await expect(asUser(a,save(turn,2,ca,'{"title":"Model draft"}',`'${turn}'`))).rejects.toThrow(/Completed job turn required/);
  await asUser(a,`select public.ai_finish_turn('${turn}','Synthetic generated work','complete',10,20)`);
  await asUser(a,save(turn,2,ca,'{"title":"Model draft"}',`'${turn}'`));
  await expect(asUser(a,save('d9000000-0000-4000-8000-000000000010',3,ca,'{"title":"Stale model"}',`'${turn}'`))).rejects.toThrow(/Completed job turn required/);
 });
 it('allows scoped latest-reply revision and denies legacy/cross-company revision',async()=>{
  const next='d9000000-0000-4000-8000-000000000011';
  const revise=(company=ca)=>`select public.company_begin_revision('${company}','${conversation}','${turn}','${next}','Revised discussion','edit','test-model','company-work')`;
  await expect(asUser(a,revise(cb))).rejects.toThrow(/scope mismatch/);
  await expect(asUser(b,revise())).rejects.toThrow(/scope mismatch/);
  await asUser(a,revise());
  const row=(await asUser<{parent_turn_id:string;revision_kind:string}>(a,`select * from public.ai_turns where id='${next}'`)).rows[0]!;
  expect(row.parent_turn_id).toBe(turn);expect(row.revision_kind).toBe('edit');
  await asUser(a,`select public.ai_finish_turn('${next}','Revised draft','complete',10,20)`);
  await expect(asUser(a,`select public.ai_begin_revision('${conversation}','${next}','d9000000-0000-4000-8000-000000000012','Legacy bypass','edit','test-model',false,'test')`)).rejects.toThrow(/Use company Talk/);
 });
 it('binds Studio to the same owner/company/job and prevents adoption',async()=>{
  const project='d9000000-0000-4000-8000-000000000013',old='d9000000-0000-4000-8000-000000000014';
  await asUser(a,`insert into public.ai_studio_projects(id,person_id,title,company_id,job_id) values('${project}','${owner}','Job visuals','${ca}','${job}')`);
  await asUser(a,`insert into public.ai_studio_projects(id,person_id,title) values('${old}','${owner}','Existing global project')`);
  await expect(asUser(a,`update public.ai_studio_projects set company_id='${cb}' where id='${project}'`)).rejects.toThrow(/immutable/);
  await expect(asUser(a,`update public.ai_studio_projects set company_id='${ca}',job_id='${job}' where id='${old}'`)).rejects.toThrow(/immutable/);
  await expect(asUser(a,`insert into public.ai_studio_projects(person_id,title,company_id,job_id) values('${owner}','Wrong company','${cb}','d9000000-0000-4000-8000-000000000099')`)).rejects.toThrow(/foreign key/);
  expect((await asUser(b,`select * from public.ai_studio_projects where id='${project}'`)).rows).toHaveLength(0);
 });
 it('does not expose jobs or atomic writers to anonymous callers',async()=>{
  const result=await db.query<{table_access:boolean;rpc_access:boolean}>(`select has_table_privilege('anon','public.company_jobs','SELECT') table_access,has_function_privilege('anon','public.company_save_work(uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE') rpc_access`);
  expect(result.rows[0]).toEqual({table_access:false,rpc_access:false});
 });
});

// Real SQL/RLS in PGlite; not a GoTrue/PostgREST integration test.
describe('public Mission ownership and continuity', () => {
  it('persists direction, denies cross-user access/reassignment and stale writes, preserves conversation on deletion', async () => {
    const chat = 'cc000000-0000-4000-8000-000000000001';
    const otherChat = 'cc000000-0000-4000-8000-000000000002';
    const mission = 'cc000000-0000-4000-8000-000000000003';
    const owner = `(select id from public.persons where auth_user_id='${founder}')`;
    const other = `(select id from public.persons where auth_user_id='${member}')`;
    await db.exec(`insert into public.ai_conversations(id,person_id,title) values('${chat}',${owner},'Mission work'),('${otherChat}',${other},'Other work')`);
    const insert = (id: string, conversation = chat, person = owner) => `insert into public.intelligence_missions(id,person_id,conversation_id,title,objective) values('${id}',${person},'${conversation}','Launch website','Launch a landscaping website') returning *`;
    const saved = (await asUser<{ revision: number }>(founder, insert(mission))).rows[0]!;
    expect(saved.revision).toBe(1);
    expect((await asUser(member, `select * from public.intelligence_missions where id='${mission}'`)).rows).toHaveLength(0);
    expect((await asUser(member, `update public.intelligence_missions set title='Hacked' where id='${mission}' returning id`)).rows).toHaveLength(0);
    expect((await asUser(member, `delete from public.intelligence_missions where id='${mission}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(founder, insert('cc000000-0000-4000-8000-000000000004', otherChat))).rejects.toThrow();
    await expect(asUser(member, insert('cc000000-0000-4000-8000-000000000005', chat, other))).rejects.toThrow();
    await expect(asUser(founder, `update public.intelligence_missions set person_id=${other} where id='${mission}'`)).rejects.toThrow();
    await expect(asUser(founder, `update public.intelligence_missions set conversation_id='${otherChat}' where id='${mission}'`)).rejects.toThrow();
    const write = `update public.intelligence_missions set decisions='Review the draft first',next_actions='Prepare homepage brief',status='active',revision=2 where id='${mission}' and revision=1 returning *`;
    expect((await asUser(founder, write)).rows).toHaveLength(1);
    expect((await asUser(founder, write)).rows).toHaveLength(0);
    await expect(asUser(founder, insert('cc000000-0000-4000-8000-000000000006'))).rejects.toThrow();
    await db.exec('set role anon');
    try { await expect(db.query('select * from public.intelligence_missions')).rejects.toThrow(); } finally { await db.exec('reset role'); }
    await asUser(founder, `delete from public.intelligence_missions where id='${mission}' and revision=2`);
    expect((await asUser(founder, `select id from public.ai_conversations where id='${chat}'`)).rows).toHaveLength(1);
    await asUser(founder, insert(mission));
    await asUser(founder, `delete from public.ai_conversations where id='${chat}'`);
    expect((await asUser(founder, `select * from public.intelligence_missions where id='${mission}'`)).rows).toHaveLength(0);
  });
});

describe('Mission continuity security and recovery',()=>{
 it('isolates records, rejects stale proposals, recovers handoffs, and preserves creative work after deletion',async()=>{
  const conversation='e7100000-0000-4000-8000-000000000001';
  const mission='e7100000-0000-4000-8000-000000000002';
  const turn='e7100000-0000-4000-8000-000000000003';
  const pending='e7100000-0000-4000-8000-000000000004';
  const proposal='e7100000-0000-4000-8000-000000000005';
  const owner=(await db.query<{id:string}>(`select id from persons where auth_user_id='${founder}'`)).rows[0]!.id;
  await db.exec(`insert into ai_conversations(id,person_id,title) values('${conversation}','${owner}','Mission fixture');
   insert into ai_turns(id,person_id,conversation_id,user_text,assistant_text,status,model,context_included,prompt_version) values
   ('${turn}','${owner}','${conversation}','My objective is a garden plan','Consider native planting','complete','test',false,'test'),
   ('${pending}','${owner}','${conversation}','Continue','','pending','test',false,'test');`);
  await asUser(founder,`insert into intelligence_missions(id,person_id,conversation_id,title,objective) values('${mission}','${owner}','${conversation}','Garden','Plan a garden')`);
  const direction=JSON.stringify({title:'Garden',objective:'Plan a garden',decisions:'Use native planting',open_questions:'Budget?',next_actions:'Measure the garden'});
  await expect(asUser(member,`select mission_capture_context('${pending}','${mission}',1)`)).rejects.toThrow(/unavailable/);
  const snapshot=await asUser<{mission_capture_context:{revision:number}}>(founder,`select mission_capture_context('${pending}','${mission}',1)`);
  expect(snapshot.rows[0]!.mission_capture_context.revision).toBe(1);
  await expect(asUser(founder,`select mission_capture_context('${pending}','${mission}',2)`)).rejects.toThrow(/changed/);
  await asUser(founder,`select mission_store_proposal('${proposal}','${mission}','${turn}',1,'${direction}')`);
  await expect(asUser(member,`select mission_decide_proposal('${proposal}',true,'${direction}')`)).rejects.toThrow(/unavailable/);
  await asUser(founder,`select mission_decide_proposal('${proposal}',true,'${direction}')`);
  await asUser(founder,`select mission_decide_proposal('${proposal}',true,'${direction}')`);
  expect((await asUser<{revision:number}>(founder,`select revision from intelligence_missions where id='${mission}'`)).rows[0]!.revision).toBe(2);
  await expect(asUser(founder,`select mission_decide_proposal('${proposal}',false,null)`)).rejects.toThrow(/changed/);
  await expect(asUser(founder,`select mission_store_proposal('e7100000-0000-4000-8000-000000000009','${mission}','${turn}',1,'${direction}')`)).rejects.toThrow(/changed/);
  const stale='e7100000-0000-4000-8000-000000000010';
  await asUser(founder,`select mission_store_proposal('${stale}','${mission}','${turn}',2,'${direction}')`);
  await asUser(founder,`update intelligence_missions set revision=3 where id='${mission}'`);
  await expect(asUser(founder,`select mission_decide_proposal('${stale}',true,'${direction}')`)).rejects.toThrow(/changed/);
  expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.mission_open_studio(uuid,integer)','execute') as allowed")).rows[0]!.allowed).toBe(false);
  await asUser(founder,`select mission_pin_output('${mission}','${turn}')`);
  await asUser(founder,`select mission_pin_output('${mission}','${turn}')`);
  await expect(asUser(founder,`select mission_pin_output('${mission}','${pending}')`)).rejects.toThrow(/Completed/);
  expect((await asUser(founder,`select * from mission_outputs where mission_id='${mission}'`)).rows).toHaveLength(1);
  for(const table of ['mission_proposals','mission_outputs','mission_turn_context']) expect((await asUser(member,`select * from ${table} where mission_id='${mission}'`)).rows).toHaveLength(0);
  await expect(asUser(member,`select mission_open_studio('${mission}',3)`)).rejects.toThrow(/unavailable/);
  const project=(await asUser<{mission_open_studio:string}>(founder,`select mission_open_studio('${mission}',3)`)).rows[0]!.mission_open_studio;
  expect((await asUser<{mission_open_studio:string}>(founder,`select mission_open_studio('${mission}',3)`)).rows[0]!.mission_open_studio).toBe(project);
  expect((await asUser(member,`select * from mission_studio_links where mission_id='${mission}'`)).rows).toHaveLength(0);
  await expect(asUser(founder,`update mission_studio_links set project_id='${turn}' where mission_id='${mission}'`)).rejects.toThrow(/permission/);
  await asUser(founder,`delete from intelligence_missions where id='${mission}'`);
  expect((await asUser(founder,`select * from ai_studio_projects where id='${project}'`)).rows).toHaveLength(1);
  expect((await asUser(founder,`select * from ai_conversations where id='${conversation}'`)).rows).toHaveLength(1);
  expect((await asUser(founder,`select * from mission_studio_links where mission_id='${mission}'`)).rows).toHaveLength(0);
 });
});

describe('Mission deliverable ownership, immutable versions and review',()=>{
 it('creates from a completed personal reply, guards stale edits, binds reviews, retains work, and snapshots exact versions',async()=>{
  const chat='e7200000-0000-4000-8000-000000000001', mission='e7200000-0000-4000-8000-000000000002', turn='e7200000-0000-4000-8000-000000000003',pending='e7200000-0000-4000-8000-000000000004',v2='e7200000-0000-4000-8000-000000000005',v3='e7200000-0000-4000-8000-000000000006';
  const owner=(await db.query<{id:string}>(`select id from persons where auth_user_id='${founder}'`)).rows[0]!.id;
  await db.exec(`insert into ai_conversations(id,person_id,title) values('${chat}','${owner}','Deliverable fixture');insert into ai_turns(id,person_id,conversation_id,user_text,assistant_text,status,model,context_included,prompt_version) values ('${turn}','${owner}','${chat}','Draft my plan','A complete original draft','complete','test',false,'test'),('${pending}','${owner}','${chat}','Continue','','pending','test',false,'test');`);
  await asUser(founder,`insert into intelligence_missions(id,person_id,conversation_id,title,objective) values('${mission}','${owner}','${chat}','Plan','Prepare a plan')`);
  const create=`select mission_create_deliverable('${mission}','${turn}',1) as id`;
  await expect(asUser(member,create)).rejects.toThrow(/unavailable/);
  await expect(asUser(founder,`select mission_create_deliverable('${mission}','${pending}',1)`)).rejects.toThrow(/Completed/);
  await expect(asUser(founder,`select mission_create_deliverable('${mission}','${turn}',null)`)).rejects.toThrow(/changed/);
  const id=(await asUser<{id:string}>(founder,create)).rows[0]!.id;
  expect((await asUser<{id:string}>(founder,create)).rows[0]!.id).toBe(id);
  const v1=(await asUser<{id:string}>(founder,`select id from mission_deliverable_versions where deliverable_id='${id}'`)).rows[0]!.id;
  await expect(asUser(founder,`select mission_review_deliverable('${id}','${v1}','Checked')`)).rejects.toThrow(/criteria/);
  const save=`select mission_save_deliverable('${id}','${v2}',1,'Final brief','Revised draft','Check the audience and dates')`;
  await asUser(founder,save);await asUser(founder,save);
  await expect(asUser(founder,save.replace('Revised draft','Changed replay'))).rejects.toThrow(/changed/);
  await expect(asUser(founder,save.replace(v2,v3))).rejects.toThrow(/changed/);
  await expect(asUser(member,save)).rejects.toThrow(/unavailable/);
  await expect(asUser(founder,`select mission_review_deliverable('${id}','${v1}','Checked')`)).rejects.toThrow(/changed/);
  const review=`select mission_review_deliverable('${id}','${v2}','Checked audience; dates remain estimates')`;
  await asUser(founder,review);await asUser(founder,review);
  await expect(asUser(founder,review.replace('dates remain estimates','dates confirmed'))).rejects.toThrow(/changed/);
  const snap=(await asUser<{s:{deliverables:Array<{version_id:string;reviewed_by_user:boolean;excerpt:string}>}}>(founder,`select mission_capture_context('${pending}','${mission}',1) as s`)).rows[0]!.s;
  expect(snap.deliverables[0]).toMatchObject({version_id:v2,reviewed_by_user:true,excerpt:'Revised draft'});
  await asUser(founder,`select mission_save_deliverable('${id}','${v3}',2,'Final brief','Third draft','Check audience')`);
  expect((await asUser<{reviewed:boolean}>(founder,`select reviewed from mission_deliverable_summaries where id='${id}'`)).rows[0]!.reviewed).toBe(false);
  expect((await asUser<{s:unknown}>(founder,`select mission_capture_context('${pending}','${mission}',1) as s`)).rows[0]!.s).toEqual(snap);
  for(const table of ['mission_deliverables','mission_deliverable_versions','mission_deliverable_summaries']) expect((await asUser(member,`select * from ${table}`)).rows).toHaveLength(0);
  await expect(asUser(founder,`update mission_deliverable_versions set body='overwrite' where id='${v1}'`)).rejects.toThrow(/permission/);
  expect((await db.query<{ok:boolean}>("select has_function_privilege('anon','mission_save_deliverable(uuid,uuid,integer,text,text,text)','execute') as ok")).rows[0]!.ok).toBe(false);
  await asUser(founder,`delete from intelligence_missions where id='${mission}'`);
  expect((await asUser<{mission_id:string|null}>(founder,`select mission_id from mission_deliverables where id='${id}'`)).rows[0]!.mission_id).toBe(null);
  expect((await asUser(founder,`select * from mission_deliverable_versions where deliverable_id='${id}'`)).rows).toHaveLength(3);
  await db.exec(`delete from ai_conversations where id='${chat}'`);
  expect((await asUser<{source_turn_id:string|null}>(founder,`select source_turn_id from mission_deliverables where id='${id}'`)).rows[0]!.source_turn_id).toBe(null);
  await expect(asUser(member,`select mission_delete_deliverable('${id}',3)`)).rejects.toThrow(/unavailable/);
  await expect(asUser(founder,`select mission_delete_deliverable('${id}',2)`)).rejects.toThrow(/changed/);
  await asUser(founder,`select mission_delete_deliverable('${id}',3)`);
  expect((await asUser(founder,`select * from mission_deliverable_versions where deliverable_id='${id}'`)).rows).toHaveLength(0);
 });
});


describe('read-only release catalog preflight', () => {
  it('observes the complete contract without touching records, and detects unsafe grants', async () => {
    const sql = await readFile('scripts/public-release-preflight.sql', 'utf8');
    type Snapshot = { contract: string; checks: { stage: string; object: string; present: boolean; ok: boolean }[] };
    const snapshot = (await db.query<{ snapshot: Snapshot }>(sql)).rows[0]!.snapshot;
    expect(snapshot.contract).toBe('public-mission-v1');
    expect(snapshot.checks.filter((c) => !c.ok)).toEqual([]);
    await db.exec('begin; grant execute on function public.mission_pin_output(uuid,uuid) to anon; grant update(body) on public.mission_deliverable_versions to authenticated;');
    try {
      const unsafe = (await db.query<{ snapshot: Snapshot }>(sql)).rows[0]!.snapshot;
      expect(unsafe.checks.find((c) => c.object === 'function:public.mission_pin_output(uuid,uuid)')?.ok).toBe(false);
      expect(unsafe.checks.find((c) => c.object === 'table:mission_deliverable_versions')?.ok).toBe(false);
      await db.exec('alter policy mission_outputs_owner on public.mission_outputs using (true or person_id in (select id from public.persons where auth_user_id=(select auth.uid())));');
      const broad = (await db.query<{ snapshot: Snapshot }>(sql)).rows[0]!.snapshot;
      expect(broad.checks.find((c) => c.object === 'table:mission_outputs')?.ok).toBe(false);
    } finally { await db.exec('rollback'); }
  });
});

describe('Technology owner/version/budget boundary', () => {
  const project = 'ee800000-0000-4000-8000-000000000001',
    v1 = 'ee800000-0000-4000-8000-000000000002',
    v2 = 'ee800000-0000-4000-8000-000000000003',
    run = 'ee800000-0000-4000-8000-000000000004';
  const brief = {
    name: 'Studio North',
    industry: 'grooming-beauty',
    vision: 'A welcoming local grooming studio.',
    headline: 'Care with intention',
    about: 'A local studio focused on thoughtful care.',
    services: [{ name: 'Haircut', description: 'An attentive appointment.', price: '$45' }],
    hours: 'Tue–Sat',
    contact: 'Call the studio',
    bookingUrl: '',
  };
  const literal = JSON.stringify(brief).replaceAll("'", "''");
  it('requires grant, hides owners and guards immutable review and paid settlement', async () => {
    await db.exec(
      `insert into public.technology_grants(person_id,expires_at) select id,now()+interval '1 day' from public.persons where auth_user_id='${founder}' on conflict do nothing`,
    );
    const save = `select public.technology_save('${project}','${v1}',0,'${literal}')`;
    await expect(asUser(member, save)).rejects.toThrow(/access/);
    await asUser(founder, save);
    await asUser(founder, save);
    expect((await asUser(member, 'select * from public.technology_projects')).rows).toHaveLength(0);
    await expect(
      asUser(founder, `update public.technology_site_versions set brief='{}'`),
    ).rejects.toThrow(/permission/);
    await expect(
      asUser(founder, `select public.technology_reserve('${project}','${run}',1)`),
    ).rejects.toThrow(/Review/);
    await asUser(founder, `select public.technology_review('${project}','${v1}')`);
    await asUser(founder, `select public.technology_save('${project}','${v2}',1,'${literal}')`);
    await expect(
      asUser(founder, `select public.technology_review('${project}','${v1}')`),
    ).rejects.toThrow(/changed/);
    await asUser(founder, `select public.technology_review('${project}','${v2}')`);
    await asUser(founder, `select public.technology_reserve('${project}','${run}',2)`);
    await expect(
      asUser(
        founder,
        `select public.technology_settle('${run}',(select id from public.persons where auth_user_id='${founder}'),'${literal}',10,10)`,
      ),
    ).rejects.toThrow(/permission/);
    await expect(
      asUser(founder, `select public.technology_reserve('${project}',gen_random_uuid(),2)`),
    ).rejects.toThrow(/reconciliation/);
    await db.exec(
      `set role service_role;select public.technology_settle('${run}',(select id from public.persons where auth_user_id='${founder}'),null,null,null);reset role`,
    );
    expect(
      (
        await asUser(
          founder,
          `select status,actual_micros from public.technology_runs where id='${run}'`,
        )
      ).rows[0],
    ).toEqual({ status: 'uncertain', actual_micros: null });
  });
});

describe('Technology successful settlement and monthly ceilings',()=>{
 it('creates an unreviewed immutable AI version, retains history, and enforces owner-wide monthly reservation ceiling',async()=>{
 const owner=(await db.query<{id:string}>(`select id from public.persons where auth_user_id='${member}'`)).rows[0]!.id;
 await db.exec(`insert into public.technology_grants values('${owner}',now()+interval '1 day')`);
 const p='ee810000-0000-4000-8000-000000000001',v='ee810000-0000-4000-8000-000000000002',r='ee810000-0000-4000-8000-000000000003';
 const brief=JSON.stringify({name:'Studio South',industry:'grooming-beauty',vision:'A welcoming service business.',headline:'Care with intention',about:'A local studio focused on care.',services:[{name:'Haircut',description:'An appointment.',price:'$45'}],hours:'',contact:'',bookingUrl:''});
 await asUser(member,`select public.technology_save('${p}','${v}',0,'${brief}')`);
 await asUser(member,`select public.technology_review('${p}','${v}')`);
 await asUser(member,`select public.technology_reserve('${p}','${r}',1)`);
 await db.exec(`set role service_role;select public.technology_settle('${r}','${owner}','${brief}',1200,800);reset role`);
 const rows=(await asUser<{revision:number;reviewed_at:string|null}>(member,`select revision,reviewed_at from public.technology_site_versions where project_id='${p}' order by revision`)).rows;
 expect(rows).toHaveLength(2);expect(rows[0]!.reviewed_at).not.toBeNull();expect(rows[1]).toEqual({revision:2,reviewed_at:null});
 expect((await asUser(member,`select actual_micros from public.technology_runs where id='${r}'`)).rows[0]).toEqual({actual_micros:10400});
 await asUser(member,`select public.technology_review('${p}',(select id from public.technology_site_versions where project_id='${p}' and revision=2))`);
 await db.exec(`insert into public.technology_runs(id,person_id,project_id,source_revision,status,actual_micros) select gen_random_uuid(),'${owner}','${p}',2,'succeeded',1000000 from generate_series(1,9)`);
 await expect(asUser(member,`select public.technology_reserve('${p}',gen_random_uuid(),2)`)).rejects.toThrow(/allowance/);
 await db.exec(`delete from public.technology_grants where person_id='${owner}'`);
 await expect(asUser(member,`select public.technology_review('${p}',(select id from public.technology_site_versions where project_id='${p}' and revision=2))`)).rejects.toThrow(/access/);
 expect((await asUser(member,`select id from public.technology_projects where id='${p}'`)).rows).toHaveLength(1);
 });
});

describe('Technology SQL brief validation cannot be bypassed by direct RPC',()=>{
 it('rejects credential links, null industry and unsupported executable fields',async()=>{
 const base={name:'Studio West',industry:'grooming-beauty',vision:'A welcoming local service business.',headline:'Care with intention',about:'A studio focused on thoughtful care.',services:[{name:'Haircut',description:'Care',price:'$45'}],hours:'',contact:'',bookingUrl:''};
 for(const b of [{...base,bookingUrl:'https://name:password@example.com'},{...base,industry:null},{...base,script:'alert(1)'}]){
 const literal=JSON.stringify(b).replaceAll("'","''");
 await expect(asUser(founder,`select public.technology_save(gen_random_uuid(),gen_random_uuid(),0,'${literal}')`)).rejects.toThrow(/Invalid business brief/);
 }
 });
});

// Verified-build state machine: SQL/RLS emulation, not hosted Auth acceptance.
describe('Technology verified builds',()=>{
 it('pins exact review, deduplicates jobs, fences expired workers and preserves ready artifacts',async()=>{
 const p='ef900000-0000-4000-8000-000000000001',v='ef900000-0000-4000-8000-000000000002',v2='ef900000-0000-4000-8000-000000000003',b='ef900000-0000-4000-8000-000000000004',lease='ef900000-0000-4000-8000-000000000005',next='ef900000-0000-4000-8000-000000000006';
 const brief=JSON.stringify({name:'Build Studio',industry:'grooming-beauty',vision:'A reviewed local business.',headline:'Considered care',about:'A carefully considered studio.',services:[{name:'Haircut',description:'Care',price:'$45'}],hours:'',contact:'',bookingUrl:''});
 const owner=(await db.query<{id:string}>(`select id from public.persons where auth_user_id='${founder}'`)).rows[0]!.id;
 await db.exec(`insert into public.technology_grants values('${owner}',now()+interval '1 day') on conflict(person_id) do update set expires_at=excluded.expires_at`);
 await asUser(founder,`select public.technology_save('${p}','${v}',0,'${brief}')`);
 await expect(asUser(founder,`select public.technology_build_queue('${b}','${p}','${v}')`)).rejects.toThrow(/Review/);
 await asUser(founder,`select public.technology_review('${p}','${v}')`);
 await asUser(founder,`select public.technology_build_queue('${b}','${p}','${v}')`);
 const replay=(await asUser<{id:string}>(founder,`select public.technology_build_queue(gen_random_uuid(),'${p}','${v}') as id`)).rows[0]!.id;expect(replay).toBe(b);
 await expect(asUser(member,`select public.technology_build_claim('${b}','${lease}')`)).rejects.toThrow();
 expect((await asUser(member,`select * from public.technology_builds where id='${b}'`)).rows).toHaveLength(0);
 await expect(asUser(founder,`update public.technology_builds set status='ready' where id='${b}'`)).rejects.toThrow(/permission/);
 await asUser(founder,`select public.technology_build_claim('${b}','${lease}')`);
 await expect(asUser(founder,`select public.technology_build_claim('${b}','${next}')`)).rejects.toThrow(/running/);
 await db.exec(`update public.technology_builds set lease_until=now()-interval '1 second' where id='${b}'`);
 await asUser(founder,`select public.technology_build_claim('${b}','${next}')`);
 const finish=(token:string)=>`select public.technology_build_finish('${b}','${owner}','${token}','<!doctype html>','${'a'.repeat(64)}','{"passed":true,"validator":"static-service-v1"}')`;
 await expect(asUser(founder,finish(next))).rejects.toThrow(/permission/);
 await db.exec('set role service_role');try{await expect(db.query(finish(lease))).rejects.toThrow(/lease/);await db.query(finish(next));}finally{await db.exec('reset role');}
 await asUser(founder,`select public.technology_save('${p}','${v2}',1,'${brief}')`);
 await expect(asUser(founder,`select public.technology_build_queue(gen_random_uuid(),'${p}','${v}')`)).rejects.toThrow(/Review/);
 expect((await asUser<{status:string;attempts:number}>(founder,`select status,attempts from public.technology_builds where id='${b}'`)).rows[0]).toEqual({status:'ready',attempts:2});
 await expect(asUser(founder,`select public.technology_build_queue('${b}','${p}','${v2}')`)).rejects.toThrow(/changed/);
 await db.exec('set role anon');try{await expect(db.query('select * from public.technology_builds')).rejects.toThrow(/permission/);}finally{await db.exec('reset role');}
 await db.exec(`delete from public.technology_projects where id='${p}'`);
 expect((await db.query(`select id from public.technology_builds where id='${b}'`)).rows).toHaveLength(0);
 });
});

// Full-chain SQL emulation; actual Auth/PostgREST is a separate CI gate.
it('validates versioned design in the database and prevents direct JSON contract bypass', async () => {
  const core = {
    name: 'Design Studio',
    industry: 'professional-services',
    vision: 'A local design studio.',
    headline: 'Considered design',
    about: 'A considered independent studio.',
    services: [{ name: 'Consultation', description: 'Personal care.', price: '$45' }],
    hours: '',
    contact: '',
    bookingUrl: '',
  };
  const design = {
    palette: 'ivory',
    hero: 'split',
    typography: 'serif',
    spacing: 'spacious',
    audience: 'Local clients',
    goal: 'Service discovery',
    rationale: 'Editorial hierarchy',
    cta: 'Explore services',
    request: 'Make it refined.',
  };
  for (const [b, expected] of [
    [core, true],
    [{ ...core, design }, true],
    [{ ...core, design: null }, false],
    [{ ...core, design: { ...design, script: 'evil' } }, false],
    [{ ...core, design: { ...design, palette: 'red' } }, false],
    [{ ...core, design: { ...design, request: 'x'.repeat(1001) } }, false],
  ] as const) {
    const result = await db.query<{ ok: boolean }>(
      'select public.technology_validate_brief($1::jsonb) as ok',
      [JSON.stringify(b)],
    );
    expect(result.rows[0]!.ok).toBe(expected);
  }
  await expect(asUser(founder, `select public.technology_validate_brief('{}')`)).rejects.toThrow(
    /permission/,
  );
});

it('captures immutable website context only for the owner, current version and originating pending Talk turn', async()=>{
 const chat='f2100000-0000-4000-8000-000000000001', mission='f2100000-0000-4000-8000-000000000002', turn='f2100000-0000-4000-8000-000000000003', p='f2100000-0000-4000-8000-000000000004', v='f2100000-0000-4000-8000-000000000005', otherChat='f2100000-0000-4000-8000-000000000006', otherTurn='f2100000-0000-4000-8000-000000000007';
 const owner=(await db.query<{id:string}>(`select id from persons where auth_user_id='${founder}'`)).rows[0]!.id;
 const brief=JSON.stringify({name:'Synthetic Studio',industry:'professional-services',vision:'A synthetic business website',headline:'Care with intention',about:'A carefully considered local studio',services:[{name:'Consultation',description:'',price:''}],hours:'',contact:'',bookingUrl:''});
 await db.exec(`insert into ai_conversations(id,person_id,title) values('${chat}','${owner}','Website'),('${otherChat}','${owner}','Other');
 insert into ai_turns(id,person_id,conversation_id,user_text,assistant_text,status,model,context_included,prompt_version) values('${turn}','${owner}','${chat}','Refine this','','pending','test',false,'test'),('${otherTurn}','${owner}','${otherChat}','Other','','pending','test',false,'test');
 insert into intelligence_missions(id,person_id,conversation_id,title,objective) values('${mission}','${owner}','${chat}','Website','A synthetic business website');`);
 await asUser(founder,`select technology_save('${p}','${v}',0,'${brief}','${mission}',1)`);
 const capture=(t=turn,r=1)=>`select technology_capture_context('${t}','${p}',${r}) as receipt`;
 await expect(asUser(member,capture())).rejects.toThrow();
 await expect(asUser(founder,capture(otherTurn))).rejects.toThrow(/conversation/);
 await expect(asUser(founder,capture(turn,2))).rejects.toThrow(/changed/);
 const receipt=(await asUser<{receipt:{revision:number;versionId:string}}>(founder,capture())).rows[0]!.receipt;
 expect(receipt.revision).toBe(1);expect(receipt.versionId).toBe(v);
 await asUser(founder,capture());
 expect((await asUser(founder,`select * from technology_turn_context where turn_id='${turn}'`)).rows).toHaveLength(1);
 expect((await asUser(member,`select * from technology_turn_context where turn_id='${turn}'`)).rows).toHaveLength(0);
 await expect(asUser(founder,`update technology_turn_context set revision=2 where turn_id='${turn}'`)).rejects.toThrow(/permission/);
 await db.exec(`update ai_turns set status='complete' where id='${turn}'`);
 await expect(asUser(founder,capture())).rejects.toThrow(/conversation/);
 await asUser(founder,`select technology_save('${p}',gen_random_uuid(),1,'${brief}')`);
 expect((await asUser<{revision:number}>(founder,`select revision from technology_turn_context where turn_id='${turn}'`)).rows[0]!.revision).toBe(1);
 await expect(asUser(founder,capture(otherTurn))).rejects.toThrow(/changed/);
 expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','technology_capture_context(uuid,uuid,integer)','execute') as allowed")).rows[0]!.allowed).toBe(false);
 await db.exec(`delete from technology_projects where id='${p}';delete from ai_conversations where id in ('${chat}','${otherChat}')`);
});

it('additional pages retain strict SQL bounds, immutable versions, stale-write and owner guards', async () => {
 const p='f5000000-0000-4000-8000-000000000001',v='f5000000-0000-4000-8000-000000000002';
 const b={name:'Synthetic pages',industry:'professional-services',vision:'A synthetic business website.',headline:'Considered work',about:'A synthetic service for testing.',services:[{name:'Consultation',description:'Discuss your needs.',price:''}],hours:'',contact:'',bookingUrl:'',pages:[{slug:'process',title:'Our process',layout:'cards',sections:[{heading:'Discussion',body:'Discuss the service you need.'}]}]};
 const json=(value:unknown)=>JSON.stringify(value).replaceAll("'","''");
 const save=(id:string,expected:number,value:unknown)=>`select technology_save('${p}','${id}',${expected},'${json(value)}')`;
 await asUser(founder,save(v,0,b));
 await asUser(founder,save(v,0,b));
 await expect(asUser(member,save(crypto.randomUUID(),1,b))).rejects.toThrow();
 for(const pages of [null,[b.pages[0],b.pages[0]],Array(4).fill(b.pages[0]),[{...b.pages[0],slug:'about'}],[{...b.pages[0],slug:'../evil'}],[{...b.pages[0],layout:'script'}],[{...b.pages[0],sections:[]}],[{...b.pages[0],sections:[{heading:'Test',body:'x'.repeat(601)}]}]]) {
  const valid=await db.query<{ok:boolean}>(`select technology_validate_brief('${json({...b,pages})}') as ok`);expect(valid.rows[0]!.ok).toBe(false);
  await expect(asUser(founder,save(crypto.randomUUID(),1,{...b,pages}))).rejects.toThrow(/Invalid/);
 }
 const changed={...b,pages:[{...b.pages[0],title:'A revised process'}]};
 await asUser(founder,save(crypto.randomUUID(),1,changed));
 await expect(asUser(founder,save(crypto.randomUUID(),1,b))).rejects.toThrow(/changed/);
 expect((await asUser<{brief:typeof b}>(founder,`select brief from technology_site_versions where id='${v}'`)).rows[0]!.brief).toEqual(b);
 expect((await asUser(member,`select * from technology_site_versions where project_id='${p}'`)).rows).toHaveLength(0);
 expect((await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','technology_validate_brief(jsonb)','execute') as allowed")).rows[0]!.allowed).toBe(false);
 await db.exec(`delete from technology_projects where id='${p}'`);
});
