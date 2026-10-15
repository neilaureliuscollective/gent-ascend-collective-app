-- Additive Apps write/claim/finish operations and correct person/auth mapping.
-- Does not rewrite hosted applied hashes. Hosted application still requires founder approval.
-- person_id is persons.id; authenticated identity is persons.auth_user_id = auth.uid().

alter table public.architect_design_directions
  add column if not exists source_kind text not null default 'text-import';
alter table public.architect_design_directions
  add column if not exists verified boolean not null default false;
alter table public.architect_design_directions
  drop constraint if exists architect_design_directions_source_kind_check;
alter table public.architect_design_directions
  add constraint architect_design_directions_source_kind_check
  check (source_kind in ('text-import','talk-authorized','pending'));

drop policy if exists architect_apps_owner on public.architect_apps;
drop policy if exists architect_app_revisions_owner on public.architect_app_revisions;
drop policy if exists architect_app_artifacts_owner on public.architect_app_artifacts;
drop policy if exists architect_app_jobs_owner on public.architect_app_jobs;
drop policy if exists architect_app_events_owner on public.architect_app_events;
drop policy if exists architect_app_records_owner on public.architect_app_records;
drop policy if exists architect_design_directions_owner on public.architect_design_directions;

create policy architect_apps_owner on public.architect_apps for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
create policy architect_app_revisions_owner on public.architect_app_revisions for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
create policy architect_app_artifacts_owner on public.architect_app_artifacts for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
create policy architect_app_jobs_owner on public.architect_app_jobs for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
create policy architect_app_events_owner on public.architect_app_events for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
create policy architect_app_records_owner on public.architect_app_records for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
create policy architect_design_directions_owner on public.architect_design_directions for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));

create or replace function public.architect_apps_owner_id() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  return owner_id;
end $$;

create or replace function public.architect_apps_worker_ok() returns boolean
language sql stable set search_path='' as $$
  select current_setting('architect.construct_worker', true) = '1'
    or coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      current_user
    ) = 'service_role';
$$;

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
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
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
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
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

create or replace function public.architect_apps_cancel(p_project uuid, p_job uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  job public.architect_app_jobs;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  select * into job from public.architect_app_jobs where id = p_job for update;
  if not found or job.person_id <> owner_id or job.project_id <> p_project then raise exception 'Build unavailable'; end if;
  update public.architect_app_jobs set cancel_requested = true, updated_at = now() where id = p_job;
  if job.status = 'queued' then
    update public.architect_app_jobs set status = 'cancelled', updated_at = now() where id = p_job;
    insert into public.architect_app_events(job_id, person_id, kind, detail)
      values(p_job, owner_id, 'cancelled', 'Owner cancelled the build before execution started.');
  end if;
  return true;
end $$;

create or replace function public.architect_apps_write_record(
  p_project uuid,
  p_app uuid,
  p_collection text,
  p_payload jsonb,
  p_key text,
  p_id uuid
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_app_records;
  replay public.architect_app_records;
  n integer;
  saved uuid;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_collection is null or length(trim(p_collection)) not between 1 and 40 then raise exception 'Invalid record'; end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8000 then raise exception 'Invalid record'; end if;
  if not exists(select 1 from public.architect_apps where id = p_app and person_id = owner_id and project_id = p_project) then
    raise exception 'Application unavailable';
  end if;
  if p_key is not null then
    select * into replay from public.architect_app_records
      where app_id = p_app and collection = p_collection and idempotency_key = p_key;
    if found then
      if replay.person_id <> owner_id then raise exception 'Record unavailable'; end if;
      return replay.id;
    end if;
  end if;
  if p_id is not null then
    select * into existing from public.architect_app_records where id = p_id for update;
    if found then
      if existing.person_id <> owner_id or existing.app_id <> p_app or existing.collection <> p_collection then
        raise exception 'Record unavailable';
      end if;
      update public.architect_app_records
        set payload = p_payload, updated_at = now(),
            idempotency_key = coalesce(p_key, existing.idempotency_key)
        where id = p_id;
      return p_id;
    end if;
  end if;
  select count(*)::int into n from public.architect_app_records where person_id = owner_id and app_id = p_app and collection = p_collection;
  if n >= 200 then raise exception 'Collection quota exceeded'; end if;
  insert into public.architect_app_records(id, person_id, project_id, app_id, collection, payload, idempotency_key)
    values(coalesce(p_id, gen_random_uuid()), owner_id, p_project, p_app, p_collection, p_payload, p_key)
    returning id into saved;
  return saved;
end $$;

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
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid design receipt'; end if;
  if p_source_kind is null or p_source_kind not in ('text-import','talk-authorized','pending') then raise exception 'Invalid design receipt'; end if;
  if not exists(select 1 from public.architect_origin_projects where id = p_project and person_id = owner_id) then
    raise exception 'Project unavailable';
  end if;
  select * into existing from public.architect_design_directions where request_id = p_request;
  if found then
    if existing.person_id <> owner_id or existing.project_id <> p_project or existing.digest <> p_digest then
      raise exception 'Request already reserved with a different project or design receipt';
    end if;
    return existing.request_id;
  end if;
  insert into public.architect_design_directions(request_id, person_id, project_id, revision, digest, receipt, started, source_kind, verified)
    values(p_request, owner_id, p_project, 1, p_digest, p_receipt, false, p_source_kind, coalesce(p_verified, false));
  return p_request;
end $$;

create or replace function public.architect_apps_claim(p_worker text, p_lease integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  job public.architect_app_jobs;
  token uuid;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_worker is null or length(p_worker) not between 1 and 80 or p_lease is null or p_lease < 5000 then raise exception 'Invalid worker'; end if;
  select * into job from public.architect_app_jobs
    where status = 'queued' or (status = 'running' and lease_until is not null and lease_until < now() and cancel_requested = false)
    order by created_at for update limit 1;
  if not found then return null; end if;
  token := gen_random_uuid();
  update public.architect_app_jobs
    set status = 'queued', worker_id = p_worker, lease_token = token,
        lease_until = now() + (p_lease::text || ' milliseconds')::interval, updated_at = now()
    where id = job.id;
  return job.id;
end $$;

create or replace function public.architect_apps_mark_running(p_worker text, p_job uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.architect_app_jobs;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  select * into job from public.architect_app_jobs where id = p_job for update;
  if not found or job.worker_id is distinct from p_worker or job.lease_token is distinct from p_token then return false; end if;
  if job.status in ('succeeded','failed','cancelled') then return true; end if;
  if job.lease_until is null or job.lease_until <= now() then return false; end if;
  update public.architect_app_jobs set status = 'running', updated_at = now() where id = p_job;
  return true;
end $$;

create or replace function public.architect_apps_heartbeat(p_worker text, p_job uuid, p_token uuid, p_lease integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.architect_app_jobs;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_lease is null or p_lease < 5000 or p_token is null then raise exception 'Invalid lease'; end if;
  select * into job from public.architect_app_jobs where id = p_job for update;
  if not found
    or job.worker_id is distinct from p_worker
    or job.lease_token is distinct from p_token
    or job.status not in ('queued','running')
    or job.lease_until is null
    or job.lease_until <= now()
  then return false; end if;
  update public.architect_app_jobs
    set lease_until = now() + (p_lease::text || ' milliseconds')::interval, updated_at = now()
    where id = p_job;
  return true;
end $$;

create or replace function public.architect_apps_append_event(p_worker text, p_job uuid, p_token uuid, p_kind text, p_detail text) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.architect_app_jobs;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_token is null or p_kind is null or p_kind not in ('queued','started','typecheck','bundle','preview','failed','cancelled') then raise exception 'Invalid event'; end if;
  if p_detail is null or length(p_detail) > 2000 then raise exception 'Invalid event'; end if;
  select * into job from public.architect_app_jobs where id = p_job for update;
  if not found
    or job.worker_id is distinct from p_worker
    or job.lease_token is distinct from p_token
    or job.lease_until is null
    or job.lease_until <= now()
  then return false; end if;
  insert into public.architect_app_events(job_id, person_id, kind, detail)
    values(p_job, job.person_id, p_kind, p_detail);
  return true;
end $$;

create or replace function public.architect_apps_save_artifact(p_worker text, p_job uuid, p_token uuid, p_revision uuid, p_manifest text, p_files jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.architect_app_jobs;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_token is null or p_manifest is null or p_manifest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid artifact'; end if;
  if jsonb_typeof(p_files) <> 'array' then raise exception 'Invalid artifact'; end if;
  select * into job from public.architect_app_jobs where id = p_job for update;
  if not found
    or job.worker_id is distinct from p_worker
    or job.lease_token is distinct from p_token
    or job.revision_id <> p_revision
    or job.lease_until is null
    or job.lease_until <= now()
  then return false; end if;
  insert into public.architect_app_artifacts(revision_id, person_id, project_id, manifest_hash, files)
    values(p_revision, job.person_id, job.project_id, p_manifest, p_files)
    on conflict (revision_id) do update set manifest_hash = excluded.manifest_hash, files = excluded.files;
  return true;
end $$;

create or replace function public.architect_apps_mark_revision(p_worker text, p_job uuid, p_token uuid, p_revision uuid, p_status text, p_working boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.architect_app_jobs;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_status is null or p_status not in ('approved','building','ready','failed','superseded') then raise exception 'Invalid revision'; end if;
  select * into job from public.architect_app_jobs where id = p_job for update;
  if not found or job.worker_id is distinct from p_worker or job.lease_token is distinct from p_token then return false; end if;
  update public.architect_app_revisions set status = p_status, working = (working or coalesce(p_working, false))
    where id = p_revision and person_id = job.person_id;
  if coalesce(p_working, false) then
    update public.architect_apps
      set last_working_revision = (select revision from public.architect_app_revisions where id = p_revision),
          updated_at = now()
      where id = job.app_id;
  end if;
  return true;
end $$;

create or replace function public.architect_apps_finish(p_worker text, p_job uuid, p_token uuid, p_status text, p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.architect_app_jobs;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_status is null or p_status not in ('succeeded','failed','cancelled') then raise exception 'Invalid status'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  if p_result is not null and (
    jsonb_typeof(p_result) <> 'object'
    or p_result ? 'release'
    or (p_result->>'sandbox' = 'true' and p_result->>'isolation' <> 'docker')
  ) then raise exception 'Invalid result'; end if;
  select * into job from public.architect_app_jobs where id = p_job for update;
  if not found or job.worker_id is distinct from p_worker or job.lease_token is distinct from p_token then return false; end if;
  if job.status in ('succeeded','failed','cancelled') then return true; end if;
  if job.lease_until is null or job.lease_until <= now() then return false; end if;
  update public.architect_app_jobs
    set status = p_status, result = p_result, lease_token = null, lease_until = null, updated_at = now()
    where id = p_job;
  return true;
end $$;

create or replace function public.architect_apps_timeout() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if not public.architect_apps_worker_ok() then raise exception 'Worker authority required'; end if;
  with expired as (
    select id from public.architect_app_jobs
      where status = 'running' and lease_until is not null and lease_until < now()
      for update
  )
  update public.architect_app_jobs j
    set status = 'failed', lease_token = null, lease_until = null, updated_at = now(),
        result = coalesce(j.result, jsonb_build_object(
          'ok', false,
          'isolation', 'unavailable',
          'sandbox', false,
          'typecheck', jsonb_build_object('ok', false, 'log', ''),
          'bundle', jsonb_build_object('ok', false, 'log', ''),
          'blocker', 'Worker lost the lease before a durable result was recorded.',
          'stages', '[]'::jsonb
        ))
    from expired where j.id = expired.id;
  get diagnostics n = row_count;
  return coalesce(n, 0);
end $$;

revoke all on function public.architect_apps_owner_id() from public, anon;
revoke all on function public.architect_apps_approve(uuid,uuid,text,integer,text,text,jsonb,jsonb,jsonb,jsonb) from public, anon;
revoke all on function public.architect_apps_start(uuid,uuid,uuid,text) from public, anon;
revoke all on function public.architect_apps_cancel(uuid,uuid) from public, anon;
revoke all on function public.architect_apps_write_record(uuid,uuid,text,jsonb,text,uuid) from public, anon;
revoke all on function public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean) from public, anon;
revoke all on function public.architect_apps_worker_ok(), public.architect_apps_claim(text,integer), public.architect_apps_mark_running(text,uuid,uuid), public.architect_apps_heartbeat(text,uuid,uuid,integer), public.architect_apps_append_event(text,uuid,uuid,text,text), public.architect_apps_save_artifact(text,uuid,uuid,uuid,text,jsonb), public.architect_apps_mark_revision(text,uuid,uuid,uuid,text,boolean), public.architect_apps_finish(text,uuid,uuid,text,jsonb), public.architect_apps_timeout() from public, anon, authenticated;

grant execute on function public.architect_apps_owner_id() to authenticated;
grant execute on function public.architect_apps_approve(uuid,uuid,text,integer,text,text,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.architect_apps_start(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.architect_apps_cancel(uuid,uuid) to authenticated;
grant execute on function public.architect_apps_write_record(uuid,uuid,text,jsonb,text,uuid) to authenticated;
grant execute on function public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean) to authenticated;
grant execute on function public.architect_apps_claim(text,integer), public.architect_apps_mark_running(text,uuid,uuid), public.architect_apps_heartbeat(text,uuid,uuid,integer), public.architect_apps_append_event(text,uuid,uuid,text,text), public.architect_apps_save_artifact(text,uuid,uuid,uuid,text,jsonb), public.architect_apps_mark_revision(text,uuid,uuid,uuid,text,boolean), public.architect_apps_finish(text,uuid,uuid,text,jsonb), public.architect_apps_timeout(), public.architect_apps_worker_ok() to service_role;
