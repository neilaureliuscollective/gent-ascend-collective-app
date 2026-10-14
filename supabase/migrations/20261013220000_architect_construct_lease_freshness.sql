-- Expired claims cannot heartbeat or finish merely because no replacement claimed them.
-- Token fencing, worker authority, result validation, and finish-event writes stay.

create or replace function public.architect_construct_heartbeat(p_worker text, p_run uuid, p_token uuid, p_lease integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_lease is null or p_lease<5000 or p_token is null then raise exception 'Invalid lease'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found
    or run.worker_id is distinct from p_worker
    or run.lease_token is distinct from p_token
    or run.status not in ('claimed','running')
    or run.lease_until is null
    or run.lease_until<=now()
  then return false; end if;
  update public.architect_construct_runs set lease_until=now()+(p_lease::text || ' milliseconds')::interval, updated_at=now() where id=p_run;
  return true;
end $$;

create or replace function public.architect_construct_finish(p_worker text,p_run uuid,p_token uuid,p_status text,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_status is null or p_status not in ('succeeded','failed','cancelled','blocked','timed_out') then raise exception 'Invalid status'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  if p_result is not null and (jsonb_typeof(p_result)<>'object' or p_result ? 'release' or p_result->>'sandbox'='true' and p_result->>'isolation'<>'docker') then raise exception 'Invalid result'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker or run.lease_token is distinct from p_token then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  if run.lease_until is null or run.lease_until<=now() then return false; end if;
  update public.architect_construct_runs set status=p_status, result=p_result, lease_until=null, updated_at=now() where id=p_run;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_run,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=p_run),
      case when p_status='timed_out' then 'timed_out' when p_status='blocked' then 'blocked' else 'finished' end, p_status);
  return true;
end $$;

create or replace function public.architect_construct_mark_running(p_worker text, p_run uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker or run.lease_token is distinct from p_token then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  if run.lease_until is null or run.lease_until<=now() then return false; end if;
  update public.architect_construct_runs set status='running', updated_at=now() where id=p_run;
  return true;
end $$;

create or replace function public.architect_construct_append_event(p_worker text, p_run uuid, p_token uuid, p_kind text, p_detail text) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_token is null or p_kind is null or p_kind not in ('queued','claimed','lease_recovered','started','source_prepared','patch_applied','check_started','check_finished','preview_collected','blocked','cancelled','timed_out','finished') then raise exception 'Invalid event'; end if;
  if p_detail is null or length(p_detail)>2000 then raise exception 'Invalid event'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found
    or run.worker_id is distinct from p_worker
    or run.lease_token is distinct from p_token
    or run.lease_until is null
    or run.lease_until<=now()
  then return false; end if;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_run,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=p_run), p_kind, p_detail);
  return true;
end $$;

revoke all on function public.architect_construct_finish(text,uuid,uuid,text,jsonb),public.architect_construct_heartbeat(text,uuid,uuid,integer),public.architect_construct_mark_running(text,uuid,uuid),public.architect_construct_append_event(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.architect_construct_finish(text,uuid,uuid,text,jsonb),public.architect_construct_heartbeat(text,uuid,uuid,integer),public.architect_construct_mark_running(text,uuid,uuid),public.architect_construct_append_event(text,uuid,uuid,text,text) to service_role;
