-- Additive bind of Talk import acknowledgement to this handoff's Origin save.
-- Does not change previously applied Origin files or 20261014010000_talk_origin_import.sql.
-- Uses existing pgcrypto digest(); do not create the extension here (PGlite ledgers cannot).
alter table public.ai_talk_origin_imports
 add column if not exists save_id uuid,
 add column if not exists provenance jsonb not null default '{}'::jsonb;
update public.ai_talk_origin_imports as receipt
 set save_id = version.id
 from public.architect_origin_versions as version
 where receipt.save_id is null
   and version.project_id = receipt.project_id
   and version.person_id = receipt.person_id
   and version.note = 'Imported from Talk'
   and version.revision = 1;
delete from public.ai_talk_origin_imports where save_id is null;
alter table public.ai_talk_origin_imports
 alter column save_id set not null,
 add constraint ai_talk_origin_imports_save
  foreign key(save_id) references public.architect_origin_versions(id) on delete cascade;
create unique index if not exists ai_talk_origin_imports_owner_save
 on public.ai_talk_origin_imports(person_id,save_id);
create unique index if not exists ai_talk_origin_imports_owner_project
 on public.ai_talk_origin_imports(person_id,project_id);

-- Same SHA-1 UUID v5-style identity as src/domains/talk-creation/persist.ts scopedTalkIdentity.
create function public.ai_talk_scoped_identity(p_seed text) returns uuid
language plpgsql immutable set search_path=public,extensions as $$
declare raw bytea; hex text;
begin
 if p_seed is null or length(p_seed)=0 then
  raise exception 'Invalid import' using errcode='P0001';
 end if;
 raw := substring(digest(convert_to(p_seed,'UTF8'),'sha1') from 1 for 16);
 raw := set_byte(set_byte(raw,6,(get_byte(raw,6)&15)|80),8,(get_byte(raw,8)&63)|128);
 hex := encode(raw,'hex');
 return (
  substr(hex,1,8)||'-'||substr(hex,9,4)||'-'||substr(hex,13,4)||'-'||substr(hex,17,4)||'-'||substr(hex,21,12)
 )::uuid;
end $$;
revoke all on function public.ai_talk_scoped_identity(text) from public,anon;
grant execute on function public.ai_talk_scoped_identity(text) to authenticated;

drop function if exists public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,text);

create function public.ai_talk_record_origin_import(
 p_id uuid,p_handoff uuid,p_project uuid,p_save uuid,p_conversation uuid,p_prepared text,p_provenance jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; package public.ai_talk_creations; receipt public.ai_talk_origin_imports;
 expected_project uuid; expected_save uuid;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_id is null or p_handoff is null or p_project is null or p_save is null or p_conversation is null
    or p_prepared is null or length(trim(p_prepared)) not between 20 and 40
    or p_provenance is null or jsonb_typeof(p_provenance)<>'object'
    or octet_length(p_provenance::text)>8000 then
  raise exception 'Invalid import' using errcode='P0001';
 end if;
 expected_project := public.ai_talk_scoped_identity('talk-origin-project:'||owner_id::text||':'||p_handoff::text);
 expected_save := public.ai_talk_scoped_identity('talk-origin-save:'||owner_id::text||':'||p_handoff::text);
 if p_project<>expected_project or p_save<>expected_save then
  raise exception 'Project unavailable' using errcode='P0001';
 end if;
 select * into receipt from public.ai_talk_origin_imports where id=p_id;
 if found then
  if receipt.person_id<>owner_id or receipt.handoff_id<>p_handoff or receipt.project_id<>p_project
     or receipt.save_id<>p_save or receipt.conversation_id<>p_conversation
     or receipt.prepared_at<>p_prepared then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object('id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,'saveId',receipt.save_id,'recovered',true);
 end if;
 select * into receipt from public.ai_talk_origin_imports where person_id=owner_id and handoff_id=p_handoff;
 if found then
  if receipt.project_id<>p_project or receipt.save_id<>p_save or receipt.conversation_id<>p_conversation
     or receipt.prepared_at<>p_prepared then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object('id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,'saveId',receipt.save_id,'recovered',true);
 end if;
 select * into package from public.ai_talk_creations where id=p_handoff and person_id=owner_id for update;
 if not found or package.kind<>'handoff' or package.conversation_id<>p_conversation then
  raise exception 'Package unavailable' using errcode='42501';
 end if;
 if package.content->>'preparedAt' is distinct from p_prepared then
  raise exception 'Import request reused with different inputs' using errcode='23514';
 end if;
 if not exists(
  select 1 from public.architect_origin_versions
   where id=p_save and project_id=p_project and person_id=owner_id
     and note='Imported from Talk' and revision=1
 ) then
  raise exception 'Project unavailable' using errcode='P0001';
 end if;
 begin
  insert into public.ai_talk_origin_imports(id,person_id,handoff_id,conversation_id,project_id,save_id,prepared_at,provenance)
  values(p_id,owner_id,p_handoff,p_conversation,p_project,p_save,p_prepared,p_provenance);
 exception when unique_violation then
  select * into receipt from public.ai_talk_origin_imports
   where person_id=owner_id and (id=p_id or handoff_id=p_handoff or save_id=p_save or project_id=p_project);
  if not found then raise exception 'Import receipt unavailable' using errcode='P0001'; end if;
  if receipt.project_id<>p_project or receipt.save_id<>p_save or receipt.conversation_id<>p_conversation
     or receipt.prepared_at<>p_prepared
     or (receipt.id<>p_id and receipt.handoff_id<>p_handoff) then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object('id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,'saveId',receipt.save_id,'recovered',true);
 end;
 return jsonb_build_object('id',p_id,'handoffId',p_handoff,'projectId',p_project,'saveId',p_save,'recovered',false);
end $$;
revoke all on function public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,uuid,text,jsonb) to authenticated;
