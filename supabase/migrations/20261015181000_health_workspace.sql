-- Additive Health workspace persistence. Does not activate ingestion or Health AI.
-- Architect Apps compilation is not shipped here; this stores owner workspace state only.
-- Timestamp 20261015181000 avoids colliding with Talk's unmerged 20261015180000_talk_live_trusted_observe.sql.
-- This file was never applied on main or hosted projects. Local checkouts of the first Health commit
-- that applied 20261015180000 should reset the isolated database rather than rewrite hosted history.
create table health_private.workspaces (
  id uuid primary key,
  person_id uuid not null references public.persons(id),
  foundation text not null check(foundation in ('evening-routine','bloodwork-tracker')),
  title text not null check(length(title) between 1 and 120),
  sample boolean not null default false,
  version integer not null default 1 check(version between 1 and 5000),
  working_revision integer not null default 1,
  last_working_revision integer not null default 1,
  settings jsonb not null,
  progress jsonb,
  architect jsonb,
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  unique(person_id,id),
  check(jsonb_typeof(settings)='object' and pg_column_size(settings)<=16000),
  check(progress is null or (jsonb_typeof(progress)='object' and pg_column_size(progress)<=16000))
);
create index health_workspaces_owner on health_private.workspaces(person_id,last_opened_at desc);
create table health_private.workspace_revisions (
  id bigint generated always as identity primary key,
  person_id uuid not null,
  workspace_id uuid not null,
  revision integer not null,
  settings jsonb not null,
  progress jsonb,
  architect jsonb,
  created_at timestamptz not null default now(),
  unique(person_id,workspace_id,revision),
  foreign key(person_id,workspace_id) references health_private.workspaces(person_id,id) on delete cascade
);
create table health_private.bridge_sessions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  workspace_id uuid not null,
  revision integer not null,
  fields text[] not null default '{}',
  token uuid not null unique,
  sample boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(person_id,workspace_id) references health_private.workspaces(person_id,id) on delete cascade
);
create index health_bridge_owner on health_private.bridge_sessions(person_id,expires_at);
do $$ declare t text; begin
  foreach t in array array['workspaces','workspace_revisions','bridge_sessions'] loop
    execute format('alter table health_private.%I enable row level security',t);
    execute format('revoke all on health_private.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on health_private.%I to authenticated',t);
    execute format('create policy health_owner on health_private.%I for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())))',t);
  end loop;
end $$;
revoke all on all sequences in schema health_private from public,anon,authenticated,service_role;

create or replace function public.health_read() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'activation',health_private.release_status(),
 'consents',coalesce((select jsonb_agg(to_jsonb(c)-'person_id') from health_private.consents c),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(to_jsonb(r)-'person_id' order by created_at desc) from health_private.records r),'[]'::jsonb),
 'observations',coalesce((select jsonb_agg(o.data || jsonb_build_object('record_id',o.record_id,'version',o.version,'status',o.status,'confirmed_at',o.confirmed_at)) from health_private.observations o join health_private.records source_record on source_record.id=o.record_id where source_record.status<>'deleting'),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(to_jsonb(j)-'person_id'-'lease'-'lease_until') from health_private.jobs j),'[]'::jsonb),
 'turns',coalesce((select jsonb_agg(to_jsonb(t)-'person_id'-'snapshot' order by created_at) from (select * from health_private.turns order by created_at desc limit 40) t),'[]'::jsonb),
 'workspaces',coalesce((select jsonb_agg(jsonb_build_object(
   'id',w.id,'foundation',w.foundation,'title',w.title,'sample',w.sample,'version',w.version,
   'workingRevision',w.working_revision,'lastWorkingRevision',w.last_working_revision,
   'settings',w.settings,'progress',w.progress,'architect',w.architect,
   'created_at',w.created_at,'updated_at',w.updated_at,'last_opened_at',w.last_opened_at
 ) order by w.last_opened_at desc) from health_private.workspaces w where w.status='active'),'[]'::jsonb)
 ) where (select auth.uid()) is not null
$$;

create or replace function public.health_export_history() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revisions',coalesce((select jsonb_agg(to_jsonb(r)-'person_id') from health_private.revisions r),'[]'),
 'deletionTombstones',coalesce((select jsonb_agg(to_jsonb(d)-'person_id') from health_private.tombstones d),'[]'),
 'conversations',coalesce((select jsonb_agg(to_jsonb(t)-'person_id'-'snapshot') from health_private.turns t),'[]'),
 'quotaReservations',coalesce((select jsonb_agg(to_jsonb(u)-'person_id') from health_private.usage u),'[]'),
 'processing',coalesce((select jsonb_agg(jsonb_build_object('request',request,'kind',kind,'created_at',created_at)) from health_private.receipts),'[]'),
 'workspaces',coalesce((select jsonb_agg(to_jsonb(w)-'person_id'-'architect') from health_private.workspaces w),'[]'),
 'workspaceRevisions',coalesce((select jsonb_agg(jsonb_build_object(
   'workspace_id',workspace_id,
   'revision',revision,
   'settings',settings,
   'progress',progress,
   'architect',architect,
   'created_at',created_at
 ) order by created_at) from health_private.workspace_revisions),'[]'))
 where auth.uid() is not null
$$;

create function health_private.workspace_mutate(p_kind text,p_request uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  own uuid;
  existing health_private.receipts;
  w health_private.workspaces;
  previous health_private.workspace_revisions;
  result jsonb := '{}';
  v_token uuid;
  fields text[];
begin
  select id into own from public.persons where auth_user_id=auth.uid() for update;
  if own is null then raise exception 'Health authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid Health payload'; end if;
  if pg_column_size(p)>250000 then raise exception 'Health request too large'; end if;
  select * into existing from health_private.receipts where person_id=own and request=p_request;
  if found then
    if existing.kind<>p_kind or existing.payload<>p then raise exception 'Health request changed' using errcode='40001'; end if;
    return existing.result;
  end if;
  if (select count(*) from health_private.receipts where person_id=own and created_at>now()-interval '1 day')>1000 then
    raise exception 'Health daily limit';
  end if;
  if p_kind='workspace_save' then
    if p->>'foundation' not in ('evening-routine','bloodwork-tracker') then raise exception 'Unknown Health foundation'; end if;
    if length(p->>'title') not between 1 and 120 then raise exception 'Invalid workspace title'; end if;
    if jsonb_typeof(p->'settings') is distinct from 'object' then raise exception 'Invalid workspace settings'; end if;
    if pg_column_size(p->'settings')>16000 or pg_column_size(coalesce(p->'progress','null'::jsonb))>16000 then
      raise exception 'Workspace too large';
    end if;
    if jsonb_typeof(p->'expected') is distinct from 'number' or (p->>'expected')::integer<1 then
      raise exception 'Expected version required';
    end if;
    select * into w from health_private.workspaces where id=(p->>'id')::uuid and person_id=own for update;
    if not found then
      if (p->>'expected')::integer<>1 then raise exception 'Health workspace changed' using errcode='40001'; end if;
      if (select count(*) from health_private.workspaces where person_id=own and status='active')>=40 then
        raise exception 'Health workspace limit';
      end if;
      insert into health_private.workspaces(id,person_id,foundation,title,sample,settings,progress,architect,last_opened_at)
      values(
        (p->>'id')::uuid, own, p->>'foundation', p->>'title', coalesce((p->>'sample')::boolean,false),
        p->'settings', nullif(p->'progress','null'::jsonb), nullif(p->'architect','null'::jsonb), now()
      ) returning * into w;
      insert into health_private.workspace_revisions(person_id,workspace_id,revision,settings,progress,architect)
      values(own,w.id,1,w.settings,w.progress,w.architect);
    else
      if w.version<>(p->>'expected')::integer then raise exception 'Health workspace changed' using errcode='40001'; end if;
      if w.foundation is distinct from p->>'foundation' then raise exception 'Health workspace foundation cannot change' using errcode='40001'; end if;
      update health_private.workspaces set
        title=p->>'title',
        sample=coalesce((p->>'sample')::boolean,w.sample),
        settings=p->'settings',
        progress=nullif(p->'progress','null'::jsonb),
        architect=coalesce(nullif(p->'architect','null'::jsonb),architect),
        version=version+1,
        last_opened_at=case when coalesce((p->>'open')::boolean,false) then now() else last_opened_at end,
        updated_at=now()
      where id=w.id and person_id=own returning * into w;
      insert into health_private.workspace_revisions(person_id,workspace_id,revision,settings,progress,architect)
      values(own,w.id,w.version,w.settings,w.progress,w.architect);
      if (select count(*) from health_private.workspace_revisions where person_id=own and workspace_id=w.id)>20 then
        delete from health_private.workspace_revisions
        where id in (
          select id from health_private.workspace_revisions
          where person_id=own and workspace_id=w.id
          order by revision asc
          limit 1
        ) and revision<>w.last_working_revision;
      end if;
    end if;
    result:=jsonb_build_object('id',w.id,'version',w.version,'workingRevision',w.working_revision,'lastWorkingRevision',w.last_working_revision);
  elsif p_kind='workspace_copy' then
    select * into w from health_private.workspaces where id=(p->>'sourceId')::uuid and person_id=own;
    if not found then raise exception 'Health workspace not found' using errcode='42501'; end if;
    if length(p->>'title') not between 1 and 120 then raise exception 'Invalid workspace title'; end if;
    if (select count(*) from health_private.workspaces where person_id=own and status='active')>=40 then
      raise exception 'Health workspace limit';
    end if;
    insert into health_private.workspaces(id,person_id,foundation,title,sample,settings,progress,architect)
    values(
      (p->>'id')::uuid,own,w.foundation,p->>'title',w.sample,
      coalesce(p->'settings', w.settings),
      coalesce(nullif(p->'progress','null'::jsonb), w.progress),
      coalesce(nullif(p->'architect','null'::jsonb), w.architect)
    )
    returning * into w;
    insert into health_private.workspace_revisions(person_id,workspace_id,revision,settings,progress,architect)
    values(own,w.id,1,w.settings,w.progress,w.architect);
    result:=jsonb_build_object('id',w.id,'version',1,'includeDraft',coalesce((p->>'includeDraft')::boolean,false));
  elsif p_kind='workspace_restore' then
    select * into w from health_private.workspaces where id=(p->>'id')::uuid and person_id=own for update;
    if not found or w.version<>(p->>'expected')::integer then raise exception 'Health workspace changed' using errcode='40001'; end if;
    select * into previous from health_private.workspace_revisions
      where person_id=own and workspace_id=w.id and revision=(p->>'revision')::integer;
    if not found then raise exception 'Health workspace revision not found' using errcode='40001'; end if;
    update health_private.workspaces set
      settings=previous.settings,
      progress=previous.progress,
      architect=previous.architect,
      version=version+1,
      last_working_revision=greatest(last_working_revision,previous.revision),
      updated_at=now()
    where id=w.id returning * into w;
    insert into health_private.workspace_revisions(person_id,workspace_id,revision,settings,progress,architect)
    values(own,w.id,w.version,w.settings,w.progress,w.architect);
    result:=jsonb_build_object('id',w.id,'version',w.version,'restored',previous.revision);
  elsif p_kind='workspace_architect' then
    select * into w from health_private.workspaces where id=(p->>'id')::uuid and person_id=own for update;
    if not found or w.version<>(p->>'expected')::integer then raise exception 'Health workspace changed' using errcode='40001'; end if;
    if p->>'action'='compile' then
      if jsonb_typeof(p->'architect') is distinct from 'object' then raise exception 'Invalid Architect attempt'; end if;
      update health_private.workspaces set
        architect=p->'architect',
        updated_at=now()
      where id=w.id returning * into w;
      result:=jsonb_build_object('id',w.id,'version',w.version,'workingRevision',w.working_revision,'status',w.architect->>'status');
    elsif p->>'action'='accept' then
      if w.architect is null
        or w.architect->>'status' is distinct from 'ready'
        or w.architect->>'isolation' is distinct from 'docker'
        or coalesce((w.architect->>'previewOk')::boolean,false) is not true
        or coalesce(w.architect->>'sourceHash','') !~ '^[0-9a-f]{64}$'
        or coalesce(w.architect->>'artifactHash','') !~ '^[0-9a-f]{64}$'
      then
        raise exception 'There is no verified customization to accept' using errcode='40001';
      end if;
      update health_private.workspaces set
        architect=jsonb_set(jsonb_set(w.architect,'{status}','"accepted"'),'{verified}','true'),
        working_revision=greatest(working_revision, coalesce((w.architect->>'attemptedRevision')::integer, working_revision)),
        last_working_revision=greatest(last_working_revision, coalesce((w.architect->>'attemptedRevision')::integer, last_working_revision)),
        version=version+1,
        updated_at=now()
      where id=w.id returning * into w;
      insert into health_private.workspace_revisions(person_id,workspace_id,revision,settings,progress,architect)
      values(own,w.id,w.version,w.settings,w.progress,w.architect);
      result:=jsonb_build_object('id',w.id,'version',w.version,'workingRevision',w.working_revision,'verified',true);
    elsif p->>'action'='reopen' then
      update health_private.workspaces set last_opened_at=now() where id=w.id returning * into w;
      result:=jsonb_build_object('id',w.id,'version',w.version,'workingRevision',w.working_revision);
    else
      raise exception 'Unsupported Health operation';
    end if;
  elsif p_kind='workspace_bridge' then
    select * into w from health_private.workspaces where id=(p->>'id')::uuid and person_id=own for update;
    if not found or w.version<>(p->>'expected')::integer then raise exception 'Health workspace changed' using errcode='40001'; end if;
    if p->>'action'='revoke' then
      update health_private.bridge_sessions set revoked_at=now()
        where person_id=own and workspace_id=w.id and revoked_at is null;
      result:=jsonb_build_object('id',w.id,'revoked',true);
    else
      if not w.sample and not exists(select 1 from health_private.consents where person_id=own and purpose='records' and granted) then
        raise exception 'Records consent required' using errcode='42501';
      end if;
      if jsonb_typeof(coalesce(p->'fields','[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(p->'fields','[]'::jsonb))>12 then
        raise exception 'Too many Health fields';
      end if;
      select coalesce(array_agg(value), '{}') into fields from jsonb_array_elements_text(coalesce(p->'fields','[]'::jsonb)) as value;
      v_token:=gen_random_uuid();
      insert into health_private.bridge_sessions(person_id,workspace_id,revision,fields,token,sample,expires_at)
      values(own,w.id,w.version,fields,v_token,w.sample,now()+interval '15 minutes');
      update health_private.bridge_sessions set revoked_at=now()
        where person_id=own and workspace_id=w.id and revoked_at is null and token<>v_token;
      result:=jsonb_build_object('id',w.id,'token',v_token,'expiresIn',900,'sample',w.sample,'revision',w.version,'fields',to_jsonb(fields));
    end if;
  else
    raise exception 'Unsupported Health operation';
  end if;
  insert into health_private.receipts(person_id,request,kind,payload,result) values(own,p_request,p_kind,p,result);
  return result;
end $$;

create or replace function public.health_mutate(p_kind text,p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if p_kind like 'workspace%' then
    return health_private.workspace_mutate(p_kind,p_request,p_payload);
  end if;
  return health_private.mutate(p_kind,p_request,p_payload);
end $$;

create function health_private.after_full_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind='delete' and new.status='complete' and new.record_id is null then
    delete from health_private.workspaces where person_id=new.person_id;
  end if;
  return new;
end $$;
create trigger health_full_delete_workspaces after update of status on health_private.jobs
  for each row execute function health_private.after_full_delete();

create function health_private.after_consent_revoke() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.granted is false and new.purpose='records' then
    update health_private.bridge_sessions set revoked_at=now()
      where person_id=new.person_id and revoked_at is null and sample is false;
  end if;
  return new;
end $$;
create trigger health_revoke_bridges after update of granted on health_private.consents
  for each row execute function health_private.after_consent_revoke();

create function public.health_bridge_read(p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  own uuid;
  sess health_private.bridge_sessions;
  w health_private.workspaces;
begin
  select id into own from public.persons where auth_user_id=auth.uid();
  if own is null then raise exception 'Health authentication required' using errcode='42501'; end if;
  if p_token is null then raise exception 'Health bridge unavailable' using errcode='42501'; end if;
  select * into sess from health_private.bridge_sessions
    where token=p_token and person_id=own and revoked_at is null and expires_at>now();
  if not found then raise exception 'Health bridge unavailable' using errcode='42501'; end if;
  select * into w from health_private.workspaces where id=sess.workspace_id and person_id=own;
  if not found or w.version<>sess.revision then raise exception 'Health bridge unavailable' using errcode='42501'; end if;
  if not sess.sample and not exists(select 1 from health_private.consents where person_id=own and purpose='records' and granted) then
    raise exception 'Health bridge unavailable' using errcode='42501';
  end if;
  return jsonb_build_object(
    'owner',own,
    'workspaceId',w.id,
    'revision',sess.revision,
    'sample',sess.sample,
    'fields',to_jsonb(sess.fields),
    'hostControlled',true
  );
end $$;
revoke all on function public.health_bridge_read(uuid) from public,anon,service_role;
grant execute on function public.health_bridge_read(uuid) to authenticated;
revoke all on function health_private.workspace_mutate(text,uuid,jsonb) from public,anon,service_role;
grant execute on function health_private.workspace_mutate(text,uuid,jsonb) to authenticated;
revoke all on function public.health_read(),public.health_mutate(text,uuid,jsonb),public.health_export_history() from public,anon,service_role;
grant execute on function public.health_read(),public.health_mutate(text,uuid,jsonb),public.health_export_history() to authenticated;
