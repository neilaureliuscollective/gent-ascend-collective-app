-- Additive Construct execution contracts. Hosted application requires founder-approved migration.
create table public.architect_construct_sources (
  id uuid primary key,
  person_id uuid not null references public.persons(id) on delete cascade,
  kind text not null check(kind in ('fixture','imported','git')),
  repository text check(repository is null or repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  commit text check(commit is null or commit ~ '^[0-9a-f]{40}$'),
  label text not null check(length(label) between 1 and 200),
  tree_hash text not null check(tree_hash ~ '^[0-9a-f]{64}$'),
  files jsonb not null check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=32),
  created_at timestamptz not null default now()
);
create table public.architect_construct_briefs (
  id uuid primary key,
  person_id uuid not null references public.persons(id) on delete cascade,
  project_id uuid not null,
  project_revision integer not null check(project_revision between 1 and 500),
  source_id uuid not null references public.architect_construct_sources(id),
  approval_hash text not null check(approval_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'approved' check(status in ('approved','invalidated')),
  invalidation_reason text check(invalidation_reason is null or length(invalidation_reason)<=300),
  scope jsonb not null check(octet_length(scope::text)<=20000),
  created_at timestamptz not null default now(),
  foreign key(project_id,person_id) references public.architect_origin_projects(id,person_id) on delete cascade
);
create table public.architect_construct_runs (
  id uuid primary key,
  person_id uuid not null,
  project_id uuid not null,
  brief_id uuid not null references public.architect_construct_briefs(id),
  approval_hash text not null,
  source_id uuid not null,
  source_kind text not null check(source_kind in ('fixture','imported','git')),
  source_tree_hash text not null,
  project_revision integer not null,
  status text not null default 'queued' check(status in ('queued','claimed','running','succeeded','failed','cancelled','blocked','timed_out')),
  cancel_requested boolean not null default false,
  worker_id text check(worker_id is null or length(worker_id)<=80),
  lease_until timestamptz,
  result jsonb check(result is null or octet_length(result::text)<=120000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id,person_id) references public.architect_origin_projects(id,person_id) on delete cascade
);
create table public.architect_construct_events (
  id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
  run_id uuid not null references public.architect_construct_runs(id) on delete cascade,
  person_id uuid not null,
  seq integer not null check(seq>0),
  kind text not null check(kind in ('queued','claimed','lease_recovered','started','source_prepared','patch_applied','check_started','check_finished','preview_collected','blocked','cancelled','timed_out','finished')),
  detail text not null check(length(detail)<=2000),
  created_at timestamptz not null default now(),
  unique(run_id,seq)
);
create index architect_construct_runs_owner_time on public.architect_construct_runs(person_id,created_at desc);
create index architect_construct_runs_claim on public.architect_construct_runs(status,lease_until,created_at);
alter table public.architect_construct_sources enable row level security;
alter table public.architect_construct_briefs enable row level security;
alter table public.architect_construct_runs enable row level security;
alter table public.architect_construct_events enable row level security;
create policy architect_construct_sources_owner on public.architect_construct_sources for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_construct_briefs_owner on public.architect_construct_briefs for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_construct_runs_owner on public.architect_construct_runs for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_construct_events_owner on public.architect_construct_events for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
revoke all on public.architect_construct_sources,public.architect_construct_briefs,public.architect_construct_runs,public.architect_construct_events from public,anon,authenticated;
grant select on public.architect_construct_sources,public.architect_construct_briefs,public.architect_construct_runs,public.architect_construct_events to authenticated;
create function public.architect_construct_import_source(p_id uuid,p_kind text,p_repository text,p_commit text,p_label text,p_tree text,p_files jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; receipt public.architect_construct_sources;
begin
  select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_id is null or p_kind is null or p_kind not in ('fixture','imported','git') or p_label is null or p_tree is null or p_tree !~ '^[0-9a-f]{64}$' or p_files is null then raise exception 'Invalid source'; end if;
  select * into receipt from public.architect_construct_sources where id=p_id;
  if found then
    if receipt.person_id<>owner_id or receipt.tree_hash<>p_tree or receipt.kind<>p_kind then raise exception 'Source replay mismatch'; end if;
    return true;
  end if;
  insert into public.architect_construct_sources(id,person_id,kind,repository,commit,label,tree_hash,files) values(p_id,owner_id,p_kind,p_repository,p_commit,p_label,p_tree,p_files);
  return true;
end $$;
create function public.architect_construct_approve_brief(p_id uuid,p_project uuid,p_expected integer,p_source uuid,p_hash text,p_scope jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; project public.architect_origin_projects; source public.architect_construct_sources; receipt public.architect_construct_briefs;
begin
  select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  select * into project from public.architect_origin_projects where id=p_project and person_id=owner_id for update;
  if not found then raise exception 'Project unavailable'; end if;
  if project.revision<>p_expected or project.content->>'status'='archived' then raise exception 'Project changed or archived'; end if;
  select * into source from public.architect_construct_sources where id=p_source and person_id=owner_id;
  if not found then raise exception 'Source unavailable'; end if;
  if source.files = '[]'::jsonb and source.kind<>'fixture' then raise exception 'Missing source files'; end if;
  select * into receipt from public.architect_construct_briefs where id=p_id;
  if found then
    if receipt.person_id<>owner_id or receipt.approval_hash<>p_hash or receipt.scope<>p_scope then raise exception 'Brief replay mismatch'; end if;
    return true;
  end if;
  update public.architect_construct_briefs set status='invalidated', invalidation_reason='A newer source-pinned brief replaced this approval.'
    where person_id=owner_id and project_id=p_project and status='approved';
  insert into public.architect_construct_briefs(id,person_id,project_id,project_revision,source_id,approval_hash,scope)
    values(p_id,owner_id,p_project,p_expected,p_source,p_hash,p_scope);
  return true;
end $$;
create function public.architect_construct_start(p_project uuid,p_request uuid,p_brief uuid,p_expected integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; project public.architect_origin_projects; brief public.architect_construct_briefs; source public.architect_construct_sources; receipt public.architect_construct_runs;
begin
  select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  select * into project from public.architect_origin_projects where id=p_project and person_id=owner_id for update;
  if not found then raise exception 'Project unavailable'; end if;
  if project.revision<>p_expected then raise exception 'Project changed'; end if;
  select * into brief from public.architect_construct_briefs where id=p_brief and person_id=owner_id;
  if not found then raise exception 'Brief unavailable'; end if;
  if brief.status<>'approved' or brief.project_id<>p_project or brief.project_revision<>p_expected then raise exception 'Brief invalidated'; end if;
  select * into source from public.architect_construct_sources where id=brief.source_id and person_id=owner_id;
  if not found or source.tree_hash<>brief.scope->>'source_tree_hash' then raise exception 'Source unavailable'; end if;
  select * into receipt from public.architect_construct_runs where id=p_request;
  if found then
    if receipt.person_id<>owner_id or receipt.brief_id<>p_brief or receipt.approval_hash<>brief.approval_hash then raise exception 'Request already reserved'; end if;
    return true;
  end if;
  insert into public.architect_construct_runs(id,person_id,project_id,brief_id,approval_hash,source_id,source_kind,source_tree_hash,project_revision)
    values(p_request,owner_id,p_project,p_brief,brief.approval_hash,source.id,source.kind,source.tree_hash,p_expected);
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_request,owner_id,1,'queued','Run queued. The request handler does not execute software changes.');
  return true;
end $$;
create function public.architect_construct_cancel(p_project uuid,p_run uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; run public.architect_construct_runs;
begin
  select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  select * into run from public.architect_construct_runs where id=p_run and person_id=owner_id and project_id=p_project for update;
  if not found then raise exception 'Run unavailable'; end if;
  if run.status in ('succeeded','failed','cancelled','blocked','timed_out') then return true; end if;
  update public.architect_construct_runs set cancel_requested=true, status=case when status='queued' then 'cancelled' else status end, updated_at=now() where id=p_run;
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_run,owner_id,(select coalesce(max(seq),0)+1 from public.architect_construct_events where run_id=p_run),'cancelled','Owner requested cancellation.');
  return true;
end $$;
create function public.architect_construct_claim(p_worker text, p_lease integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs; recovered boolean;
begin
  if current_setting('architect.construct_worker', true) is distinct from '1' then raise exception 'Worker authority required'; end if;
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
create function public.architect_construct_finish(p_worker text,p_run uuid,p_status text,p_result jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare run public.architect_construct_runs;
begin
  if current_setting('architect.construct_worker', true) is distinct from '1' then raise exception 'Worker authority required'; end if;
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
create function public.architect_construct_timeout() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if current_setting('architect.construct_worker', true) is distinct from '1' then raise exception 'Worker authority required'; end if;
  with expired as (
    select id from public.architect_construct_runs
    where status in ('claimed','running') and lease_until is not null and lease_until<now()
    for update
  )
  update public.architect_construct_runs r set status='timed_out', lease_until=null, updated_at=now(),
    result=coalesce(r.result, jsonb_build_object('isolation','unavailable','sandbox',false,'blocker','Worker lease expired before a durable result was recorded.','source_hash',r.source_tree_hash,'result_hash',null,'changed_files','[]'::jsonb,'diff','','checks','[]'::jsonb,'preview',jsonb_build_object('path',null,'body','','unavailable_reason','Timed out before preview collection.'),'artifacts','[]'::jsonb))
  from expired where r.id=expired.id;
  get diagnostics n = row_count;
  return coalesce(n,0);
end $$;
revoke all on function public.architect_construct_import_source(uuid,text,text,text,text,text,jsonb),public.architect_construct_approve_brief(uuid,uuid,integer,uuid,text,jsonb),public.architect_construct_start(uuid,uuid,uuid,integer),public.architect_construct_cancel(uuid,uuid) from public,anon;
grant execute on function public.architect_construct_import_source(uuid,text,text,text,text,text,jsonb),public.architect_construct_approve_brief(uuid,uuid,integer,uuid,text,jsonb),public.architect_construct_start(uuid,uuid,uuid,integer),public.architect_construct_cancel(uuid,uuid) to authenticated;
revoke all on function public.architect_construct_claim(text,integer),public.architect_construct_finish(text,uuid,text,jsonb),public.architect_construct_timeout() from public,anon,authenticated;
