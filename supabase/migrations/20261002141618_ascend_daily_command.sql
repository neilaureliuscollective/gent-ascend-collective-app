-- Daily Command records suggestions separately from canonical domain facts.
-- No clinical values, goals, plans or AI memories are written by this function.
create table public.daily_command_records (
 person_id uuid not null references public.persons(id) on delete cascade,
 day date not null, version integer not null check(version > 0),
 arrival jsonb not null check(jsonb_typeof(arrival)='object'),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=24000),
 outcome jsonb check(outcome is null or jsonb_typeof(outcome)='object'),
 updated_at timestamptz not null default now(), primary key(person_id,day)
);
create table public.daily_command_revisions (
 request_id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 day date not null, version integer not null, kind text not null,
 arrival jsonb not null, snapshot jsonb not null, outcome jsonb,
 recorded_at timestamptz not null default now(), unique(person_id,day,version)
);
alter table public.daily_command_records enable row level security;
alter table public.daily_command_revisions enable row level security;
revoke all on public.daily_command_records,public.daily_command_revisions from public,anon,authenticated;
grant select on public.daily_command_records,public.daily_command_revisions to authenticated;
create policy command_owner on public.daily_command_records for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy command_revision_owner on public.daily_command_revisions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create function public.daily_command_save(p_request uuid,p_day date,p_version integer,p_kind text,p_arrival jsonb,p_snapshot jsonb,p_outcome jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid; zone text; old public.daily_command_records; prior public.daily_command_revisions; next_version integer; decision jsonb;
begin
 select id,timezone into owner_id,zone from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into prior from public.daily_command_revisions where request_id=p_request;
 if found then
  if prior.person_id=owner_id and prior.day=p_day and prior.version=p_version+1 and prior.kind=p_kind and prior.arrival=p_arrival and prior.outcome is not distinct from p_outcome then return prior.version; end if;
  raise exception 'Request reused' using errcode='23505';
 end if;
 if p_request is null or p_day is null or p_day<>(now() at time zone zone)::date or p_version is null or p_version<0
 or p_kind is null or p_kind not in ('arrival','outcome') or p_arrival is null or jsonb_typeof(p_arrival)<>'object'
 or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>24000
 or (p_snapshot->>'day') is distinct from p_day::text or (p_snapshot->>'ruleVersion') is distinct from '1'
 or coalesce(p_snapshot->>'state','') not in ('RECOVER','STEADY','READY','PUSH')
 or jsonb_typeof(p_snapshot->'decisions') is distinct from 'array' then raise exception 'Invalid command' using errcode='22023'; end if;
 if jsonb_array_length(p_snapshot->'decisions') not between 1 and 5 then raise exception 'Invalid decisions' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(p_arrival))<>5 or not p_arrival ?& array['sleepMinutes','energy','soreness','bandwidth','minutes']
 or (p_arrival->'sleepMinutes'<>'null'::jsonb and (jsonb_typeof(p_arrival->'sleepMinutes')<>'number' or (p_arrival->>'sleepMinutes')::numeric not between 0 and 1440 or (p_arrival->>'sleepMinutes')::numeric<>trunc((p_arrival->>'sleepMinutes')::numeric)))
 or (p_arrival->'energy'<>'null'::jsonb and (jsonb_typeof(p_arrival->'energy')<>'number' or (p_arrival->>'energy')::numeric not between 1 and 5 or (p_arrival->>'energy')::numeric<>trunc((p_arrival->>'energy')::numeric)))
 or (p_arrival->'soreness'<>'null'::jsonb and coalesce(p_arrival->>'soreness','') not in ('none','mild','high'))
 or (p_arrival->'bandwidth'<>'null'::jsonb and coalesce(p_arrival->>'bandwidth','') not in ('limited','steady','open'))
 or (p_arrival->'minutes'<>'null'::jsonb and (jsonb_typeof(p_arrival->'minutes')<>'number' or (p_arrival->>'minutes')::numeric not between 5 and 240 or (p_arrival->>'minutes')::numeric<>trunc((p_arrival->>'minutes')::numeric))) then raise exception 'Invalid arrival' using errcode='22023'; end if;
 select * into old from public.daily_command_records where person_id=owner_id and day=p_day;
 if coalesce(old.version,0)<>p_version then raise exception 'Command changed' using errcode='40001'; end if;
 if p_kind='arrival' and p_outcome is not null then raise exception 'Unexpected outcome' using errcode='22023'; end if;
 if p_kind='outcome' then
  if old.version is null or p_arrival is distinct from old.arrival or p_snapshot is distinct from old.snapshot
   or p_outcome is null or jsonb_typeof(p_outcome)<>'object' or octet_length(p_outcome::text)>3000
   or not p_outcome ?& array['decisions','fit','tomorrow'] or (select count(*) from jsonb_object_keys(p_outcome))<>3
   or jsonb_typeof(p_outcome->'decisions') is distinct from 'array' or jsonb_typeof(p_outcome->'tomorrow') is distinct from 'string'
   or char_length(p_outcome->>'tomorrow')>240 or (p_outcome->'fit'<>'null'::jsonb and coalesce(p_outcome->>'fit','') not in ('right','too-much','too-light','unsure')) then raise exception 'Invalid outcome' using errcode='22023'; end if;
  if jsonb_array_length(p_outcome->'decisions')>5 or (select count(distinct x->>'id') from jsonb_array_elements(p_outcome->'decisions') x)<>jsonb_array_length(p_outcome->'decisions') then raise exception 'Duplicate outcomes' using errcode='22023'; end if;
  for decision in select * from jsonb_array_elements(p_outcome->'decisions') loop
   if coalesce(decision->>'result','') not in ('done','partial','skipped','unknown') or not exists(select 1 from jsonb_array_elements(old.snapshot->'decisions') x where x->>'id'=decision->>'id') then raise exception 'Unknown decision' using errcode='22023'; end if;
  end loop;
 end if;
 next_version:=p_version+1;
 if next_version>30 then raise exception 'Daily revision limit' using errcode='22023'; end if;
 insert into public.daily_command_records(person_id,day,version,arrival,snapshot,outcome) values(owner_id,p_day,next_version,p_arrival,p_snapshot,p_outcome)
 on conflict(person_id,day) do update set version=excluded.version,arrival=excluded.arrival,snapshot=excluded.snapshot,outcome=excluded.outcome,updated_at=now();
 insert into public.daily_command_revisions(request_id,person_id,day,version,kind,arrival,snapshot,outcome) values(p_request,owner_id,p_day,next_version,p_kind,p_arrival,p_snapshot,p_outcome);
 return next_version;
end $$;
revoke all on function public.daily_command_save(uuid,date,integer,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.daily_command_save(uuid,date,integer,text,jsonb,jsonb,jsonb) to authenticated;
