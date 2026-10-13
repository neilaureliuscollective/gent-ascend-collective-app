-- Expired claims cannot heartbeat or finish merely because no replacement claimed them.
-- Token fencing stays; lease_until must still be in the future.

create or replace function public.architect_construct_heartbeat(p_worker text, p_run uuid, p_token uuid, p_lease integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs%rowtype;
begin
  if p_worker is null or length(p_worker)<3 or p_run is null then raise exception 'Invalid worker'; end if;
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
declare run public.architect_construct_runs%rowtype;
begin
  if p_worker is null or length(p_worker)<3 or p_run is null or p_status not in ('succeeded','failed','cancelled','blocked','timed_out') then raise exception 'Invalid finish'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found
    or run.worker_id is distinct from p_worker
    or run.lease_token is distinct from p_token
    or run.lease_until is null
    or run.lease_until<=now()
  then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  update public.architect_construct_runs set status=p_status, result=p_result, lease_until=null, updated_at=now() where id=p_run;
  return true;
end $$;

create or replace function public.architect_construct_mark_running(p_worker text, p_run uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs%rowtype;
begin
  if p_worker is null or length(p_worker)<3 or p_run is null then raise exception 'Invalid worker'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found
    or run.worker_id is distinct from p_worker
    or run.lease_token is distinct from p_token
    or run.lease_until is null
    or run.lease_until<=now()
  then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  update public.architect_construct_runs set status='running', updated_at=now() where id=p_run;
  return true;
end $$;

create or replace function public.architect_construct_append_event(p_worker text, p_run uuid, p_token uuid, p_kind text, p_detail text) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs%rowtype;
seq integer;
begin
  if p_worker is null or length(p_worker)<3 or p_run is null then raise exception 'Invalid worker'; end if;
  if p_token is null or p_kind is null or p_kind not in ('queued','claimed','lease_recovered','started','source_prepared','patch_applied','check_started','check_finished','preview_collected','blocked','cancelled','timed_out','finished') then raise exception 'Invalid event'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found
    or run.worker_id is distinct from p_worker
    or run.lease_token is distinct from p_token
    or run.lease_until is null
    or run.lease_until<=now()
  then return false; end if;
  select coalesce(max(e.seq),0)+1 into seq from public.architect_construct_events e where e.run_id=p_run;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail) values (p_run,run.person_id,seq,p_kind,left(coalesce(p_detail,''),2000));
  return true;
end $$;

revoke all on function public.architect_construct_finish(text,uuid,uuid,text,jsonb),public.architect_construct_heartbeat(text,uuid,uuid,integer),public.architect_construct_mark_running(text,uuid,uuid),public.architect_construct_append_event(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.architect_construct_finish(text,uuid,uuid,text,jsonb),public.architect_construct_heartbeat(text,uuid,uuid,integer),public.architect_construct_mark_running(text,uuid,uuid),public.architect_construct_append_event(text,uuid,uuid,text,text) to service_role;
