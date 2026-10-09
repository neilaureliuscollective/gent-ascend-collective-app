-- Read-only catalog inspection. No application records, writes, or provider calls.
-- A passing catalog inspection is not hosted Auth/RLS behavior acceptance.
with required_columns(relation, column_name, data_type) as (values
 ('persons','id','uuid'), ('persons','auth_user_id','uuid'),
 ('intelligence_missions','id','uuid'), ('intelligence_missions','person_id','uuid'),
 ('intelligence_missions','conversation_id','uuid'), ('intelligence_missions','revision','integer'),
 ('intelligence_missions','title','text'), ('intelligence_missions','objective','text'),
 ('intelligence_missions','status','text'), ('intelligence_missions','decisions','text'),
 ('intelligence_missions','open_questions','text'), ('intelligence_missions','next_actions','text'),
 ('ai_turns','id','uuid'), ('ai_turns','person_id','uuid'),
 ('ai_turns','conversation_id','uuid'), ('ai_turns','status','text'), ('ai_turns','assistant_text','text'),
 ('ai_studio_projects','id','uuid'), ('ai_studio_projects','person_id','uuid'),
 ('ai_studio_projects','company_id','uuid'), ('ai_studio_projects','title','text'),
 ('ai_studio_projects','creative_type','text'), ('ai_studio_projects','brief','jsonb')
), relations(stage, relation, policy_name) as (values
 ('continuity','mission_proposals','mission_proposals_owner'),
 ('continuity','mission_studio_links','mission_links_owner'),
 ('continuity','mission_outputs','mission_outputs_owner'),
 ('continuity','mission_turn_context','mission_context_owner'),
 ('deliverables','mission_deliverables','deliverables_owner'),
 ('deliverables','mission_deliverable_versions','deliverable_versions_owner'),
 ('technology','technology_grants','technology_owner_read'),
 ('technology','technology_projects','technology_owner_read'),
 ('technology','technology_site_versions','technology_owner_read'),
 ('technology','technology_runs','technology_owner_read'),
 ('builds','technology_builds','technology_build_owner_read'),
 ('website-talk','technology_turn_context','technology_context_owner_read')
), functions(stage, signature) as (values
 ('continuity','public.mission_capture_context(uuid,uuid,integer)'),
 ('continuity','public.mission_store_proposal(uuid,uuid,uuid,integer,jsonb,integer,integer,integer)'),
 ('continuity','public.mission_decide_proposal(uuid,boolean,jsonb)'),
 ('continuity','public.mission_pin_output(uuid,uuid)'),
 ('continuity','public.mission_open_studio(uuid,integer)'),
 ('deliverables','public.mission_create_deliverable(uuid,uuid,integer)'),
 ('deliverables','public.mission_save_deliverable(uuid,uuid,integer,text,text,text)'),
 ('deliverables','public.mission_review_deliverable(uuid,uuid,text)'),
 ('deliverables','public.mission_delete_deliverable(uuid,integer)'),
 ('technology','public.technology_save(uuid,uuid,integer,jsonb,uuid,integer)'),
 ('technology','public.technology_review(uuid,uuid)'),
 ('technology','public.technology_reserve(uuid,uuid,integer)'),
 ('builds','public.technology_build_queue(uuid,uuid,uuid)'),
 ('builds','public.technology_build_claim(uuid,uuid)'),
 ('website-talk','public.technology_capture_context(uuid,uuid,integer)')
), checks as (
 select 'prerequisite' as stage, 'column:' || r.relation || '.' || r.column_name as object,
   a.attname is not null as present,
   coalesce(format_type(a.atttypid,a.atttypmod)=r.data_type and not a.attisdropped,false) as ok
 from required_columns r left join pg_attribute a
 on a.attrelid=to_regclass('public.' || r.relation) and a.attname=r.column_name and a.attnum>0
 union all
 select 'prerequisite','owner-key:' || r.relation,true,
   exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.' || r.relation)
     and c.contype in ('p','u') and cardinality(c.conkey)=2
     and c.conkey @> array[
       (select attnum from pg_attribute where attrelid=c.conrelid and attname='person_id'),
       (select attnum from pg_attribute where attrelid=c.conrelid and attname='id')
     ]::smallint[])
 from (values ('ai_turns'),('ai_studio_projects')) r(relation)
 union all
 select r.stage,'table:' || r.relation,c.oid is not null,
   coalesce(c.relkind='r' and c.relrowsecurity
     and has_table_privilege('authenticated',c.oid,'SELECT')
     and not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     and not has_any_column_privilege('authenticated',c.oid,'INSERT,UPDATE,REFERENCES')
     and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     and not has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
     and (select count(*) from pg_policy p where p.polrelid=c.oid)=1
     and exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname=r.policy_name
       and p.polcmd='r' and p.polpermissive and p.polroles=array[(select oid from pg_roles where rolname='authenticated')]
       and regexp_replace(replace(pg_get_expr(p.polqual,p.polrelid),'public.',''),'\s','','g') =
         '(person_idIN(SELECTpersons.idFROMpersonsWHERE(persons.auth_user_id=(SELECTauth.uid()ASuid))))'),false)
 from relations r left join pg_class c on c.oid=to_regclass('public.' || r.relation)
 union all
 select f.stage,'function:' || f.signature,p.oid is not null,
   coalesce(p.prosecdef and array_to_string(p.proconfig,',') in ('search_path=""','search_path=')
     and has_function_privilege('authenticated',p.oid,'EXECUTE')
     and not has_function_privilege('anon',p.oid,'EXECUTE'),false)
 from functions f left join pg_proc p on p.oid=to_regprocedure(f.signature)
 union all
 select 'technology','broker:technology_settle',p.oid is not null,
 coalesce(p.prosecdef and array_to_string(p.proconfig,',') in ('search_path=""','search_path=')
 and has_function_privilege('service_role',p.oid,'EXECUTE')
 and not has_function_privilege('authenticated',p.oid,'EXECUTE')
 and not has_function_privilege('anon',p.oid,'EXECUTE'),false)
 from (select 1) seed left join pg_proc p on p.oid=to_regprocedure('public.technology_settle(uuid,uuid,jsonb,integer,integer)')
 union all
 select 'builds','broker:technology_build_finish',p.oid is not null,
 coalesce(p.prosecdef and array_to_string(p.proconfig,',') in ('search_path=""','search_path=')
 and has_function_privilege('service_role',p.oid,'EXECUTE')
 and not has_function_privilege('authenticated',p.oid,'EXECUTE')
 and not has_function_privilege('anon',p.oid,'EXECUTE'),false)
 from (select 1) seed left join pg_proc p on p.oid=to_regprocedure('public.technology_build_finish(uuid,uuid,uuid,text,text,jsonb)')
 union all
 select 'deliverables','view:mission_deliverable_summaries',c.oid is not null,
   coalesce(c.relkind='v' and 'security_invoker=true'=any(c.reloptions)
     and has_table_privilege('authenticated',c.oid,'SELECT')
     and not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     and not has_any_column_privilege('authenticated',c.oid,'INSERT,UPDATE,REFERENCES')
     and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     and not has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'),false)
 from (select 1) seed left join pg_class c on c.oid=to_regclass('public.mission_deliverable_summaries')
 union all
 select 'continuity','constraint:mission_owner_identity',c.oid is not null,
   coalesce(c.contype='u' and c.conkey=array[
     (select attnum from pg_attribute where attrelid=c.conrelid and attname='person_id'),
     (select attnum from pg_attribute where attrelid=c.conrelid and attname='id')
   ]::smallint[],false)
 from (select 1) seed left join pg_constraint c on c.conrelid=to_regclass('public.intelligence_missions') and c.conname='mission_owner_identity'
 union all
 select 'design','validator:technology_validate_brief',p.oid is not null,
 coalesce(not p.prosecdef and p.provolatile='i' and array_to_string(p.proconfig,',') in ('search_path=""','search_path=')
 and not has_function_privilege('authenticated',p.oid,'EXECUTE')
 and not has_function_privilege('anon',p.oid,'EXECUTE')
 and to_regprocedure('public.technology_validate_core_brief(jsonb)') is not null
 and exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.technology_site_versions')
 and c.conname='technology_valid_brief' and c.convalidated
 and pg_get_constraintdef(c.oid) like '%technology_validate_brief(brief)%'),false)
 from (select 1) seed left join pg_proc p on p.oid=to_regprocedure('public.technology_validate_brief(jsonb)')
)
select jsonb_build_object(
 'contract','public-mission-v1',
 'observed_at',current_timestamp,
 'checks',(select jsonb_agg(jsonb_build_object('stage',stage,'object',object,'present',present,'ok',ok) order by stage,object) from checks)
) as snapshot;
