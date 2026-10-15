-- Align Talk image SQL with studio.create. Live RPCs keep founder/beta admission.
-- Hosted apply requires founder authorization; this file is not production access.
create function public.talk_studio_entitled(p_person uuid) returns boolean
language sql stable set search_path='' as $$
 select
  exists(select 1 from public.founder_access where person_id=p_person)
  or exists(select 1 from public.membership_accounts where person_id=p_person and beta_access)
  or exists(
    select 1 from public.membership_accounts
    where person_id=p_person
      and tier in ('aurelius','health','signature','reserve')
      and (
        (billing_state='active' and access_until is not null and access_until>now())
        or (billing_state='trialing' and trial_ends_at is not null and trial_ends_at>now())
        or (billing_state='canceled' and access_until is not null and access_until>now())
      )
  );
$$;
revoke all on function public.talk_studio_entitled(uuid) from public,anon;
grant execute on function public.talk_studio_entitled(uuid) to authenticated;

create function public.ai_talk_propose_image(p_id uuid,p_conversation uuid,p_operation text,p_prompt text,p_project uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; chosen public.ai_conversation_artifacts;
begin
 if p_operation is null or p_operation not in ('image.create','image.edit') then raise exception 'Invalid image operation' using errcode='22023';end if;
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id is null and archived_at is null) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if not public.talk_studio_entitled(owner_id) then raise exception 'Studio image creation is not enabled' using errcode='42501';end if;
 if exists(select 1 from public.ai_conversation_artifacts where id=p_id) then
  if exists(select 1 from public.ai_conversation_artifacts where id=p_id and person_id=owner_id and conversation_id=p_conversation and operation=p_operation and prompt=p_prompt) then
   return true;
  end if;
  raise exception 'Image request reused with different inputs' using errcode='23514';
 end if;
 if (select count(*) from public.ai_conversation_artifacts where person_id=owner_id and status='approval')>=8
 or (select count(*) from public.ai_conversation_artifacts where person_id=owner_id and created_at>now()-interval '1 minute')>=6 then raise exception 'Proposal limit reached' using errcode='P0001';end if;
 if p_project is not null and not exists(select 1 from public.ai_studio_projects where id=p_project and person_id=owner_id and company_id is null) then raise exception 'Project unavailable' using errcode='42501';end if;
 if p_operation='image.edit' then
  select a.* into chosen from public.ai_artifact_selection s join public.ai_conversation_artifacts a on a.id=s.artifact_id and a.person_id=s.person_id where s.person_id=owner_id and s.conversation_id=p_conversation and a.status='complete';
  if chosen.id is null or not exists(select 1 from public.ai_studio_versions where id=chosen.version_id and project_id=chosen.project_id and person_id=owner_id and status='complete') then raise exception 'Select a completed image first' using errcode='P0001';end if;
  if p_project is not null and p_project<>chosen.project_id then raise exception 'Selection mismatch' using errcode='42501';end if;
 end if;
 insert into public.ai_conversation_artifacts(id,person_id,conversation_id,operation,prompt,project_id,base_version_id)
 values(p_id,owner_id,p_conversation,p_operation,p_prompt,case when p_operation='image.edit' then chosen.project_id else p_project end,case when p_operation='image.edit' then chosen.version_id else null end);
 return true;
end $$;

create function public.ai_talk_claim_image(p_id uuid,p_approve boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.ai_conversation_artifacts;project uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731));
 select * into job from public.ai_conversation_artifacts where id=p_id and person_id=owner_id for update;
 if job.id is null or job.status<>'approval' or job.operation not in ('image.create','image.edit') then return false;end if;
 if not p_approve then update public.ai_conversation_artifacts set status='declined',finished_at=now() where id=job.id;return true;end if;
 if not public.talk_studio_entitled(owner_id) then raise exception 'Studio image creation is not enabled' using errcode='42501';end if;
 if not exists(select 1 from public.ai_conversations where id=job.conversation_id and person_id=owner_id and archived_at is null and company_id is null) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if job.operation='image.edit' and not exists(select 1 from public.ai_artifact_selection s join public.ai_conversation_artifacts a on a.id=s.artifact_id and a.person_id=s.person_id where s.person_id=owner_id and s.conversation_id=job.conversation_id and a.version_id=job.base_version_id and a.status='complete') then raise exception 'Selected image changed; propose the edit again' using errcode='P0001';end if;
 project=job.project_id;
 if project is null then
  project=gen_random_uuid();insert into public.ai_studio_projects(id,person_id,title,creative_type) values(project,owner_id,'Talk creation','personal');
 elsif not exists(select 1 from public.ai_studio_projects where id=project and person_id=owner_id and company_id is null) then raise exception 'Project unavailable' using errcode='42501';end if;
 if not public.ai_studio_begin(job.id,project,job.base_version_id,null,job.prompt,'gpt-image-2.5-flare','1024x1024') then raise exception 'Operation already reserved' using errcode='23505';end if;
 update public.ai_conversation_artifacts set status='running',started_at=now(),project_id=project where id=job.id;
 return true;
end $$;

revoke all on function public.ai_talk_propose_image(uuid,uuid,text,text,uuid),public.ai_talk_claim_image(uuid,boolean) from public,anon;
grant execute on function public.ai_talk_propose_image(uuid,uuid,text,text,uuid),public.ai_talk_claim_image(uuid,boolean) to authenticated;
