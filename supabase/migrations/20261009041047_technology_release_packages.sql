-- Approval prepares portable files only. No deployment credentials, public routes or spending.
alter table public.technology_builds add constraint technology_build_release_identity unique(person_id,project_id,version_id,id);
create table public.technology_releases(
 id uuid primary key, person_id uuid not null, project_id uuid not null, version_id uuid not null, build_id uuid not null unique,
 revision integer not null check(revision>0), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 approved_at timestamptz not null default now(), revoked_at timestamptz,
 check(revoked_at is null or revoked_at>=approved_at),
 constraint technology_release_owner foreign key(person_id,project_id,version_id,build_id) references public.technology_builds(person_id,project_id,version_id,id) on delete cascade
);
create index technology_releases_owner on public.technology_releases(person_id,project_id);
alter table public.technology_releases enable row level security;
revoke all on public.technology_releases from public,anon,authenticated;
grant select on public.technology_releases to authenticated;
create policy technology_release_owner_read on public.technology_releases for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.technology_release_approve(p_id uuid,p_build uuid,p_hash text,p_consent boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner uuid:=public.technology_owner(); b public.technology_builds; r public.technology_releases; rev integer;
begin
 if p_consent is distinct from true then raise exception 'Release consent required';end if;
 perform 1 from public.persons where id=owner for update;
 select * into b from public.technology_builds where id=p_build and person_id=owner;
 if not found or b.status<>'ready' or b.sha256 is distinct from p_hash then raise exception 'Ready exact build required';end if;
 perform 1 from public.technology_projects where id=b.project_id and person_id=owner for update;
 select * into r from public.technology_releases where id=p_id;
 if found then
  if r.person_id<>owner or r.build_id<>p_build or r.sha256<>p_hash then raise exception 'Release request changed';end if;
  return r.id;
 end if;
 select * into r from public.technology_releases where build_id=p_build;
 if found then return r.id;end if;
 select v.revision into rev from public.technology_site_versions v join public.technology_projects p on p.id=v.project_id and p.person_id=v.person_id
 where v.id=b.version_id and v.person_id=owner and v.project_id=b.project_id and v.reviewed_at is not null and v.revision=p.revision;
 if rev is null then raise exception 'Review the current version';end if;
 if (select count(*) from public.technology_releases where person_id=owner)>=100 or
    (select count(*) from public.technology_releases where project_id=b.project_id)>=20 then raise exception 'Release allowance reached';end if;
 insert into public.technology_releases(id,person_id,project_id,version_id,build_id,revision,sha256) values(p_id,owner,b.project_id,b.version_id,b.id,rev,p_hash);
 return p_id;
end $$;
create function public.technology_release_revoke(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid:=public.technology_owner();
begin
 update public.technology_releases set revoked_at=coalesce(revoked_at,now()) where id=p_id and person_id=owner;
 if not found then raise exception 'Release unavailable';end if;return true;
end $$;
revoke all on function public.technology_release_approve(uuid,uuid,text,boolean),public.technology_release_revoke(uuid) from public,anon,authenticated;
grant execute on function public.technology_release_approve(uuid,uuid,text,boolean),public.technology_release_revoke(uuid) to authenticated;
