-- Additive Talk → Origin import receipts. Hosted apply requires founder authorization.
-- Does not change previously applied Origin or Talk migration files.
create table public.ai_talk_origin_imports (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 handoff_id uuid not null,
 conversation_id uuid not null,
 project_id uuid not null,
 prepared_at text not null check(length(prepared_at) between 20 and 40),
 created_at timestamptz not null default now(),
 unique(person_id,handoff_id),
 unique(person_id,id),
 foreign key(handoff_id) references public.ai_talk_creations(id) on delete cascade,
 foreign key(project_id,person_id) references public.architect_origin_projects(id,person_id) on delete cascade
);
create index ai_talk_origin_imports_owner_handoff on public.ai_talk_origin_imports(person_id,handoff_id);
alter table public.ai_talk_origin_imports enable row level security;
revoke all on public.ai_talk_origin_imports from public,anon,authenticated;
grant select on public.ai_talk_origin_imports to authenticated;
create policy talk_origin_imports_owner on public.ai_talk_origin_imports for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_talk_record_origin_import(
 p_id uuid,p_handoff uuid,p_project uuid,p_conversation uuid,p_prepared text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; package public.ai_talk_creations; receipt public.ai_talk_origin_imports;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_id is null or p_handoff is null or p_project is null or p_conversation is null
    or p_prepared is null or length(trim(p_prepared)) not between 20 and 40 then
  raise exception 'Invalid import' using errcode='P0001';
 end if;
 select * into receipt from public.ai_talk_origin_imports where id=p_id;
 if found then
  if receipt.person_id<>owner_id or receipt.handoff_id<>p_handoff or receipt.project_id<>p_project
     or receipt.conversation_id<>p_conversation or receipt.prepared_at<>p_prepared then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object('id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,'recovered',true);
 end if;
 select * into receipt from public.ai_talk_origin_imports where person_id=owner_id and handoff_id=p_handoff;
 if found then
  if receipt.project_id<>p_project or receipt.conversation_id<>p_conversation or receipt.prepared_at<>p_prepared then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object('id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,'recovered',true);
 end if;
 select * into package from public.ai_talk_creations where id=p_handoff and person_id=owner_id for update;
 if not found or package.kind<>'handoff' or package.conversation_id<>p_conversation then
  raise exception 'Package unavailable' using errcode='42501';
 end if;
 if package.content->>'preparedAt' is distinct from p_prepared then
  raise exception 'Import request reused with different inputs' using errcode='23514';
 end if;
 if not exists(select 1 from public.architect_origin_projects where id=p_project and person_id=owner_id) then
  raise exception 'Project unavailable' using errcode='P0001';
 end if;
 begin
  insert into public.ai_talk_origin_imports(id,person_id,handoff_id,conversation_id,project_id,prepared_at)
  values(p_id,owner_id,p_handoff,p_conversation,p_project,p_prepared);
 exception when unique_violation then
  select * into receipt from public.ai_talk_origin_imports
   where person_id=owner_id and (id=p_id or handoff_id=p_handoff);
  if not found then raise exception 'Import receipt unavailable' using errcode='P0001'; end if;
  if receipt.project_id<>p_project or receipt.conversation_id<>p_conversation or receipt.prepared_at<>p_prepared
     or (receipt.id<>p_id and receipt.handoff_id<>p_handoff) then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object('id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,'recovered',true);
 end;
 return jsonb_build_object('id',p_id,'handoffId',p_handoff,'projectId',p_project,'recovered',false);
end $$;
revoke all on function public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,text) to authenticated;
