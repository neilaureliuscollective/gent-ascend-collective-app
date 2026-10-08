-- Additive preview-only foundation. No hosted grant or billing changes.
create table public.technology_grants(person_id uuid primary key references public.persons(id) on delete cascade, expires_at timestamptz not null);
create table public.technology_projects(id uuid primary key,person_id uuid not null references public.persons(id) on delete cascade,mission_id uuid,mission_revision integer,revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(person_id,id),foreign key(person_id,mission_id) references public.intelligence_missions(person_id,id) on delete set null(mission_id),check(revision between 1 and 100));
create table public.technology_site_versions(id uuid primary key,person_id uuid not null,project_id uuid not null,revision integer not null,brief jsonb not null,reviewed_at timestamptz,created_at timestamptz not null default now(),unique(project_id,revision),foreign key(person_id,project_id) references public.technology_projects(person_id,id) on delete cascade);
create table public.technology_runs(id uuid primary key,person_id uuid not null,project_id uuid not null,source_revision integer not null,status text not null default 'reserved' check(status in('reserved','succeeded','uncertain')),reserved_micros bigint not null default 1000000 check(reserved_micros=1000000),actual_micros bigint check(actual_micros between 0 and 1000000),input_tokens integer,output_tokens integer,created_at timestamptz not null default now(),foreign key(person_id,project_id) references public.technology_projects(person_id,id) on delete cascade);
create index technology_versions_owner on public.technology_site_versions(person_id,project_id,revision);
create index technology_runs_owner on public.technology_runs(person_id,created_at);
create unique index technology_one_running on public.technology_runs(person_id) where status='reserved';
create function public.technology_validate_brief(b jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb; u text;
begin
 if b is null or jsonb_typeof(b)<>'object' or (select count(*) from jsonb_object_keys(b))<>9 or not(b ?& array['name','industry','vision','headline','about','services','hours','contact','bookingUrl']) then return false; end if;
 if jsonb_typeof(b->'industry')<>'string' or b->>'industry' not in('grooming-beauty','professional-services') then return false; end if;
 if jsonb_typeof(b->'services')<>'array' or jsonb_array_length(b->'services') not between 1 and 12 then return false; end if;
 for s in select jsonb_array_elements(b->'services') loop
 if jsonb_typeof(s)<>'object' or (select count(*) from jsonb_object_keys(s))<>3 or not(s ?& array['name','description','price']) or jsonb_typeof(s->'name')<>'string' or length(trim(s->>'name')) not between 2 and 100 or jsonb_typeof(s->'description')<>'string' or length(s->>'description')>500 or jsonb_typeof(s->'price')<>'string' or length(s->>'price')>50 then return false; end if;
 end loop;
 for u in select unnest(array['name','vision','headline','about','hours','contact','bookingUrl']) loop if jsonb_typeof(b->u)<>'string' then return false; end if; end loop;
 if length(trim(b->>'name')) not between 2 and 100 or length(trim(b->>'vision')) not between 10 and 2000 or length(trim(b->>'headline')) not between 3 and 150 or length(trim(b->>'about')) not between 10 and 2000 or length(b->>'hours')>500 or length(b->>'contact')>500 or length(b->>'bookingUrl')>500 then return false; end if;
 u:=b->>'bookingUrl'; if u<>'' and (u ~ '[[:space:]]' or u ~ '^https://[^/?#]*@' or u !~ '^https://[^/@:[:space:]]+([:/?#]|$)' or u ~* '^https://(localhost|127\.|0\.|\[|[^/]*\.local([:/]|$))') then return false; end if;
 return true;
end $$;
alter table public.technology_site_versions add constraint technology_valid_brief check(public.technology_validate_brief(brief));
create function public.technology_owner() returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid;
begin select id into p from public.persons where auth_user_id=auth.uid();
 if p is null or not(exists(select 1 from public.founder_access where person_id=p) or exists(select 1 from public.technology_grants where person_id=p and expires_at>now())) then raise exception 'Technology access is not enabled'; end if; return p; end $$;
create function public.technology_save(p_id uuid,p_version uuid,p_expected integer,p_brief jsonb,p_mission uuid default null,p_mission_revision integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid; proj public.technology_projects; v public.technology_site_versions;
begin
 owner:=public.technology_owner(); perform 1 from public.persons where id=owner for update;
 select * into v from public.technology_site_versions where id=p_version;
 if found then if p_expected=0 and not exists(select 1 from public.technology_projects where id=p_id and mission_id is not distinct from p_mission and mission_revision is not distinct from p_mission_revision) then raise exception 'Save source changed'; end if; if v.person_id<>owner or v.project_id<>p_id or v.revision<>p_expected+1 or v.brief<>p_brief then raise exception 'Save request changed'; end if; return v.id; end if;
 if not public.technology_validate_brief(p_brief) then raise exception 'Invalid business brief'; end if;
 if p_expected=0 then
 if exists(select 1 from public.technology_projects where id=p_id) or (select count(*) from public.technology_projects where person_id=owner)>=5 then raise exception 'Project limit or changed request'; end if;
 if p_mission is not null and not exists(select 1 from public.intelligence_missions where id=p_mission and person_id=owner and revision=p_mission_revision) then raise exception 'Mission changed'; end if;
 if p_mission is null and p_mission_revision is not null then raise exception 'Invalid Mission'; end if;
 insert into public.technology_projects(id,person_id,mission_id,mission_revision) values(p_id,owner,p_mission,p_mission_revision);
 else
 select * into proj from public.technology_projects where id=p_id and person_id=owner for update;
 if not found or proj.revision<>p_expected or p_expected>=100 or exists(select 1 from public.technology_runs where project_id=p_id and status='reserved') then raise exception 'Project changed or generation unresolved'; end if;
 update public.technology_projects set revision=revision+1,updated_at=now() where id=p_id;
 end if;
 insert into public.technology_site_versions(id,person_id,project_id,revision,brief) values(p_version,owner,p_id,p_expected+1,p_brief); return p_version;
end $$;
create function public.technology_review(p_id uuid,p_version uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=public.technology_owner();
begin perform 1 from public.technology_projects where id=p_id and person_id=owner for update;
 if not exists(select 1 from public.technology_projects p join public.technology_site_versions v on v.project_id=p.id and v.revision=p.revision where p.id=p_id and p.person_id=owner and v.id=p_version) then raise exception 'Review version changed'; end if;
 update public.technology_site_versions set reviewed_at=coalesce(reviewed_at,now()) where id=p_version; return p_version; end $$;
create function public.technology_reserve(p_id uuid,p_run uuid,p_expected integer) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid:=public.technology_owner(); r public.technology_runs; total bigint;
begin perform 1 from public.persons where id=owner for update;
 select * into r from public.technology_runs where id=p_run;
 if found then raise exception 'Run already recorded; reload without retrying'; end if;
 if not exists(select 1 from public.technology_projects p join public.technology_site_versions v on v.project_id=p.id and v.revision=p.revision where p.id=p_id and p.person_id=owner and p.revision=p_expected and p.revision<100 and v.reviewed_at is not null) then raise exception 'Review the current brief before generation'; end if;
 if exists(select 1 from public.technology_runs where person_id=owner and status in('reserved','uncertain')) then raise exception 'Previous generation needs reconciliation'; end if;
 select coalesce(sum(coalesce(actual_micros,reserved_micros)),0) into total from public.technology_runs where person_id=owner and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if total+1000000>10000000 then raise exception 'Monthly pilot allowance reached'; end if;
 insert into public.technology_runs(id,person_id,project_id,source_revision) values(p_run,owner,p_id,p_expected);return p_run;end $$;
-- Only trusted server broker can report usage/refund a reservation or append AI output.
create function public.technology_settle(p_run uuid,p_owner uuid,p_brief jsonb,p_input integer,p_output integer) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.technology_runs; cost bigint; v uuid:=gen_random_uuid();
begin select * into r from public.technology_runs where id=p_run and person_id=p_owner for update;
 if not found or r.status<>'reserved' then raise exception 'Run cannot be settled'; end if;
 perform 1 from public.technology_projects where id=r.project_id and person_id=p_owner and revision=r.source_revision for update;
 if not found then raise exception 'Project changed'; end if;
 if p_brief is null or p_input is null or p_output is null or p_input<0 or p_output<0 then update public.technology_runs set status='uncertain' where id=p_run;return p_run;end if;
 cost:=p_input::bigint*2+p_output::bigint*10;
 if cost>1000000 or not public.technology_validate_brief(p_brief) then update public.technology_runs set status='uncertain' where id=p_run;return p_run;end if;
 insert into public.technology_site_versions(id,person_id,project_id,revision,brief) values(v,p_owner,r.project_id,r.source_revision+1,p_brief);
 update public.technology_projects set revision=revision+1,updated_at=now() where id=r.project_id;
 update public.technology_runs set status='succeeded',actual_micros=cost,input_tokens=p_input,output_tokens=p_output where id=p_run;return v;end $$;
do $$ declare t text; begin foreach t in array array['technology_grants','technology_projects','technology_site_versions','technology_runs'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy technology_owner_read on public.%I for select to authenticated using (person_id in (select id from public.persons where auth_user_id=(select auth.uid())))',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
revoke all on function public.technology_owner(),public.technology_validate_brief(jsonb),public.technology_save(uuid,uuid,integer,jsonb,uuid,integer),public.technology_review(uuid,uuid),public.technology_reserve(uuid,uuid,integer),public.technology_settle(uuid,uuid,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.technology_save(uuid,uuid,integer,jsonb,uuid,integer),public.technology_review(uuid,uuid),public.technology_reserve(uuid,uuid,integer) to authenticated;
grant execute on function public.technology_settle(uuid,uuid,jsonb,integer,integer) to service_role;

-- Administrative pilot provisioning only, never authenticated clients.
grant all on public.technology_grants to service_role;
