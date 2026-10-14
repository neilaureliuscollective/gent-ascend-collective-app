-- Additive: refuse repair-of-repair and stale parent revision. Does not rewrite earlier Construct migrations.

create or replace function public.architect_construct_start(p_project uuid,p_request uuid,p_brief uuid,p_expected integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; project public.architect_origin_projects; brief public.architect_construct_briefs; source public.architect_construct_sources; receipt public.architect_construct_runs; parent uuid; sibling uuid; parent_run public.architect_construct_runs;
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
  parent := nullif(brief.scope #>> '{repair,parent_run_id}','')::uuid;
  if parent is not null then
    select * into parent_run from public.architect_construct_runs
      where id=parent and person_id=owner_id and project_id=p_project;
    if not found or parent_run.status<>'failed' then raise exception 'Repair parent unavailable'; end if;
    if parent_run.parent_run_id is not null then raise exception 'Repair of a repair is not allowed'; end if;
    if parent_run.project_revision<>p_expected then raise exception 'Repair evidence is bound to an older project revision'; end if;
    if brief.project_revision<>parent_run.project_revision then raise exception 'Repair cannot take a newer project revision than its parent evidence'; end if;
    select id into sibling from public.architect_construct_runs
      where person_id=owner_id and parent_run_id=parent and id<>p_request;
    if sibling is not null then raise exception 'This original run already has one repair'; end if;
  end if;
  select * into receipt from public.architect_construct_runs where id=p_request;
  if found then
    if receipt.person_id<>owner_id or receipt.brief_id<>p_brief or receipt.approval_hash<>brief.approval_hash then raise exception 'Request already reserved'; end if;
    return true;
  end if;
  insert into public.architect_construct_runs(id,person_id,project_id,brief_id,approval_hash,source_id,source_kind,source_tree_hash,project_revision,parent_run_id)
    values(p_request,owner_id,p_project,p_brief,brief.approval_hash,source.id,source.kind,source.tree_hash,p_expected,parent);
  insert into public.architect_construct_events(run_id,person_id,seq,kind,detail)
    values(p_request,owner_id,1,'queued','Run queued. The request handler does not execute software changes.');
  return true;
end $$;
revoke all on function public.architect_construct_start(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.architect_construct_start(uuid,uuid,uuid,integer) to authenticated;
