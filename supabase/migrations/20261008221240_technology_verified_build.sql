-- Deterministic, explicitly resumed builds. No provider calls or background-worker claim.
alter table public.technology_site_versions add constraint technology_version_owner_id unique(person_id,id);
create table public.technology_builds(
 id uuid primary key,person_id uuid not null,project_id uuid not null,version_id uuid not null,
 template text not null default 'service-business-export-v1' check(template='service-business-export-v1'),
 status text not null default 'queued' check(status in('queued','running','ready')),
 lease uuid,lease_until timestamptz,attempts integer not null default 0 check(attempts between 0 and 5),
 html text,sha256 text,checks jsonb,created_at timestamptz not null default now(),finished_at timestamptz,
 unique(version_id,template),foreign key(person_id,project_id) references public.technology_projects(person_id,id) on delete cascade,
 foreign key(person_id,version_id) references public.technology_site_versions(person_id,id) on delete cascade,
 check((status='ready' and html is not null and octet_length(html)<=100000 and sha256 is not null and sha256 ~ '^[a-f0-9]{64}$' and checks is not null and finished_at is not null) or (status<>'ready' and html is null and sha256 is null and checks is null and finished_at is null))
);
create index technology_build_owner on public.technology_builds(person_id,created_at);
alter table public.technology_builds enable row level security;
create policy technology_build_owner_read on public.technology_builds for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
revoke all on public.technology_builds from anon,authenticated;
grant select on public.technology_builds to authenticated;
create function public.technology_build_queue(p_id uuid,p_project uuid,p_version uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=public.technology_owner(); b public.technology_builds;
begin
 perform 1 from public.technology_projects where id=p_project and person_id=owner for update;
 if not found then raise exception 'Project unavailable';end if;
 select * into b from public.technology_builds where id=p_id;
 if found then if b.person_id<>owner or b.project_id<>p_project or b.version_id<>p_version then raise exception 'Build request changed';end if;return b.id;end if;
 if not exists(select 1 from public.technology_site_versions v join public.technology_projects p on p.id=v.project_id where v.id=p_version and v.person_id=owner and v.project_id=p_project and v.reviewed_at is not null and v.revision=p.revision) then raise exception 'Review the current version';end if;
 select * into b from public.technology_builds where version_id=p_version;
 if found then return b.id;end if;
 insert into public.technology_builds(id,person_id,project_id,version_id) values(p_id,owner,p_project,p_version);return p_id;
end $$;
create function public.technology_build_claim(p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid:=public.technology_owner();b public.technology_builds;
begin
 select * into b from public.technology_builds where id=p_id and person_id=owner for update;
 if not found then raise exception 'Build unavailable';end if;
 if b.status='ready' then return false;end if;
 if b.status='running' and b.lease_until>now() then raise exception 'Build already running';end if;
 if b.attempts>=5 then raise exception 'Build needs operator review';end if;
 update public.technology_builds set status='running',lease=p_lease,lease_until=now()+interval '30 seconds',attempts=attempts+1 where id=p_id;return true;
end $$;
create function public.technology_build_finish(p_id uuid,p_owner uuid,p_lease uuid,p_html text,p_hash text,p_checks jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_checks->>'passed' is distinct from 'true' or p_checks->>'validator' is distinct from 'static-service-v1' then raise exception 'Checks failed';end if;
 update public.technology_builds set status='ready',html=p_html,sha256=p_hash,checks=p_checks,finished_at=now(),lease=null,lease_until=null where id=p_id and person_id=p_owner and status='running' and lease=p_lease and lease_until>now();
 if not found then raise exception 'Build lease changed';end if;return true;
end $$;
revoke all on function public.technology_build_queue(uuid,uuid,uuid),public.technology_build_claim(uuid,uuid),public.technology_build_finish(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.technology_build_queue(uuid,uuid,uuid),public.technology_build_claim(uuid,uuid) to authenticated;
grant execute on function public.technology_build_finish(uuid,uuid,uuid,text,text,jsonb) to service_role;
