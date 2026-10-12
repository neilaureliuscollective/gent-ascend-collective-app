-- Paid image work is independent of a short voice session. Studio owns all image bytes/versions.
create table public.ai_conversation_artifacts (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid not null,
 operation text not null check(operation in ('image.create','image.edit')),
 prompt text not null check(length(btrim(prompt)) between 3 and 3000),
 project_id uuid,
 base_version_id uuid,
 version_id uuid,preview_key text,preview_index integer check(preview_index between 0 and 2),
 status text not null default 'approval' check(status in ('approval','running','complete','failed','uncertain','declined')),
 created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,
 unique(person_id,conversation_id,id),
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete cascade,
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id),
 foreign key(person_id,project_id,base_version_id) references public.ai_studio_versions(person_id,project_id,id),
 foreign key(person_id,project_id,version_id) references public.ai_studio_versions(person_id,project_id,id),
 check(operation<>'image.edit' or (project_id is not null and base_version_id is not null)),
 check(status<>'complete' or version_id is not null)
);
create index ai_conversation_artifacts_owner_time on public.ai_conversation_artifacts(person_id,conversation_id,created_at desc);
alter table public.ai_conversation_artifacts enable row level security;
revoke all on public.ai_conversation_artifacts from public,anon,authenticated;
grant select on public.ai_conversation_artifacts to authenticated;
create policy artifacts_owner on public.ai_conversation_artifacts for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create table public.ai_artifact_selection (
 person_id uuid not null references public.persons(id) on delete cascade,conversation_id uuid not null,
 artifact_id uuid not null,primary key(person_id,conversation_id),
 foreign key(person_id,conversation_id,artifact_id) references public.ai_conversation_artifacts(person_id,conversation_id,id) on delete cascade
);
alter table public.ai_artifact_selection enable row level security;
revoke all on public.ai_artifact_selection from public,anon,authenticated;
grant select on public.ai_artifact_selection to authenticated;
create policy artifact_selection_owner on public.ai_artifact_selection for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_propose_image_artifact(p_id uuid,p_conversation uuid,p_operation text,p_prompt text,p_project uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; chosen public.ai_conversation_artifacts;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id is null and archived_at is null) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.founder_access where person_id=owner_id) and not exists(select 1 from public.membership_accounts where person_id=owner_id and beta_access) then raise exception 'Pilot access required' using errcode='42501';end if;
 if exists(select 1 from public.ai_conversation_artifacts where id=p_id) then return false;end if;
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
create function public.ai_select_artifact(p_conversation uuid,p_artifact uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if not exists(select 1 from public.ai_conversation_artifacts where id=p_artifact and person_id=owner_id and conversation_id=p_conversation and status='complete') then raise exception 'Image unavailable' using errcode='42501';end if;
 insert into public.ai_artifact_selection(person_id,conversation_id,artifact_id) values(owner_id,p_conversation,p_artifact)
 on conflict(person_id,conversation_id) do update set artifact_id=excluded.artifact_id;
 return true;
end $$;
create function public.ai_claim_image_artifact(p_id uuid,p_approve boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.ai_conversation_artifacts;project uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,731));
 select * into job from public.ai_conversation_artifacts where id=p_id and person_id=owner_id for update;
 if job.id is null or job.status<>'approval' then return false;end if;
 if not p_approve then update public.ai_conversation_artifacts set status='declined',finished_at=now() where id=job.id;return true;end if;
 if not exists(select 1 from public.founder_access where person_id=owner_id) and not exists(select 1 from public.membership_accounts where person_id=owner_id and beta_access) then raise exception 'Pilot access required' using errcode='42501';end if;
 if not exists(select 1 from public.ai_conversations where id=job.conversation_id and person_id=owner_id and archived_at is null and company_id is null) then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if job.operation='image.edit' and not exists(select 1 from public.ai_artifact_selection s join public.ai_conversation_artifacts a on a.id=s.artifact_id and a.person_id=s.person_id where s.person_id=owner_id and s.conversation_id=job.conversation_id and a.version_id=job.base_version_id and a.status='complete') then raise exception 'Selected image changed; propose the edit again' using errcode='P0001';end if;
 project=job.project_id;
 if project is null then
  project=gen_random_uuid();insert into public.ai_studio_projects(id,person_id,title,creative_type) values(project,owner_id,'Live creation','personal');
 elsif not exists(select 1 from public.ai_studio_projects where id=project and person_id=owner_id and company_id is null) then raise exception 'Project unavailable' using errcode='42501';end if;
 -- Reserve the existing paid Studio operation in the same transaction as claim.
 if not public.ai_studio_begin(job.id,project,job.base_version_id,null,job.prompt,'gpt-image-2.5-flare','1024x1024') then raise exception 'Operation already reserved' using errcode='23505';end if;
 update public.ai_conversation_artifacts set status='running',started_at=now(),project_id=project where id=job.id;
 return true;
end $$;
create function public.ai_reconcile_artifact(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.ai_conversation_artifacts;image public.ai_studio_versions;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 select * into job from public.ai_conversation_artifacts where id=p_id and person_id=owner_id for update;
 if job.id is null or job.status not in ('running','uncertain') then return false;end if;
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
revoke all on function public.ai_propose_image_artifact(uuid,uuid,text,text,uuid),public.ai_select_artifact(uuid,uuid),public.ai_claim_image_artifact(uuid,boolean),public.ai_reconcile_artifact(uuid) from public,anon;
grant execute on function public.ai_propose_image_artifact(uuid,uuid,text,text,uuid),public.ai_select_artifact(uuid,uuid),public.ai_claim_image_artifact(uuid,boolean),public.ai_reconcile_artifact(uuid) to authenticated;

create function public.ai_artifact_preview(p_id uuid,p_index integer,p_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;changed integer;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 update public.ai_conversation_artifacts a set preview_key=p_key,preview_index=p_index
 where a.id=p_id and a.person_id=owner_id and a.status='running' and p_index between 0 and 2
 and (a.preview_index is null or a.preview_index<p_index)
 and p_key=(select auth.uid())::text||'/'||a.project_id::text||'/'||a.id::text||'.partial-'||p_index::text||'.png';
 get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.ai_artifact_preview(uuid,integer,text) from public,anon;
grant execute on function public.ai_artifact_preview(uuid,integer,text) to authenticated;
