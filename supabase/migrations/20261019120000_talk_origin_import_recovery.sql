-- Forward-only qualification of unique-violation recovery in ai_talk_import_origin.
-- Does not rewrite 20261014040000_talk_origin_import_consistency.sql or earlier Talk/Origin files.
-- Hosted apply requires separate founder authorization and is not part of the original 18.
-- Default PL/pgSQL variable_conflict is error; unqualified save_id=save_id / project_id=project_id
-- collide with table columns (https://www.postgresql.org/docs/current/plpgsql-implementation.html#PLPGSQL-VAR-SUBST).
drop function if exists public.ai_talk_import_origin(uuid,uuid,uuid);

create function public.ai_talk_import_origin(p_id uuid,p_handoff uuid,p_conversation uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict error
declare
 owner_id uuid; package public.ai_talk_creations; creation public.ai_talk_creations;
 receipt public.ai_talk_origin_imports; version_row public.architect_origin_versions;
 selection jsonb; image jsonb; brief jsonb; plan jsonb; palette jsonb; images jsonb := '[]'::jsonb;
 mapped jsonb; content jsonb; provenance jsonb; intended_project_id uuid; intended_save_id uuid;
 artifact_ok boolean;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_id is null or p_handoff is null or p_conversation is null then
  raise exception 'Invalid import' using errcode='P0001';
 end if;
 select * into receipt from public.ai_talk_origin_imports where id=p_id;
 if found then
  if receipt.person_id<>owner_id or receipt.handoff_id<>p_handoff or receipt.conversation_id<>p_conversation then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object(
   'id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,
   'saveId',receipt.save_id,'mappingVersion',receipt.mapping_version,'recovered',true
  );
 end if;
 select * into receipt from public.ai_talk_origin_imports where person_id=owner_id and handoff_id=p_handoff;
 if found then
  if receipt.conversation_id<>p_conversation then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object(
   'id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,
   'saveId',receipt.save_id,'mappingVersion',receipt.mapping_version,'recovered',true
  );
 end if;
 select * into package from public.ai_talk_creations
  where id=p_handoff and person_id=owner_id and conversation_id=p_conversation and kind='handoff' for update;
 if not found then raise exception 'Package unavailable' using errcode='42501'; end if;
 if package.content->>'schema' is distinct from 'talk-architect-handoff/v1'
    or package.content->>'conversationId' is distinct from p_conversation::text then
  raise exception 'Package unavailable' using errcode='42501';
 end if;
 for selection in select value from jsonb_array_elements(coalesce(package.content->'selections','[]'::jsonb))
 loop
  select * into creation from public.ai_talk_creations
   where id=(selection->>'versionId')::uuid
     and person_id=owner_id
     and conversation_id=p_conversation
     and kind=selection->>'kind'
     and lineage_id=(selection->>'lineageId')::uuid
     and version=(selection->>'version')::int
     and coalesce(candidate,false)=false;
  if not found then raise exception 'Package unavailable' using errcode='42501'; end if;
  if creation.kind='brief' then
   if brief is not null then
    raise exception 'Choose one current brief, plan or palette of each kind.' using errcode='23514';
   end if;
   brief := creation.content;
  elsif creation.kind='plan' then
   if plan is not null then
    raise exception 'Choose one current brief, plan or palette of each kind.' using errcode='23514';
   end if;
   plan := creation.content;
  elsif creation.kind='palette' then
   if palette is not null then
    raise exception 'Choose one current brief, plan or palette of each kind.' using errcode='23514';
   end if;
   palette := creation.content;
  end if;
 end loop;
 for image in select value from jsonb_array_elements(coalesce(package.content->'images','[]'::jsonb))
 loop
  if to_regclass('public.ai_conversation_artifacts') is null then
   raise exception 'Package unavailable' using errcode='42501';
  end if;
  execute
   'select exists(select 1 from public.ai_conversation_artifacts where id=$1 and person_id=$2 and conversation_id=$3 and version_id=$4 and project_id=$5 and status=''complete'')'
   into artifact_ok
   using (image->>'artifactId')::uuid, owner_id, p_conversation, (image->>'versionId')::uuid, (image->>'projectId')::uuid;
  if not coalesce(artifact_ok,false) then
   raise exception 'Package unavailable' using errcode='42501';
  end if;
  images := images || jsonb_build_array(image);
 end loop;
 mapped := public.ai_talk_origin_mapped_project(package.content, brief, plan, palette, images);
 content := mapped->'content';
 provenance := mapped->'provenance';
 intended_project_id := public.ai_talk_scoped_identity('talk-origin-project:'||owner_id::text||':'||p_handoff::text);
 intended_save_id := public.ai_talk_scoped_identity('talk-origin-save:'||owner_id::text||':'||p_handoff::text);
 select * into version_row from public.architect_origin_versions where id=intended_save_id;
 if found then
  if version_row.person_id<>owner_id or version_row.project_id<>intended_project_id
     or version_row.note is distinct from 'Imported from Talk'
     or version_row.content is distinct from content then
   raise exception 'Project unavailable' using errcode='P0001';
  end if;
 else
  perform public.architect_origin_save(intended_project_id, intended_save_id, 0, content, 'Imported from Talk');
 end if;
 begin
  insert into public.ai_talk_origin_imports(
   id,person_id,handoff_id,conversation_id,project_id,save_id,prepared_at,provenance,mapping_version
  ) values(
   p_id,owner_id,p_handoff,p_conversation,intended_project_id,intended_save_id,
   package.content->>'preparedAt',provenance,'talk-origin-import/v1'
  );
 exception when unique_violation then
  select * into receipt from public.ai_talk_origin_imports as origin_import
   where origin_import.person_id=owner_id
     and (
      origin_import.id=p_id
      or origin_import.handoff_id=p_handoff
      or origin_import.save_id=intended_save_id
      or origin_import.project_id=intended_project_id
     );
  if not found then raise exception 'Import receipt unavailable' using errcode='P0001'; end if;
  if receipt.handoff_id<>p_handoff or receipt.conversation_id<>p_conversation
     or receipt.project_id<>intended_project_id or receipt.save_id<>intended_save_id then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object(
   'id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,
   'saveId',receipt.save_id,'mappingVersion',receipt.mapping_version,'recovered',true
  );
 end;
 return jsonb_build_object(
  'id',p_id,'handoffId',p_handoff,'projectId',intended_project_id,
  'saveId',intended_save_id,'mappingVersion','talk-origin-import/v1','recovered',false
 );
end $$;
revoke all on function public.ai_talk_import_origin(uuid,uuid,uuid) from public,anon;
grant execute on function public.ai_talk_import_origin(uuid,uuid,uuid) to authenticated;
