-- Additive: verified design provenance is derived from immutable Talk records.
-- Caller p_verified / p_source_kind cannot manufacture a verified destination.
-- Hosted apply still requires founder authorization. Signature is unchanged so
-- Architect #130 fb41859 can keep calling architect_apps_retain_design.
create or replace function public.architect_apps_retain_design(
  p_request uuid,
  p_project uuid,
  p_digest text,
  p_receipt jsonb,
  p_source_kind text,
  p_verified boolean
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_design_directions;
  talk_board_id uuid;
  talk_conversation uuid;
  talk_version integer;
  talk_ok boolean := false;
  stored_kind text;
  stored_verified boolean;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid design receipt'; end if;
  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then raise exception 'Invalid design receipt'; end if;
  if not exists(select 1 from public.architect_origin_projects where id = p_project and person_id = owner_id) then
    raise exception 'Project unavailable';
  end if;
  if to_regclass('public.ai_talk_creations') is not null
    and (p_receipt #>> '{identity,conversationId}') ~ '^[0-9a-f-]{36}$'
    and (p_receipt #>> '{identity,boardId}') ~ '^[0-9a-f-]{36}$'
    and (p_receipt #>> '{identity,boardVersion}') ~ '^[0-9]+$' then
    talk_conversation := (p_receipt #>> '{identity,conversationId}')::uuid;
    talk_board_id := (p_receipt #>> '{identity,boardId}')::uuid;
    talk_version := (p_receipt #>> '{identity,boardVersion}')::integer;
    execute
      'select exists(
        select 1 from public.ai_talk_creations
        where id = $1 and person_id = $2 and conversation_id = $3
          and version = $4 and kind = ''board'' and not candidate
          and coalesce(content->>''selectedDirectionId'', '''') <> ''''
      )'
      into talk_ok
      using talk_board_id, owner_id, talk_conversation, talk_version;
  end if;
  if talk_ok is true then
    stored_kind := 'talk-authorized';
    stored_verified := true;
  else
    stored_kind := case when p_source_kind = 'text-import' then 'text-import' else 'pending' end;
    stored_verified := false;
  end if;
  select * into existing from public.architect_design_directions where request_id = p_request;
  if found then
    if existing.person_id <> owner_id or existing.project_id <> p_project or existing.digest <> p_digest then
      raise exception 'Request already reserved with a different project or design receipt';
    end if;
    if existing.verified is distinct from stored_verified or existing.source_kind is distinct from stored_kind then
      raise exception 'Request already reserved with a different project or design receipt';
    end if;
    return existing.request_id;
  end if;
  insert into public.architect_design_directions(
    request_id, person_id, project_id, revision, digest, receipt, started, source_kind, verified
  ) values (
    p_request, owner_id, p_project, 1, p_digest, p_receipt, false, stored_kind, stored_verified
  );
  return p_request;
end $$;

revoke all on function public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean) from public, anon;
grant execute on function public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean) to authenticated;
