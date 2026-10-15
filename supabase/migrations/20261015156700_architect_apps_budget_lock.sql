-- Transaction-safe founder-pilot budget admission.
-- Unique forward file after 156600 and before Talk retain 160000/170000.
-- Locks the shared person+run allowance so concurrent distinct request IDs cannot both pass the two-call/$1.00 check.
-- Local-only until founder-approved hosted application. Do not replay Talk's 18-name batch.

create table public.architect_app_generation_budgets (
  person_id uuid not null references public.persons(id),
  run_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (person_id, run_id)
);
revoke all on table public.architect_app_generation_budgets from public, anon, authenticated;
grant select, insert, update on table public.architect_app_generation_budgets to service_role;

create or replace function public.architect_apps_lock_generation_budget(p_run uuid)
returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
begin
  owner_id := public.architect_apps_require_execution();
  if p_run is null then raise exception 'Invalid generation reservation'; end if;
  insert into public.architect_app_generation_budgets (person_id, run_id)
    values (owner_id, p_run)
    on conflict (person_id, run_id) do nothing;
  perform 1 from public.architect_app_generation_budgets
    where person_id = owner_id and run_id = p_run
    for update;
  return owner_id;
end $$;

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
  owner_id := public.architect_apps_lock_generation_budget(p_run);
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
    raise exception 'The founder-pilot acceptance run would exceed its $1.00 reserved allowance.';
  end if;
  insert into public.architect_app_generation_runs (
    request_id, run_id, person_id, status, reserved_input, reserved_output, reserved_micros, model
  ) values (p_request, p_run, owner_id, 'reserved', p_input, p_output, micros, p_model)
  returning * into existing;
  return to_jsonb(existing) || jsonb_build_object('created', true);
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
  if to_regclass('public.architect_app_generation_budgets') is null then missing := array_append(missing, 'architect_app_generation_budgets'); end if;
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
  if to_regproc('public.architect_apps_lock_generation_budget') is null then missing := array_append(missing, 'architect_apps_lock_generation_budget'); end if;
  return jsonb_build_object(
    'ok', coalesce(array_length(missing, 1), 0) = 0,
    'missing', to_jsonb(missing),
    'contracts', jsonb_build_object(
      'architect_app_artifacts', 'revision_id',
      'architect_app_preview_sessions', 'nonce',
      'architect_app_generation_runs', 'request_id',
      'architect_app_worker_presence', 'worker_id',
      'architect_apps_execution_policy', 'founder_pilot',
      'architect_app_generation_budgets', 'run_id'
    )
  );
end $$;

revoke all on function public.architect_apps_lock_generation_budget(uuid) from public, anon;
revoke all on function public.architect_apps_reserve_generation(uuid,uuid,integer,integer,text) from public, anon;
revoke all on function public.architect_apps_schema_probe() from public, anon, authenticated;
grant execute on function public.architect_apps_lock_generation_budget(uuid) to authenticated;
grant execute on function public.architect_apps_reserve_generation(uuid,uuid,integer,integer,text) to authenticated;
grant execute on function public.architect_apps_schema_probe() to service_role;
