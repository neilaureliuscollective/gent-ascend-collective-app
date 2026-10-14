-- Insert the terminal event before lease_until is cleared. Lease freshness,
-- worker authority, token fencing, and result validation stay.

create or replace function public.architect_construct_finish(p_worker text,p_run uuid,p_token uuid,p_status text,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
kind text;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_status is null or p_status not in ('succeeded','failed','cancelled','blocked','timed_out') then raise exception 'Invalid status'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  if p_result is not null and (jsonb_typeof(p_result)<>'object' or p_result ? 'release' or p_result->>'sandbox'='true' and p_result->>'isolation'<>'docker') then raise exception 'Invalid result'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker or run.lease_token is distinct from p_token then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  if run.lease_until is null or run.lease_until<=now() then return false; end if;
  kind := case
    when p_status='timed_out' then 'timed_out'
    when p_status='blocked' then 'blocked'
    when p_status='cancelled' then 'cancelled'
    else 'finished'
  end;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_run,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=p_run), kind, left(coalesce(p_status,''),2000));
  update public.architect_construct_runs set status=p_status, result=p_result, lease_until=null, updated_at=now() where id=p_run;
  return true;
end $$;

revoke all on function public.architect_construct_finish(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.architect_construct_finish(text,uuid,uuid,text,jsonb) to service_role;
