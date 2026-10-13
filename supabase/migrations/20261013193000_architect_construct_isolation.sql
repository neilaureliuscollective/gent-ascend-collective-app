-- Close owner-chosen fixture host execution, add per-claim fencing, and
-- stop timing out takeable leases. Additive; hosted application is unapplied.
create or replace function public.architect_construct_import_source(p_id uuid,p_kind text,p_repository text,p_commit text,p_label text,p_tree text,p_files jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; receipt public.architect_construct_sources;
begin
  select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_id is null or p_kind is null or p_kind not in ('imported','git') or p_label is null or p_tree is null or p_tree !~ '^[0-9a-f]{64}$' or p_files is null then raise exception 'Invalid source'; end if;
  select * into receipt from public.architect_construct_sources where id=p_id;
  if found then
    if receipt.person_id<>owner_id or receipt.tree_hash<>p_tree or receipt.kind<>p_kind then raise exception 'Source replay mismatch'; end if;
    return true;
  end if;
  insert into public.architect_construct_sources(id,person_id,kind,repository,commit,label,tree_hash,files) values(p_id,owner_id,p_kind,p_repository,p_commit,p_label,p_tree,p_files);
  return true;
end $$;

alter table public.architect_construct_runs add column if not exists lease_token uuid;

create or replace function public.architect_construct_claim(p_worker text, p_lease integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs; recovered boolean; token uuid;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_worker is null or length(p_worker) not between 1 and 80 or p_lease is null or p_lease<5000 then raise exception 'Invalid worker'; end if;
  select * into run from public.architect_construct_runs
    where status='queued' or (status in ('claimed','running') and lease_until is not null and lease_until<now() and cancel_requested=false)
    order by created_at for update limit 1;
  if not found then return null; end if;
  recovered := run.status<>'queued';
  token := gen_random_uuid();
  update public.architect_construct_runs
    set status='claimed', worker_id=p_worker, lease_token=token,
        lease_until=now()+(p_lease::text || ' milliseconds')::interval, updated_at=now()
    where id=run.id;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(run.id,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=run.id),
      case when recovered then 'lease_recovered' else 'claimed' end,
      case when recovered then 'Lease recovered.' else 'Claimed.' end);
  return run.id;
end $$;

drop function if exists public.architect_construct_finish(text,uuid,text,jsonb);
create function public.architect_construct_finish(p_worker text,p_run uuid,p_token uuid,p_status text,p_result jsonb) returns boolean
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
    where status in ('claimed','running') and lease_until is not null and lease_until<now() and cancel_requested=true
    for update
  )
  update public.architect_construct_runs r set status='cancelled', lease_until=null, updated_at=now(),
    result=coalesce(r.result, jsonb_build_object('isolation','unavailable','runtime_available',false,'sandbox',false,'blocker','Owner cancelled the run and the worker lease expired.','source_hash',r.source_tree_hash,'result_hash',null,'changed_files','[]'::jsonb,'diff','','checks','[]'::jsonb,'preview',jsonb_build_object('path',null,'body','','unavailable_reason','Cancelled before preview collection.'),'artifacts','[]'::jsonb))
  from expired where r.id=expired.id;
  get diagnostics n = row_count;
  return coalesce(n,0);
end $$;

drop function if exists public.architect_construct_heartbeat(text,uuid,integer);
create function public.architect_construct_heartbeat(p_worker text, p_run uuid, p_token uuid, p_lease integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_lease is null or p_lease<5000 or p_token is null then raise exception 'Invalid lease'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker or run.lease_token is distinct from p_token or run.status not in ('claimed','running') then return false; end if;
  update public.architect_construct_runs set lease_until=now()+(p_lease::text || ' milliseconds')::interval, updated_at=now() where id=p_run;
  return true;
end $$;

drop function if exists public.architect_construct_mark_running(text,uuid);
create function public.architect_construct_mark_running(p_worker text, p_run uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_token is null then raise exception 'Invalid worker'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker or run.lease_token is distinct from p_token then return false; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  update public.architect_construct_runs set status='running', updated_at=now() where id=p_run;
  return true;
end $$;

drop function if exists public.architect_construct_append_event(text,uuid,text,text);
create function public.architect_construct_append_event(p_worker text, p_run uuid, p_token uuid, p_kind text, p_detail text) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if not public.architect_construct_worker_ok() then raise exception 'Worker authority required'; end if;
  if p_token is null or p_kind is null or p_kind not in ('queued','claimed','lease_recovered','started','source_prepared','patch_applied','check_started','check_finished','preview_collected','blocked','cancelled','timed_out','finished') then raise exception 'Invalid event'; end if;
  if p_detail is null or length(p_detail)>2000 then raise exception 'Invalid event'; end if;
  select * into run from public.architect_construct_runs where id=p_run for update;
  if not found or run.worker_id is distinct from p_worker or run.lease_token is distinct from p_token then return false; end if;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_run,run.person_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=p_run), p_kind, p_detail);
  return true;
end $$;

revoke all on function public.architect_construct_finish(text,uuid,uuid,text,jsonb),public.architect_construct_heartbeat(text,uuid,uuid,integer),public.architect_construct_mark_running(text,uuid,uuid),public.architect_construct_append_event(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.architect_construct_claim(text,integer),public.architect_construct_finish(text,uuid,uuid,text,jsonb),public.architect_construct_timeout(),public.architect_construct_heartbeat(text,uuid,uuid,integer),public.architect_construct_mark_running(text,uuid,uuid),public.architect_construct_append_event(text,uuid,uuid,text,text) to service_role;
