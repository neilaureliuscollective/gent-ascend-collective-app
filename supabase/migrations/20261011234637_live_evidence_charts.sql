-- Source-linked output and reviewed, deterministic scenarios share the existing artifact lifecycle.
alter table public.ai_conversation_artifacts drop constraint artifact_operation;
alter table public.ai_conversation_artifacts add constraint artifact_operation check(operation in ('image.create','image.edit','visual.diagram','visual.comparison','visual.chart','visual.research-comparison'));
alter table public.ai_conversation_artifacts drop constraint artifact_completed_reference;
alter table public.ai_conversation_artifacts add constraint artifact_completed_reference check(status<>'complete' or (operation in ('image.create','image.edit') and version_id is not null) or (operation like 'visual.%' and visual is not null));
alter table public.ai_conversation_artifacts drop constraint visual_has_no_studio_reference;
alter table public.ai_conversation_artifacts add constraint visual_has_no_studio_reference check(operation not like 'visual.%' or (project_id is null and base_version_id is null and version_id is null and preview_key is null and preview_index is null));
alter table public.ai_conversation_artifacts add column generation_stages integer not null default 0 check(generation_stages between 0 and 2),add column usage_complete boolean not null default false;
alter table public.ai_artifact_selection add column scenario_percent integer not null default 0 check(scenario_percent between -50 and 50);

create or replace function public.ai_reconcile_artifact(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.ai_conversation_artifacts;image public.ai_studio_versions;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 select * into job from public.ai_conversation_artifacts where id=p_id and person_id=owner_id for update;
 if job.id is null or job.status not in ('running','uncertain') then return false;end if;
 if job.operation in ('visual.diagram','visual.comparison','visual.chart','visual.research-comparison') then
  if job.started_at<now()-interval '2 minutes' then update public.ai_conversation_artifacts set status='uncertain' where id=job.id;end if;return true;
 end if;
 select * into image from public.ai_studio_versions where id=job.id and person_id=owner_id and project_id=job.project_id;
 if image.status='complete' then
  update public.ai_conversation_artifacts set status='complete',version_id=image.id,finished_at=now(),preview_key=null,preview_index=null where id=job.id;
  insert into public.ai_artifact_selection(person_id,conversation_id,artifact_id) values(owner_id,job.conversation_id,job.id) on conflict(person_id,conversation_id) do nothing;
  if job.operation='image.edit' then
   update public.ai_artifact_selection s set artifact_id=job.id where s.person_id=owner_id and s.conversation_id=job.conversation_id and exists(select 1 from public.ai_conversation_artifacts a where a.id=s.artifact_id and a.version_id=job.base_version_id);
  end if;
  insert into public.ai_messages(person_id,conversation_id,role,position,content,parts,metadata,status)
  values(owner_id,job.conversation_id,'tool',2,'Image saved in Studio',jsonb_build_array(jsonb_build_object('type','studio-image','artifactId',job.id,'versionId',image.id,'projectId',job.project_id)),jsonb_build_object('artifactId',job.id),'complete')
  on conflict do nothing;
 elsif image.status='failed' then update public.ai_conversation_artifacts set status='failed',finished_at=now() where id=job.id;
 elsif job.started_at<now()-interval '5 minutes' then update public.ai_conversation_artifacts set status='uncertain' where id=job.id;
 end if;
 return true;
end $$;

create or replace function public.ai_propose_visual_artifact(p_id uuid,p_conversation uuid,p_operation text,p_prompt text)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('visual.diagram','visual.comparison','visual.chart','visual.research-comparison') then raise exception 'Invalid visual operation' using errcode='22023';end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id is null and archived_at is null) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.founder_access where person_id=owner_id) and not exists(select 1 from public.membership_accounts where person_id=owner_id and beta_access) then raise exception 'Pilot access required' using errcode='42501';end if;
 if exists(select 1 from public.ai_conversation_artifacts where id=p_id) then return false;end if;
 if (select count(*) from public.ai_conversation_artifacts where person_id=owner_id and status='approval')>=8
 or (select count(*) from public.ai_conversation_artifacts where person_id=owner_id and created_at>now()-interval '1 minute')>=6 then raise exception 'Proposal limit reached' using errcode='P0001';end if;
 insert into public.ai_conversation_artifacts(id,person_id,conversation_id,operation,prompt) values(p_id,owner_id,p_conversation,p_operation,p_prompt);
 return true;
end $$;

create or replace function public.ai_claim_visual_artifact(p_id uuid,p_approve boolean,p_model text)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.ai_conversation_artifacts;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731));
 perform 1 from public.persons where id=owner_id for update;
 select * into job from public.ai_conversation_artifacts where id=p_id and person_id=owner_id for update;
 if job.id is null or job.status<>'approval' or job.operation not in ('visual.diagram','visual.comparison','visual.chart','visual.research-comparison') then return false;end if;
 if not p_approve then update public.ai_conversation_artifacts set status='declined',finished_at=now() where id=job.id;return true;end if;
 if not exists(select 1 from public.founder_access where person_id=owner_id) and not exists(select 1 from public.membership_accounts where person_id=owner_id and beta_access) then raise exception 'Pilot access required' using errcode='42501';end if;
 if not exists(select 1 from public.ai_conversations where id=job.conversation_id and person_id=owner_id and archived_at is null and company_id is null) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '24 hours')>=120
 or (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '1 minute')>=10
 or exists(select 1 from public.ai_conversation_artifacts where person_id=owner_id and operation in ('visual.diagram','visual.comparison','visual.chart','visual.research-comparison') and status='running' and started_at>now()-interval '2 minutes') then raise exception 'Visual usage limit reached' using errcode='P0001';end if;
 if p_model is null or length(p_model) not between 1 and 100 then raise exception 'Invalid visual model' using errcode='22023';end if;
 -- Reserve the existing reasoning ledger without a pending Talk turn that would freeze speech.
 insert into public.ai_usage(id,person_id) values(job.id,owner_id);
 update public.ai_conversation_artifacts set status='running',started_at=now(),model=p_model where id=job.id;
 return true;
end $$;

create or replace function public.ai_finish_visual_artifact(p_id uuid,p_visual jsonb,p_text text,p_input integer,p_output integer,p_duration integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.ai_conversation_artifacts;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 select * into job from public.ai_conversation_artifacts where id=p_id and person_id=owner_id for update;
 if job.id is null or job.status not in ('running','uncertain') or job.operation not in ('visual.diagram','visual.comparison','visual.chart','visual.research-comparison') then return false;end if;
 if not exists(select 1 from public.ai_conversations where id=job.conversation_id and person_id=owner_id and archived_at is null and company_id is null) then return false;end if;
 if p_visual is not null then
  if jsonb_typeof(p_visual)<>'object' or length(p_visual::text)>24000 or p_visual->>'basis' is distinct from (case when job.operation in ('visual.chart','visual.research-comparison') then 'research' else 'conceptual' end)
   or p_visual->>'kind' is distinct from substring(job.operation from 8) or jsonb_typeof(p_visual->'title') is distinct from 'string'
   or jsonb_typeof(p_visual->'summary') is distinct from 'string' or p_text is null or length(btrim(p_text)) not between 1 and 16000 then raise exception 'Invalid visual result' using errcode='22023';end if;
  if job.operation in ('visual.chart','visual.research-comparison') and (jsonb_typeof(p_visual->'sources') is distinct from 'array' or jsonb_array_length(p_visual->'sources') not between 1 and 12 or jsonb_typeof(p_visual->'retrievedAt') is distinct from 'string') then raise exception 'Research sources required' using errcode='22023';end if;
  update public.ai_conversation_artifacts set visual=p_visual,status='complete',finished_at=now(),duration_ms=p_duration where id=job.id;
  insert into public.ai_messages(person_id,conversation_id,role,position,content,parts,metadata,status)
   values(owner_id,job.conversation_id,'tool',2,p_text,jsonb_build_array(jsonb_build_object('type','visual-board','artifactId',job.id)),jsonb_build_object('artifactId',job.id),'complete');
  insert into public.ai_artifact_selection(person_id,conversation_id,artifact_id) values(owner_id,job.conversation_id,job.id) on conflict(person_id,conversation_id) do nothing;
 else update public.ai_conversation_artifacts set status='failed',finished_at=now(),duration_ms=p_duration where id=job.id;
 end if;
 update public.ai_usage set input_tokens=p_input,output_tokens=p_output where id=job.id and person_id=owner_id;
 return true;
end $$;

create or replace function public.ai_select_artifact(p_conversation uuid,p_artifact uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if not exists(select 1 from public.ai_conversation_artifacts where id=p_artifact and person_id=owner_id and conversation_id=p_conversation and status='complete') then raise exception 'Artifact unavailable' using errcode='42501';end if;
 insert into public.ai_artifact_selection(person_id,conversation_id,artifact_id,part_id) values(owner_id,p_conversation,p_artifact,null)
 on conflict(person_id,conversation_id) do update set artifact_id=excluded.artifact_id,part_id=null,scenario_percent=0;
 return true;
end $$;

create or replace function public.ai_select_visual_part(p_conversation uuid,p_artifact uuid,p_part text)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;board jsonb;parts jsonb;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 select visual into board from public.ai_conversation_artifacts where id=p_artifact and person_id=owner_id and conversation_id=p_conversation and status='complete' and operation in ('visual.diagram','visual.comparison','visual.chart','visual.research-comparison');
 if board is null then raise exception 'Visual unavailable' using errcode='42501';end if;
 parts=case when board->>'kind'='diagram' then board->'nodes' when board->>'kind'='chart' then board->'points' else board->'options' end;
 if jsonb_typeof(parts) is distinct from 'array' then raise exception 'Invalid visual result' using errcode='22023';end if;
 if p_part is not null and not exists(select 1 from jsonb_array_elements(parts) as item where item->>'id'=p_part) then raise exception 'Visual part unavailable' using errcode='42501';end if;
 insert into public.ai_artifact_selection(person_id,conversation_id,artifact_id,part_id) values(owner_id,p_conversation,p_artifact,p_part)
 on conflict(person_id,conversation_id) do update set artifact_id=excluded.artifact_id,part_id=excluded.part_id,scenario_percent=case when public.ai_artifact_selection.artifact_id=excluded.artifact_id and board->>'kind'='chart' then public.ai_artifact_selection.scenario_percent else 0 end;
 return true;
end $$;

create function public.ai_finish_metered_visual_artifact(p_id uuid,p_visual jsonb,p_text text,p_input integer,p_output integer,p_duration integer,p_stages integer,p_usage_complete boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare saved boolean;
begin
 if p_stages is null or p_stages not between 1 and 2 or p_usage_complete is null or (p_usage_complete and (p_input is null or p_output is null)) then raise exception 'Invalid generation usage' using errcode='22023';end if;
 saved=public.ai_finish_visual_artifact(p_id,p_visual,p_text,p_input,p_output,p_duration);
 if saved then update public.ai_conversation_artifacts set generation_stages=p_stages,usage_complete=p_usage_complete where id=p_id and person_id in(select id from public.persons where auth_user_id=(select auth.uid()));end if;
 return saved;
end $$;
create function public.ai_set_chart_scenario(p_conversation uuid,p_artifact uuid,p_percent integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_percent is null or p_percent not between -50 and 50 then raise exception 'Invalid scenario percentage' using errcode='22023';end if;
 if not exists(select 1 from public.ai_conversation_artifacts a join public.ai_conversations c on c.id=a.conversation_id and c.person_id=a.person_id where a.id=p_artifact and a.person_id=owner_id and a.conversation_id=p_conversation and a.operation='visual.chart' and a.status='complete' and c.archived_at is null and c.company_id is null) then raise exception 'Chart unavailable' using errcode='42501';end if;
 insert into public.ai_artifact_selection(person_id,conversation_id,artifact_id,scenario_percent) values(owner_id,p_conversation,p_artifact,p_percent)
 on conflict(person_id,conversation_id) do update set artifact_id=excluded.artifact_id,scenario_percent=excluded.scenario_percent,part_id=case when public.ai_artifact_selection.artifact_id=excluded.artifact_id then public.ai_artifact_selection.part_id else null end;
 return true;
end $$;
revoke all on function public.ai_finish_metered_visual_artifact(uuid,jsonb,text,integer,integer,integer,integer,boolean),public.ai_set_chart_scenario(uuid,uuid,integer) from public,anon;
grant execute on function public.ai_finish_metered_visual_artifact(uuid,jsonb,text,integer,integer,integer,integer,boolean),public.ai_set_chart_scenario(uuid,uuid,integer) to authenticated;
