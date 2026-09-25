-- Reviewed personal state. AI proposals never write this table directly.
create table public.ascend_profile_facts (
 person_id uuid not null references public.persons(id) on delete cascade,
 fact_key text not null check(fact_key in ('direction','body','presence','recovery','work','character','connection','coaching','boundary')),
 value text check(value is null or char_length(btrim(value)) between 1 and 500),
 version integer not null check(version>0),
 source_kind text not null check(source_kind in ('user','ai_proposal')),
 source_excerpt text check(source_excerpt is null or char_length(source_excerpt)<=500),
 confirmed_at timestamptz not null default now(),
 primary key(person_id,fact_key)
);
create table public.ascend_profile_revisions (
 request_id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 fact_key text not null,
 old_value text,
 new_value text,
 previous_version integer not null,
 new_version integer not null,
 source_kind text not null,
 source_excerpt text,
 confirmed_at timestamptz not null default now(),
 foreign key(person_id,fact_key) references public.ascend_profile_facts(person_id,fact_key) on delete cascade
);
create index ascend_profile_revisions_owner_time on public.ascend_profile_revisions(person_id,confirmed_at desc);
alter table public.ascend_profile_facts enable row level security;
alter table public.ascend_profile_revisions enable row level security;
revoke all on public.ascend_profile_facts,public.ascend_profile_revisions from public,anon,authenticated;
grant select on public.ascend_profile_facts,public.ascend_profile_revisions to authenticated;
create policy ascend_profile_facts_read on public.ascend_profile_facts for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy ascend_profile_revisions_read on public.ascend_profile_revisions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ascend_profile_confirm(
 p_request uuid,p_key text,p_value text,p_expected_version integer,p_source_kind text,p_excerpt text
) returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid; current_version integer; old_text text; next_version integer; prior record;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_request is null or p_key is null or p_key not in ('direction','body','presence','recovery','work','character','connection','coaching','boundary')
 or p_expected_version is null or p_expected_version<0
 or (p_value is not null and char_length(btrim(p_value)) not between 1 and 500)
 or p_source_kind is null or p_source_kind not in ('user','ai_proposal')
 or (p_excerpt is not null and char_length(p_excerpt)>500) then
  raise exception 'Invalid profile fact' using errcode='22023';
 end if;
 select person_id,fact_key,new_value,previous_version,new_version,source_kind,source_excerpt
 into prior from public.ascend_profile_revisions where request_id=p_request;
 if found then
  if prior.person_id=owner_id and prior.fact_key=p_key and prior.new_value is not distinct from nullif(btrim(p_value),'')
  and prior.previous_version=p_expected_version and prior.source_kind=p_source_kind
  and prior.source_excerpt is not distinct from p_excerpt then return prior.new_version; end if;
  raise exception 'Request already used' using errcode='23505';
 end if;
 select version,value into current_version,old_text from public.ascend_profile_facts where person_id=owner_id and fact_key=p_key;
 if coalesce(current_version,0)<>p_expected_version then raise exception 'Profile changed' using errcode='40001'; end if;
 next_version:=p_expected_version+1;
 insert into public.ascend_profile_facts(person_id,fact_key,value,version,source_kind,source_excerpt)
 values(owner_id,p_key,nullif(btrim(p_value),''),next_version,p_source_kind,p_excerpt)
 on conflict(person_id,fact_key) do update set value=excluded.value,version=excluded.version,
 source_kind=excluded.source_kind,source_excerpt=excluded.source_excerpt,confirmed_at=now();
 insert into public.ascend_profile_revisions(request_id,person_id,fact_key,old_value,new_value,previous_version,new_version,source_kind,source_excerpt)
 values(p_request,owner_id,p_key,old_text,nullif(btrim(p_value),''),p_expected_version,next_version,p_source_kind,p_excerpt);
 return next_version;
end $$;
revoke all on function public.ascend_profile_confirm(uuid,text,text,integer,text,text) from public,anon;
grant execute on function public.ascend_profile_confirm(uuid,text,text,integer,text,text) to authenticated;

-- Shared bounded reservation for non-chat structured model proposals.
create function public.ai_reserve_proposal(p_request uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_request is null then raise exception 'Invalid request' using errcode='22023'; end if;
 if exists(select 1 from public.ai_usage where id=p_request) then raise exception 'Duplicate request' using errcode='23505'; end if;
 if (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '24 hours')>=120
 or (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '1 minute')>=10 then
  raise exception 'Usage limit reached' using errcode='P0001';
 end if;
 insert into public.ai_usage(id,person_id) values(p_request,owner_id);
 return true;
end $$;
revoke all on function public.ai_reserve_proposal(uuid) from public,anon;
grant execute on function public.ai_reserve_proposal(uuid) to authenticated;
