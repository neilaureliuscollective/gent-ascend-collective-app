-- Talk #131 f357385 keeps this six-argument signature.
-- Browser/API callers cannot self-assert verified status through p_verified
-- or p_source_kind. Talk-authorized verification is derived on the Talk
-- checkout from immutable board records (160000_authority / 170000_provenance).
-- This Architect checkout does not copy those files. text-import is owner
-- integrity of the submitted payload, not Talk-board verification.
-- Hosted apply still requires founder authorization.
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
  stored_kind := case when p_source_kind = 'text-import' then 'text-import' else 'pending' end;
  stored_verified := false;
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
