-- Authoritative founder-pilot execution gate, started-generation settlement, and approved-model bind.
-- Unique forward file after 156500 and before Talk retain 160000/170000.
-- Local-only until founder-approved hosted application. Do not replay Talk's 18-name batch.

create table public.architect_apps_execution_policy (
  id boolean primary key default true check (id),
  founder_pilot boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.architect_apps_execution_policy (id, founder_pilot) values (true, false);
revoke all on table public.architect_apps_execution_policy from public, anon, authenticated;
grant select on table public.architect_apps_execution_policy to authenticated;
grant select, update on table public.architect_apps_execution_policy to service_role;
alter table public.architect_apps_execution_policy enable row level security;
create policy architect_apps_execution_policy_read on public.architect_apps_execution_policy
  for select to authenticated using (true);

create or replace function public.architect_apps_require_execution()
returns uuid
language plpgsql stable security definer set search_path='' as $$
declare
  owner_id uuid;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not exists (select 1 from public.founder_access where person_id = owner_id) then
    raise exception 'Model-backed application generation is a founder pilot and is not enabled for this account.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.architect_apps_execution_policy where founder_pilot) then
    raise exception 'Architect executable work stays off until the founder pilot is commissioned. Ownership of a project is not founder entitlement.' using errcode = '42501';
  end if;
  return owner_id;
end $$;

create or replace function public.architect_apps_set_execution_policy(p_enabled boolean)
returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.architect_apps_worker_ok() then
    raise exception 'Worker authorization required' using errcode = '42501';
  end if;
  update public.architect_apps_execution_policy
    set founder_pilot = coalesce(p_enabled, false), updated_at = now()
    where id;
  return coalesce(p_enabled, false);
end $$;

alter table public.architect_app_generation_runs
  drop constraint if exists architect_app_generation_runs_status_check;
alter table public.architect_app_generation_runs
  add constraint architect_app_generation_runs_status_check
  check (status in ('reserved','started','completed','failed','uncertain','cancelled'));
alter table public.architect_app_generation_runs
  add column if not exists model text not null default 'gpt-6-astra';
alter table public.architect_app_generation_runs
  drop constraint if exists architect_app_generation_runs_model_check;
alter table public.architect_app_generation_runs
  add constraint architect_app_generation_runs_model_check check (model = 'gpt-6-astra');
alter table public.architect_app_generation_runs
  add column if not exists started_at timestamptz;

create or replace function public.architect_apps_approve(
  p_request uuid,
  p_project uuid,
  p_name text,
  p_parent integer,
  p_tree text,
  p_hash text,
  p_files jsonb,
  p_collections jsonb,
  p_behaviors jsonb,
  p_generation jsonb
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  app public.architect_apps;
  existing public.architect_app_revisions;
  next_revision integer;
begin
  owner_id := public.architect_apps_require_execution();
  if p_request is null or p_project is null or p_hash is null or p_tree is null then raise exception 'Invalid approval'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 100 then raise exception 'Invalid approval'; end if;
  if p_tree !~ '^[0-9a-f]{64}$' or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid approval'; end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) < 1 or jsonb_array_length(p_files) > 48 then raise exception 'Invalid approval'; end if;
  if not exists(select 1 from public.architect_origin_projects where id = p_project and person_id = owner_id) then
    raise exception 'Project unavailable';
  end if;
  select * into existing from public.architect_app_revisions where id = p_request;
  if found then
    if existing.person_id <> owner_id or existing.approval_hash <> p_hash or existing.project_id <> p_project then
      raise exception 'Request already reserved with a different approved application';
    end if;
    return existing.id;
  end if;
  select * into app from public.architect_apps where person_id = owner_id and project_id = p_project for update;
  if not found then
    insert into public.architect_apps(id, person_id, project_id, name, current_revision, last_working_revision)
      values(p_project, owner_id, p_project, trim(p_name), 0, null)
      returning * into app;
  end if;
  if p_parent is not null and p_parent <> app.current_revision then
    raise exception 'Stale parent revision. Reload before approving this change.';
  end if;
  next_revision := app.current_revision + 1;
  insert into public.architect_app_revisions(
    id, app_id, person_id, project_id, revision, parent_revision, tree_hash, approval_hash,
    profile, profile_version, toolchain, files, collections, behaviors, generation, status, working
  ) values (
    p_request, app.id, owner_id, p_project, next_revision, p_parent, p_tree, p_hash,
    'react-ts-vite', '2026-10-14.1', 'vite-8.3.0+react-19.3.0+typescript-6.0.3',
    p_files, p_collections, p_behaviors, p_generation, 'approved', false
  );
  update public.architect_apps
    set current_revision = next_revision, name = trim(p_name), updated_at = now()
    where id = app.id;
  return p_request;
end $$;

create or replace function public.architect_apps_start(
  p_request uuid,
  p_project uuid,
  p_revision uuid,
  p_hash text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  app public.architect_apps;
  revision public.architect_app_revisions;
  existing public.architect_app_jobs;
begin
  owner_id := public.architect_apps_require_execution();
  select * into existing from public.architect_app_jobs where id = p_request;
  if found then
    if existing.person_id <> owner_id or existing.revision_id <> p_revision or existing.approval_hash <> p_hash then
      raise exception 'Request already reserved with a different approved revision';
    end if;
    return existing.id;
  end if;
  select * into app from public.architect_apps where person_id = owner_id and project_id = p_project;
  if not found then raise exception 'Application unavailable'; end if;
  select * into revision from public.architect_app_revisions where id = p_revision and person_id = owner_id;
  if not found or revision.project_id <> p_project then raise exception 'Approved application revision unavailable'; end if;
  if revision.approval_hash <> p_hash then raise exception 'Start no longer matches the reviewed approval'; end if;
  if revision.status not in ('approved', 'failed', 'building') then raise exception 'This revision is not waiting for an explicit start'; end if;
  insert into public.architect_app_jobs(id, person_id, project_id, app_id, revision_id, approval_hash, status)
    values(p_request, owner_id, p_project, app.id, p_revision, p_hash, 'queued');
  insert into public.architect_app_events(job_id, person_id, kind, detail)
    values(p_request, owner_id, 'queued', 'Build queued. The request handler does not compile generated applications.');
  return p_request;
end $$;

drop function if exists public.architect_apps_reserve_generation(uuid,uuid,integer,integer);

create or replace function public.architect_apps_reserve_generation(
  p_request uuid,
  p_run uuid,
  p_input integer,
  p_output integer,
  p_model text default 'gpt-6-astra'
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_app_generation_runs;
  counted integer;
  spent_micros integer;
  micros integer;
begin
  owner_id := public.architect_apps_require_execution();
  if p_request is null or p_run is null then raise exception 'Invalid generation reservation'; end if;
  if p_model is null or p_model <> 'gpt-6-astra' then
    raise exception 'Architect Apps paid generation is bound to gpt-6-astra. Unsupported model overrides are refused.';
  end if;
  if p_input is null or p_input < 1 or p_input > 16000 then
    raise exception 'Generation input exceeds the 16000-token acceptance ceiling.';
  end if;
  if p_output is null or p_output < 1 or p_output > 4000 then
    raise exception 'Generation output exceeds the 4000-token acceptance ceiling.';
  end if;
  select * into existing from public.architect_app_generation_runs where request_id = p_request for update;
  if existing.request_id is not null then
    if existing.person_id <> owner_id or existing.run_id <> p_run then
      raise exception 'Generation reservation no longer matches this request.';
    end if;
    return to_jsonb(existing) || jsonb_build_object('created', false);
  end if;
  micros := (p_input * 10) + (p_output * 50);
  select count(*), coalesce(sum(coalesce(used_micros, reserved_micros)), 0)
    into counted, spent_micros
    from public.architect_app_generation_runs
    where person_id = owner_id and run_id = p_run and status <> 'cancelled';
  if counted >= 2 then
    raise exception 'The founder-pilot acceptance run already reserved its two model calls.';
  end if;
  if spent_micros + micros > 1000000 then
    raise exception 'The founder-pilot acceptance run would exceed its $1.00 reserved budget.';
  end if;
  insert into public.architect_app_generation_runs (
    request_id, run_id, person_id, status, reserved_input, reserved_output, reserved_micros, model
  ) values (p_request, p_run, owner_id, 'reserved', p_input, p_output, micros, p_model)
  returning * into existing;
  return to_jsonb(existing) || jsonb_build_object('created', true);
end $$;

create or replace function public.architect_apps_begin_generation(p_request uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_app_generation_runs;
begin
  owner_id := public.architect_apps_require_execution();
  select * into existing from public.architect_app_generation_runs
    where request_id = p_request and person_id = owner_id for update;
  if existing.request_id is null then raise exception 'Generation reservation is unavailable.'; end if;
  if existing.status in ('started','uncertain','completed','failed') then return to_jsonb(existing); end if;
  if existing.status <> 'reserved' then
    raise exception 'This generation request cannot start a model call.';
  end if;
  update public.architect_app_generation_runs
    set status = 'started', started_at = now(), updated_at = now()
    where request_id = p_request
    returning * into existing;
  return to_jsonb(existing);
end $$;

create or replace function public.architect_apps_finish_generation(
  p_request uuid,
  p_status text,
  p_input integer default null,
  p_output integer default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_app_generation_runs;
  next_input integer;
  next_output integer;
  next_micros integer;
begin
  owner_id := public.architect_apps_require_execution();
  if p_status is null or p_status not in ('completed','failed','uncertain','cancelled') then
    raise exception 'Invalid generation receipt';
  end if;
  select * into existing from public.architect_app_generation_runs
    where request_id = p_request and person_id = owner_id for update;
  if existing.request_id is null then raise exception 'Generation reservation is unavailable.'; end if;
  if existing.status not in ('reserved','started','uncertain') then return to_jsonb(existing); end if;
  if p_status = 'cancelled' then
    if existing.status <> 'reserved' then
      raise exception 'In-flight or uncertain generation cannot be cancelled to zero.';
    end if;
    next_input := 0;
    next_output := 0;
    next_micros := 0;
  else
    next_input := greatest(coalesce(nullif(p_input, 0), existing.reserved_input), existing.reserved_input);
    next_output := greatest(coalesce(nullif(p_output, 0), existing.reserved_output), existing.reserved_output);
    if p_status = 'uncertain' then
      next_input := existing.reserved_input;
      next_output := existing.reserved_output;
    end if;
    next_micros := (next_input * 10) + (next_output * 50);
  end if;
  update public.architect_app_generation_runs
    set status = p_status,
        used_input = next_input,
        used_output = next_output,
        used_micros = next_micros,
        updated_at = now()
    where request_id = p_request
    returning * into existing;
  return to_jsonb(existing);
end $$;

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
  if to_regclass('public.architect_app_generation_runs') is null then missing := array_append(missing, 'architect_app_generation_runs'); end if;
  if to_regclass('public.architect_app_worker_presence') is null then missing := array_append(missing, 'architect_app_worker_presence'); end if;
  if to_regclass('public.architect_apps_execution_policy') is null then missing := array_append(missing, 'architect_apps_execution_policy'); end if;
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
  if to_regproc('public.architect_apps_approve') is null then missing := array_append(missing, 'architect_apps_approve'); end if;
  if to_regproc('public.architect_apps_start') is null then missing := array_append(missing, 'architect_apps_start'); end if;
  if to_regproc('public.architect_apps_claim') is null then missing := array_append(missing, 'architect_apps_claim'); end if;
  if to_regproc('public.architect_apps_heartbeat') is null then missing := array_append(missing, 'architect_apps_heartbeat'); end if;
  if to_regproc('public.architect_apps_finish') is null then missing := array_append(missing, 'architect_apps_finish'); end if;
  if to_regproc('public.architect_apps_write_record') is null then missing := array_append(missing, 'architect_apps_write_record'); end if;
  if to_regproc('public.architect_apps_timeout') is null then missing := array_append(missing, 'architect_apps_timeout'); end if;
  if to_regproc('public.architect_apps_preview_issue') is null then missing := array_append(missing, 'architect_apps_preview_issue'); end if;
  if to_regproc('public.architect_apps_preview_read') is null then missing := array_append(missing, 'architect_apps_preview_read'); end if;
  if to_regproc('public.architect_apps_preview_revoke') is null then missing := array_append(missing, 'architect_apps_preview_revoke'); end if;
  if to_regproc('public.architect_apps_reserve_generation') is null then missing := array_append(missing, 'architect_apps_reserve_generation'); end if;
  if to_regproc('public.architect_apps_begin_generation') is null then missing := array_append(missing, 'architect_apps_begin_generation'); end if;
  if to_regproc('public.architect_apps_finish_generation') is null then missing := array_append(missing, 'architect_apps_finish_generation'); end if;
  if to_regproc('public.architect_apps_report_worker_presence') is null then missing := array_append(missing, 'architect_apps_report_worker_presence'); end if;
  if to_regproc('public.architect_apps_worker_readiness') is null then missing := array_append(missing, 'architect_apps_worker_readiness'); end if;
  if to_regproc('public.architect_apps_set_execution_policy') is null then missing := array_append(missing, 'architect_apps_set_execution_policy'); end if;
  if to_regproc('public.architect_apps_require_execution') is null then missing := array_append(missing, 'architect_apps_require_execution'); end if;
  return jsonb_build_object(
    'ok', coalesce(array_length(missing, 1), 0) = 0,
    'missing', to_jsonb(missing),
    'contracts', jsonb_build_object(
      'architect_app_artifacts', 'revision_id',
      'architect_app_preview_sessions', 'nonce',
      'architect_app_generation_runs', 'request_id',
      'architect_app_worker_presence', 'worker_id',
      'architect_apps_execution_policy', 'founder_pilot'
    )
  );
end $$;

revoke all on function public.architect_apps_require_execution() from public, anon;
revoke all on function public.architect_apps_set_execution_policy(boolean) from public, anon, authenticated;
revoke all on function public.architect_apps_reserve_generation(uuid,uuid,integer,integer,text) from public, anon;
revoke all on function public.architect_apps_begin_generation(uuid) from public, anon;
revoke all on function public.architect_apps_finish_generation(uuid,text,integer,integer) from public, anon;
revoke all on function public.architect_apps_schema_probe() from public, anon, authenticated;
grant execute on function public.architect_apps_require_execution() to authenticated;
grant execute on function public.architect_apps_set_execution_policy(boolean) to service_role;
grant execute on function public.architect_apps_reserve_generation(uuid,uuid,integer,integer,text) to authenticated;
grant execute on function public.architect_apps_begin_generation(uuid) to authenticated;
grant execute on function public.architect_apps_finish_generation(uuid,text,integer,integer) to authenticated;
grant execute on function public.architect_apps_schema_probe() to service_role;
