-- Talk #131 bf47627 still calls this signature. p_verified is accepted and ignored.
-- Browser/API callers cannot self-assert verified status; the RPC derives it from
-- owner-authorized source_kind after session identity is resolved.
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
  derived_verified boolean;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid design receipt'; end if;
  if p_source_kind is null or p_source_kind not in ('text-import','talk-authorized','pending') then raise exception 'Invalid design receipt'; end if;
  if not exists(select 1 from public.architect_origin_projects where id = p_project and person_id = owner_id) then
    raise exception 'Project unavailable';
  end if;
  derived_verified := p_source_kind in ('text-import','talk-authorized');
  select * into existing from public.architect_design_directions where request_id = p_request;
  if found then
    if existing.person_id <> owner_id or existing.project_id <> p_project or existing.digest <> p_digest then
      raise exception 'Request already reserved with a different project or design receipt';
    end if;
    return existing.request_id;
  end if;
  insert into public.architect_design_directions(request_id, person_id, project_id, revision, digest, receipt, started, source_kind, verified)
    values(p_request, owner_id, p_project, 1, p_digest, p_receipt, false, p_source_kind, derived_verified);
  return p_request;
end $$;
