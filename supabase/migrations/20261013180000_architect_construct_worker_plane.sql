-- Additive worker control-plane RPCs. Does not rewrite hosted applied hashes.
-- Service-role or the local worker GUC may claim/finish; authenticated users cannot.
create function public.architect_construct_worker_ok() returns boolean
language sql stable set search_path='' as $$
  select current_setting('architect.construct_worker', true) = '1'
    or coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      current_user
    ) = 'service_role';
$$;
create or replace function public.architect_construct_claim(p_worker text, p_lease integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs; recovered boolean;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_worker is null or length(p_worker) not between 1 and 80 or p_lease is null or p_lease<5000 then raise exception 'Invalid worker'; end if;
  select * into run from public.architect_construct_runs
    where status='queued' or (status in ('claimed','running') and lease_until is not null and lease_until<now() and cancel_requested=false)
    order by created_at for update limit 1;
  if not found then return null; end if;
  recovered := run.status<>'queued';
  update public.architect_construct_runs set status='claimed', worker_id=p_worker, lease_until=now()+(p_lease::text || ' milliseconds')::interval, updated_at=now() where id=run.id;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(run.id,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=run.id),
      case when recovered then 'lease_recovered' else 'claimed' end,
      case when recovered then 'Lease recovered.' else 'Claimed.' end);
  return run.id;
end $$;
create or replace function public.architect_construct_finish(p_worker text,p_run uuid,p_status text,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_status is null or p_status not in ('succeeded','failed','cancelled','blocked','timed_out') then raise exception 'Invalid status'; end if;
  if p_result is not null and (jsonb_typeof(p_result)<>'object' or p_result ? 'release' or p_result->>'sandbox'='true' and p_result->>'isolation'<>'docker') then raise exception 'Invalid result'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  update public.architect_construct_runs set status=p_status, result=p_result, lease_until=null, updated_at=now() where id=p_run;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_run,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=p_run),
      case when p_status='timed_out' then 'timed_out' when p_status='blocked' then 'blocked' else 'finished' end, p_status);
  return true;
end $$;
create or replace function public.architect_construct_timeout() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  with expired as (
    select id from public.architect_construct_runs
    where status in ('claimed','running') and lease_until is not null and lease_until<now()
    for update
  )
  update public.architect_construct_runs r set status='timed_out', lease_until=null, updated_at=now(),
    result=coalesce(r.result, jsonb_build_object('isolation','unavailable','runtime_available',false,'sandbox',false,'blocker','Worker lease expired before a durable result was recorded.','source_hash',r.source_tree_hash,'result_hash',null,'changed_files','[]'::jsonb,'diff','','checks','[]'::jsonb,'preview',jsonb_build_object('path',null,'body','','unavailable_reason','Timed out before preview collection.'),'artifacts','[]'::jsonb))
  from expired where r.id=expired.id;
  get diagnostics n = row_count;
  return coalesce(n,0);
end $$;
create function public.architect_construct_heartbeat(p_worker text, p_run uuid, p_lease integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_lease is null or p_lease<5000 then raise exception 'Invalid lease'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker or run.status not in ('claimed','running') then return false; end if;
  update public.architect_construct_runs set lease_until=now()+(p_lease::text || ' milliseconds')::interval, updated_at=now() where id=p_run;
  return true;
end $$;
create function public.architect_construct_mark_running(p_worker text, p_run uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  update public.architect_construct_runs set status='running', updated_at=now() where id=p_run;
  return true;
end $$;
create function public.architect_construct_append_event(p_worker text, p_run uuid, p_kind text, p_detail text) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_kind is null or p_kind not in ('queued','claimed','lease_recovered','started','source_prepared','patch_applied','check_started','check_finished','preview_collected','blocked','cancelled','timed_out','finished') then raise exception 'Invalid event'; end if;
  if p_detail is null or length(p_detail)>2000 then raise exception 'Invalid event'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker then return false; end if;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_run,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=p_run), p_kind, p_detail);
  return true;
end $$;
create function public.architect_construct_invalidate_briefs(p_project uuid, p_reason text) returns integer
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; n integer;
begin
  select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_reason is null or length(p_reason) not between 1 and 300 then raise exception 'Invalid reason'; end if;
  update public.architect_construct_briefs
    set status='invalidated', invalidation_reason=p_reason
    where person_id=owner_id and project_id=p_project and status='approved';
  get diagnostics n = row_count;
  return coalesce(n,0);
end $$;
revoke all on function public.architect_construct_worker_ok(),public.architect_construct_heartbeat(text,uuid,integer),public.architect_construct_mark_running(text,uuid),public.architect_construct_append_event(text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.architect_construct_invalidate_briefs(uuid,text) from public,anon;
grant execute on function public.architect_construct_invalidate_briefs(uuid,text) to authenticated;
grant execute on function public.architect_construct_claim(text,integer),public.architect_construct_finish(text,uuid,text,jsonb),public.architect_construct_timeout(),public.architect_construct_heartbeat(text,uuid,integer),public.architect_construct_mark_running(text,uuid),public.architect_construct_append_event(text,uuid,text,text),public.architect_construct_worker_ok() to service_role;
