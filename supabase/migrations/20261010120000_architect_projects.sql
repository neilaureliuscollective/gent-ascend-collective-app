-- Additive Architect storage and conservative execution reservations. Never applied automatically.
create table public.architect_projects (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 name text not null check(length(name) between 1 and 80), revision integer not null default 0 check(revision between 0 and 100),
 archived boolean not null default false, created_at timestamptz not null default now(),
 unique(person_id,id)
);
create table public.architect_versions (
 id uuid primary key, person_id uuid not null, project_id uuid not null,
 revision integer not null check(revision between 1 and 100), content jsonb not null,
 created_at timestamptz not null default now(), unique(project_id,revision),
 foreign key(person_id,project_id) references public.architect_projects(person_id,id) on delete cascade,
 check(jsonb_typeof(content)='object' and content->>'version'='1' and length(content->>'name') between 1 and 80 and length(content->>'brief')<=2000 and length(content->>'html')<=40000 and length(content->>'css')<=40000 and content ?& array['version','name','brief','html','css'] and jsonb_typeof(content->'version')='number' and jsonb_typeof(content->'name')='string' and jsonb_typeof(content->'brief')='string' and jsonb_typeof(content->'html')='string' and jsonb_typeof(content->'css')='string' and octet_length(content::text)<=180000)
);
-- Approved operational grants, not client-editable membership metadata.
create table public.architect_allowances (
 person_id uuid primary key references public.persons(id) on delete cascade,
 expires_at timestamptz not null, monthly_jobs integer not null check(monthly_jobs between 1 and 20)
);
create table public.architect_jobs (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null, expected integer not null, request_hash text not null,
 status text not null default 'reserved' check(status in ('reserved','complete','failed')),
 model text not null, output jsonb,
 foreign key(person_id,project_id) references public.architect_projects(person_id,id) on delete cascade,
 created_at timestamptz not null default now(), finished_at timestamptz
);
create index architect_job_usage on public.architect_jobs(person_id,created_at);
create index architect_owner_projects on public.architect_projects(person_id,created_at desc);

alter table public.architect_projects enable row level security;
alter table public.architect_versions enable row level security;
alter table public.architect_allowances enable row level security;
alter table public.architect_jobs enable row level security;
revoke all on public.architect_projects,public.architect_versions,public.architect_jobs,public.architect_allowances from public,anon,authenticated;
grant select on public.architect_projects,public.architect_versions,public.architect_jobs,public.architect_allowances to authenticated;
grant all on public.architect_allowances to service_role;
create policy architect_project_owner on public.architect_projects for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_version_owner on public.architect_versions for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_job_owner on public.architect_jobs for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_allowance_owner on public.architect_allowances for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create function public.architect_save(p_project uuid,p_version uuid,p_expected integer,p_content jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid; p public.architect_projects%rowtype; old_version public.architect_versions%rowtype;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into p from public.architect_projects where id=p_project for update;
 if found and (p.person_id<>owner_id or p.archived) then raise exception 'Project unavailable' using errcode='42501'; end if;
 select * into old_version from public.architect_versions where id=p_version;
 if found then
  if old_version.person_id=owner_id and old_version.project_id=p_project and old_version.revision=p_expected+1 and old_version.content=p_content then return old_version.revision; end if;
  raise exception 'Request changed' using errcode='22023';
 end if;
 if p.id is null then
  if p_expected<>0 or (select count(*) from public.architect_projects where person_id=owner_id and not archived)>=20 then raise exception 'Project limit or version conflict' using errcode='40001'; end if;
  insert into public.architect_projects(id,person_id,name) values(p_project,owner_id,p_content->>'name');
 elsif p.revision<>p_expected then raise exception 'Project changed; reload' using errcode='40001'; end if;
 insert into public.architect_versions(id,person_id,project_id,revision,content) values(p_version,owner_id,p_project,p_expected+1,p_content);
 update public.architect_projects set revision=p_expected+1,name=p_content->>'name' where id=p_project;
 return p_expected+1;
end $$;
create function public.architect_delete(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if not exists(select 1 from public.architect_projects where id=p_project and person_id=owner_id) then raise exception 'Project unavailable' using errcode='42501'; end if;
 delete from public.architect_versions where project_id=p_project and person_id=owner_id;
 update public.architect_jobs set output=null,status=case when status='reserved' then 'failed' else status end,finished_at=coalesce(finished_at,now()) where project_id=p_project and person_id=owner_id;
 update public.architect_projects set archived=true,name='Deleted project' where id=p_project and person_id=owner_id;
 -- Keep minimal reservations so deletion cannot reset usage.
end $$;
create function public.architect_reserve(p_id uuid,p_project uuid,p_expected integer,p_hash text,p_model text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; allowance integer;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null or not exists(select 1 from public.architect_projects where id=p_project and person_id=owner_id and not archived and revision=p_expected) then raise exception 'Project unavailable or changed' using errcode='42501'; end if;
 if length(p_hash)<>64 or length(p_model) not between 1 and 100 then raise exception 'Invalid reservation' using errcode='22023'; end if;
 if exists(select 1 from public.architect_jobs where id=p_id) then raise exception 'Request already reserved; inspect its receipt' using errcode='23505'; end if;
 select monthly_jobs into allowance from public.architect_allowances where person_id=owner_id and expires_at>now();
 if allowance is null then raise exception 'Architect execution not enabled' using errcode='42501'; end if;
 if (select count(*) from public.architect_jobs where person_id=owner_id and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')>=allowance
 or (select count(*) from public.architect_jobs where person_id=owner_id and created_at>now()-interval '24 hours')>=3
 or exists(select 1 from public.architect_jobs where person_id=owner_id and created_at>now()-interval '2 minutes') then raise exception 'Execution limit reached' using errcode='P0001'; end if;
 insert into public.architect_jobs(id,person_id,project_id,expected,request_hash,model) values(p_id,owner_id,p_project,p_expected,p_hash,p_model);
 return p_id;
end $$;
create function public.architect_finish(p_id uuid,p_output jsonb) returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if p_output is not null and (jsonb_typeof(p_output)<>'object' or octet_length(p_output::text)>180000) then raise exception 'Invalid output' using errcode='22023'; end if;
 update public.architect_jobs j set output=p_output,status=case when p_output is null then 'failed' else 'complete' end,finished_at=now()
 where j.id=p_id and j.person_id=owner_id and j.status='reserved' and exists(select 1 from public.architect_projects p where p.id=j.project_id and p.person_id=owner_id and not p.archived);
 if not found then raise exception 'Receipt unavailable' using errcode='42501'; end if;
 -- Never save output to the canonical project or refund the reservation automatically.
end $$;
revoke all on function public.architect_save(uuid,uuid,integer,jsonb),public.architect_delete(uuid),public.architect_reserve(uuid,uuid,integer,text,text),public.architect_finish(uuid,jsonb) from public,anon;
grant execute on function public.architect_save(uuid,uuid,integer,jsonb),public.architect_delete(uuid),public.architect_reserve(uuid,uuid,integer,text,text),public.architect_finish(uuid,jsonb) to authenticated;
