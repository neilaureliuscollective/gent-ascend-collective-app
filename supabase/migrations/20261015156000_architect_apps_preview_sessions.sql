-- Additive Apps preview-session authority and contract-aware schema probe.
-- Local-only until founder-approved hosted application. Version stays before Talk retain/provenance.

create table public.architect_app_preview_sessions (
  nonce text primary key check (nonce ~ '^[0-9a-f]{16}$'),
  person_id uuid not null,
  project_id uuid not null,
  revision_id uuid not null,
  token text not null check (length(token) between 16 and 200),
  exp integer not null,
  generation integer not null check (generation >= 1),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (nonce, person_id),
  foreign key (revision_id, person_id) references public.architect_app_revisions(id, person_id) on delete cascade
);
create unique index architect_app_preview_sessions_current
  on public.architect_app_preview_sessions (revision_id)
  where revoked_at is null;
create index architect_app_preview_sessions_owner
  on public.architect_app_preview_sessions (person_id, revision_id, created_at desc);

alter table public.architect_app_preview_sessions enable row level security;
create policy architect_app_preview_sessions_owner on public.architect_app_preview_sessions for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
revoke all on table public.architect_app_preview_sessions from public, anon;
grant select on table public.architect_app_preview_sessions to authenticated;

create or replace function public.architect_apps_schema_probe()
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  missing text[] := '{}';
  artifact_has_id boolean := false;
  artifact_has_revision boolean := false;
begin
  if not public.architect_apps_worker_ok() then
    raise exception 'Worker authorization required' using errcode = '42501';
  end if;
  if to_regclass('public.architect_apps') is null then missing := array_append(missing, 'architect_apps'); end if;
  if to_regclass('public.architect_app_revisions') is null then missing := array_append(missing, 'architect_app_revisions'); end if;
  if to_regclass('public.architect_app_artifacts') is null then missing := array_append(missing, 'architect_app_artifacts'); end if;
  if to_regclass('public.architect_app_jobs') is null then missing := array_append(missing, 'architect_app_jobs'); end if;
  if to_regclass('public.architect_app_events') is null then missing := array_append(missing, 'architect_app_events'); end if;
  if to_regclass('public.architect_app_records') is null then missing := array_append(missing, 'architect_app_records'); end if;
  if to_regclass('public.architect_app_preview_sessions') is null then missing := array_append(missing, 'architect_app_preview_sessions'); end if;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'architect_app_artifacts' and column_name = 'id'
  ) into artifact_has_id;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'architect_app_artifacts' and column_name = 'revision_id'
  ) into artifact_has_revision;
  if to_regclass('public.architect_app_artifacts') is not null and not artifact_has_revision then
    missing := array_append(missing, 'architect_app_artifacts.revision_id');
  end if;
  if artifact_has_id then
    missing := array_append(missing, 'architect_app_artifacts.id');
  end if;
  if to_regproc('public.architect_apps_approve') is null then
    missing := array_append(missing, 'architect_apps_approve');
  end if;
  if to_regproc('public.architect_apps_start') is null then
    missing := array_append(missing, 'architect_apps_start');
  end if;
  if to_regproc('public.architect_apps_claim') is null then
    missing := array_append(missing, 'architect_apps_claim');
  end if;
  if to_regproc('public.architect_apps_heartbeat') is null then
    missing := array_append(missing, 'architect_apps_heartbeat');
  end if;
  if to_regproc('public.architect_apps_finish') is null then
    missing := array_append(missing, 'architect_apps_finish');
  end if;
  if to_regproc('public.architect_apps_write_record') is null then
    missing := array_append(missing, 'architect_apps_write_record');
  end if;
  if to_regproc('public.architect_apps_timeout') is null then
    missing := array_append(missing, 'architect_apps_timeout');
  end if;
  if to_regproc('public.architect_apps_preview_issue') is null then
    missing := array_append(missing, 'architect_apps_preview_issue');
  end if;
  if to_regproc('public.architect_apps_preview_read') is null then
    missing := array_append(missing, 'architect_apps_preview_read');
  end if;
  if to_regproc('public.architect_apps_preview_revoke') is null then
    missing := array_append(missing, 'architect_apps_preview_revoke');
  end if;
  return jsonb_build_object(
    'ok', coalesce(array_length(missing, 1), 0) = 0,
    'missing', to_jsonb(missing),
    'contracts', jsonb_build_object(
      'architect_app_artifacts', 'revision_id',
      'architect_app_preview_sessions', 'nonce'
    )
  );
end $$;

create or replace function public.architect_apps_preview_issue(
  p_revision uuid,
  p_nonce text,
  p_token text,
  p_exp integer,
  p_replace boolean default false
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  project uuid;
  existing public.architect_app_preview_sessions;
  next_generation integer;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_revision is null or p_nonce is null or p_nonce !~ '^[0-9a-f]{16}$' then raise exception 'Invalid preview session'; end if;
  if p_token is null or length(p_token) not between 16 and 200 then raise exception 'Invalid preview session'; end if;
  if p_exp is null or p_exp <= extract(epoch from now())::integer then raise exception 'Invalid preview session'; end if;
  select project_id into project from public.architect_app_revisions
    where id = p_revision and person_id = owner_id;
  if project is null then raise exception 'Revision unavailable'; end if;
  select * into existing from public.architect_app_preview_sessions
    where revision_id = p_revision and revoked_at is null
    for update;
  if existing.nonce is not null and not coalesce(p_replace, false) and existing.exp > extract(epoch from now())::integer + 5 then
    return jsonb_build_object(
      'nonce', existing.nonce,
      'token', existing.token,
      'exp', existing.exp,
      'generation', existing.generation,
      'person_id', existing.person_id,
      'project_id', existing.project_id,
      'revision_id', existing.revision_id,
      'revoked', false
    );
  end if;
  if existing.nonce is not null then
    update public.architect_app_preview_sessions
      set revoked_at = now()
      where nonce = existing.nonce and revoked_at is null;
    next_generation := existing.generation + 1;
  else
    select coalesce(max(generation), 0) + 1 into next_generation
      from public.architect_app_preview_sessions
      where revision_id = p_revision;
  end if;
  insert into public.architect_app_preview_sessions (
    nonce, person_id, project_id, revision_id, token, exp, generation
  ) values (p_nonce, owner_id, project, p_revision, p_token, p_exp, next_generation);
  return jsonb_build_object(
    'nonce', p_nonce,
    'token', p_token,
    'exp', p_exp,
    'generation', next_generation,
    'person_id', owner_id,
    'project_id', project,
    'revision_id', p_revision,
    'revoked', false
  );
end $$;

create or replace function public.architect_apps_preview_read(p_nonce text)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  owner_id uuid;
  row public.architect_app_preview_sessions;
  current_nonce text;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_nonce is null then return null; end if;
  select * into row from public.architect_app_preview_sessions
    where nonce = p_nonce and person_id = owner_id;
  if row.nonce is null then return null; end if;
  select nonce into current_nonce from public.architect_app_preview_sessions
    where revision_id = row.revision_id and revoked_at is null;
  return jsonb_build_object(
    'nonce', row.nonce,
    'token', row.token,
    'exp', row.exp,
    'generation', row.generation,
    'person_id', row.person_id,
    'project_id', row.project_id,
    'revision_id', row.revision_id,
    'revoked', row.revoked_at is not null or current_nonce is distinct from row.nonce
  );
end $$;

create or replace function public.architect_apps_preview_current(p_revision uuid)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  owner_id uuid;
  row public.architect_app_preview_sessions;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into row from public.architect_app_preview_sessions
    where revision_id = p_revision and person_id = owner_id and revoked_at is null;
  if row.nonce is null then return null; end if;
  return jsonb_build_object(
    'nonce', row.nonce,
    'token', row.token,
    'exp', row.exp,
    'generation', row.generation,
    'person_id', row.person_id,
    'project_id', row.project_id,
    'revision_id', row.revision_id,
    'revoked', false
  );
end $$;

create or replace function public.architect_apps_preview_revoke(p_revision uuid)
returns boolean
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  update public.architect_app_preview_sessions
    set revoked_at = now()
    where revision_id = p_revision and person_id = owner_id and revoked_at is null;
  return true;
end $$;

revoke all on function public.architect_apps_schema_probe() from public, anon, authenticated;
grant execute on function public.architect_apps_schema_probe() to service_role;
revoke all on function public.architect_apps_preview_issue(uuid,text,text,integer,boolean) from public, anon;
revoke all on function public.architect_apps_preview_read(text) from public, anon;
revoke all on function public.architect_apps_preview_current(uuid) from public, anon;
revoke all on function public.architect_apps_preview_revoke(uuid) from public, anon;
grant execute on function public.architect_apps_preview_issue(uuid,text,text,integer,boolean) to authenticated;
grant execute on function public.architect_apps_preview_read(text) to authenticated;
grant execute on function public.architect_apps_preview_current(uuid) to authenticated;
grant execute on function public.architect_apps_preview_revoke(uuid) to authenticated;
