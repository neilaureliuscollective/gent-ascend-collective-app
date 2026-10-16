-- Additive founder-pilot budget reservations and worker presence.
-- Unique forward file after preview sessions and before Talk retain 160000/170000.
-- Local-only until founder-approved hosted application. Do not replay Talk's 18-name batch.

create table public.architect_app_generation_runs (
  request_id uuid primary key,
  run_id uuid not null,
  person_id uuid not null references public.persons(id),
  status text not null check (status in ('reserved','completed','failed','uncertain','cancelled')),
  reserved_input integer not null check (reserved_input between 1 and 16000),
  reserved_output integer not null check (reserved_output between 1 and 4000),
  reserved_micros integer not null check (reserved_micros > 0),
  used_input integer,
  used_output integer,
  used_micros integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index architect_app_generation_runs_owner
  on public.architect_app_generation_runs (person_id, run_id, created_at);

alter table public.architect_app_generation_runs enable row level security;
create policy architect_app_generation_runs_owner on public.architect_app_generation_runs
  for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
-- Remove production default grants (including TRUNCATE, which bypasses RLS).
revoke all on table public.architect_app_generation_runs from public, anon, authenticated;
grant select on table public.architect_app_generation_runs to authenticated;

create table public.architect_app_worker_presence (
  worker_id text primary key check (length(worker_id) between 1 and 80),
  digest text not null check (digest ~ '^sha256:[a-f0-9]{64}$'),
  isolation text not null check (isolation in ('docker','unavailable')),
  schema_ok boolean not null,
  queue_ok boolean not null,
  artifacts_ok boolean not null,
  state text not null check (state in ('idle','working','unavailable','misconfigured')),
  seen_at timestamptz not null default now()
);
revoke all on table public.architect_app_worker_presence from public, anon, authenticated;
grant select, insert, update on table public.architect_app_worker_presence to service_role;

create or replace function public.architect_apps_reserve_generation(
  p_request uuid,
  p_run uuid,
  p_input integer,
  p_output integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_app_generation_runs;
  counted integer;
  spent_micros integer;
  micros integer;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not exists (select 1 from public.founder_access where person_id = owner_id) then
    raise exception 'Model-backed application generation is a founder pilot and is not enabled for this account.' using errcode = '42501';
  end if;
  if p_request is null or p_run is null then raise exception 'Invalid generation reservation'; end if;
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
    request_id, run_id, person_id, status, reserved_input, reserved_output, reserved_micros
  ) values (p_request, p_run, owner_id, 'reserved', p_input, p_output, micros)
  returning * into existing;
  return to_jsonb(existing) || jsonb_build_object('created', true);
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
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('completed','failed','uncertain','cancelled') then
    raise exception 'Invalid generation receipt';
  end if;
  select * into existing from public.architect_app_generation_runs
    where request_id = p_request and person_id = owner_id for update;
  if existing.request_id is null then raise exception 'Generation reservation is unavailable.'; end if;
  if existing.status not in ('reserved','uncertain') then return to_jsonb(existing); end if;
  if p_status = 'cancelled' then
    next_input := 0;
    next_output := 0;
    next_micros := 0;
  else
    next_input := greatest(coalesce(p_input, existing.reserved_input), case when p_status = 'uncertain' then existing.reserved_input else 0 end);
    next_output := greatest(coalesce(p_output, existing.reserved_output), case when p_status = 'uncertain' then existing.reserved_output else 0 end);
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

create or replace function public.architect_apps_report_worker_presence(
  p_worker text,
  p_digest text,
  p_isolation text,
  p_schema boolean,
  p_queue boolean,
  p_artifacts boolean,
  p_state text
) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.architect_apps_worker_ok() then
    raise exception 'Worker authorization required' using errcode = '42501';
  end if;
  if p_worker is null or length(p_worker) not between 1 and 80 then raise exception 'Invalid worker presence'; end if;
  if p_digest is null or p_digest !~ '^sha256:[a-f0-9]{64}$' then raise exception 'Invalid worker presence'; end if;
  if p_isolation is null or p_isolation not in ('docker','unavailable') then raise exception 'Invalid worker presence'; end if;
  if p_state is null or p_state not in ('idle','working','unavailable','misconfigured') then raise exception 'Invalid worker presence'; end if;
  insert into public.architect_app_worker_presence (
    worker_id, digest, isolation, schema_ok, queue_ok, artifacts_ok, state, seen_at
  ) values (p_worker, p_digest, p_isolation, coalesce(p_schema,false), coalesce(p_queue,false), coalesce(p_artifacts,false), p_state, now())
  on conflict (worker_id) do update set
    digest = excluded.digest,
    isolation = excluded.isolation,
    schema_ok = excluded.schema_ok,
    queue_ok = excluded.queue_ok,
    artifacts_ok = excluded.artifacts_ok,
    state = excluded.state,
    seen_at = now();
  return true;
end $$;

create or replace function public.architect_apps_worker_readiness(p_max_age integer default 90)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  owner_id uuid;
  row public.architect_app_worker_presence;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into row from public.architect_app_worker_presence
    order by seen_at desc limit 1;
  if row.worker_id is null then
    return jsonb_build_object('ok', false, 'missing', jsonb_build_array('worker'), 'age_ms', null);
  end if;
  return jsonb_build_object(
    'ok', row.isolation = 'docker' and row.schema_ok and row.queue_ok and row.artifacts_ok
      and row.state in ('idle','working')
      and row.seen_at >= now() - make_interval(secs => greatest(coalesce(p_max_age, 90), 1)),
    'digest', row.digest,
    'isolation', row.isolation,
    'schema_ok', row.schema_ok,
    'queue_ok', row.queue_ok,
    'artifacts_ok', row.artifacts_ok,
    'state', row.state,
    'age_ms', (extract(epoch from (now() - row.seen_at)) * 1000)::integer
  );
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
  if to_regproc('public.architect_apps_finish_generation') is null then missing := array_append(missing, 'architect_apps_finish_generation'); end if;
  if to_regproc('public.architect_apps_report_worker_presence') is null then missing := array_append(missing, 'architect_apps_report_worker_presence'); end if;
  if to_regproc('public.architect_apps_worker_readiness') is null then missing := array_append(missing, 'architect_apps_worker_readiness'); end if;
  return jsonb_build_object(
    'ok', coalesce(array_length(missing, 1), 0) = 0,
    'missing', to_jsonb(missing),
    'contracts', jsonb_build_object(
      'architect_app_artifacts', 'revision_id',
      'architect_app_preview_sessions', 'nonce',
      'architect_app_generation_runs', 'request_id',
      'architect_app_worker_presence', 'worker_id'
    )
  );
end $$;

revoke all on function public.architect_apps_reserve_generation(uuid,uuid,integer,integer) from public, anon;
revoke all on function public.architect_apps_finish_generation(uuid,text,integer,integer) from public, anon;
revoke all on function public.architect_apps_report_worker_presence(text,text,text,boolean,boolean,boolean,text) from public, anon, authenticated;
revoke all on function public.architect_apps_worker_readiness(integer) from public, anon;
grant execute on function public.architect_apps_reserve_generation(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.architect_apps_finish_generation(uuid,text,integer,integer) to authenticated;
grant execute on function public.architect_apps_worker_readiness(integer) to authenticated;
grant execute on function public.architect_apps_report_worker_presence(text,text,text,boolean,boolean,boolean,text) to service_role;
revoke all on function public.architect_apps_schema_probe() from public, anon, authenticated;
grant execute on function public.architect_apps_schema_probe() to service_role;
