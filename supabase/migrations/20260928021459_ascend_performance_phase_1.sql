-- Performance facts are person-owned, nonclinical, and distinct from AI memory.
create schema if not exists performance_private;
revoke all on schema performance_private from public,anon;
grant usage on schema performance_private to authenticated;
create table public.performance_profiles (
 person_id uuid primary key references public.persons(id) on delete cascade,
 goal text not null check(goal in ('strength','muscle','consistency','body-composition')),
 experience text not null check(experience in ('new','returning','consistent')),
 days_per_week integer not null check(days_per_week between 1 and 6),
 minutes integer not null check(minutes between 10 and 120),
 equipment text not null check(equipment in ('gym','dumbbells','bodyweight')),
 limitations text not null check(length(limitations)<=500),
 unit text not null check(unit in ('kg','lb')),
 version integer not null check(version>0), updated_at timestamptz not null default now()
);
create table public.performance_plans (
 person_id uuid primary key references public.persons(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 80),
 unit text not null check(unit in ('kg','lb')),
 exercises jsonb not null check(jsonb_typeof(exercises)='array' and jsonb_array_length(exercises) between 1 and 12),
 version integer not null check(version>0), updated_at timestamptz not null default now()
);
create table public.performance_plan_revisions (
 person_id uuid not null references public.persons(id) on delete cascade,
 version integer not null, title text not null, unit text not null, exercises jsonb not null,
 reason text not null, source_session_ids uuid[] not null default '{}', recorded_at timestamptz not null default now(),
 primary key(person_id,version)
);
create table public.performance_checkins (
 person_id uuid not null references public.persons(id) on delete cascade,
 day date not null, timezone text not null,
 sleep_minutes integer check(sleep_minutes between 0 and 1440), energy integer check(energy between 1 and 5),
 soreness text check(soreness in ('none','mild','high')),
 weight numeric check(weight between 20 and 700), unit text not null check(unit in ('kg','lb')),
 calories integer check(calories between 0 and 15000), protein numeric check(protein between 0 and 1000),
 water_ml integer check(water_ml between 0 and 15000), nutrition_complete boolean not null,
 source text not null default 'user' check(source='user'),
 version integer not null check(version>0), updated_at timestamptz not null default now(),
 primary key(person_id,day)
);
create table public.performance_sessions (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 80),
 plan_version integer not null check(plan_version>0),
 started_at timestamptz not null, ended_at timestamptz,
 status text not null check(status in ('active','complete','abandoned')),
 unit text not null check(unit in ('kg','lb')), pain boolean not null,
 note text not null check(length(note)<=500),
 version integer not null check(version>0), updated_at timestamptz not null default now(),
 unique(person_id,id), check(ended_at is null or ended_at>=started_at),
 check((status='active' and ended_at is null) or (status<>'active' and ended_at is not null))
);
create index performance_sessions_person_time on public.performance_sessions(person_id,started_at desc);
create table public.performance_sets (
 person_id uuid not null, session_id uuid not null, id uuid not null,
 position integer not null check(position between 0 and 95), exercise_id uuid not null,
 exercise text not null check(length(btrim(exercise)) between 1 and 70),
 target_reps integer not null check(target_reps between 1 and 30), target_load numeric not null check(target_load between 0 and 1500),
 reps integer check(reps between 0 and 100), load numeric check(load between 0 and 1500),
 effort integer check(effort between 1 and 10), done boolean not null,
 primary key(person_id,session_id,id), unique(person_id,session_id,position),
 foreign key(person_id,session_id) references public.performance_sessions(person_id,id) on delete cascade,
 check(not done or (reps is not null and reps>0 and load is not null))
);
-- Receipts make a replay after a lost acknowledgment safe, including initial inserts.
create table performance_private.receipts (
 person_id uuid not null references public.persons(id) on delete cascade,
 request_id uuid not null, fingerprint text not null, version integer not null,
 primary key(person_id,request_id)
);
alter table performance_private.receipts enable row level security;
revoke all on performance_private.receipts from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['performance_profiles','performance_plans','performance_plan_revisions','performance_checkins','performance_sessions','performance_sets'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (person_id in (select id from public.persons where auth_user_id=(select auth.uid())))',t);
 end loop;
end $$;
create function performance_private.save(p_kind text,p_request uuid,p_expected integer,p_payload jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare own uuid; zone text; ver integer; prior integer; fingerprint text; receipt performance_private.receipts;
 item jsonb; pos integer:=0; sid uuid; started timestamptz; ended timestamptz; existing public.performance_sessions;
begin
 select id,timezone into own,zone from public.persons where auth_user_id=auth.uid() for update;
 if own is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request is null or p_expected is null or p_expected<0 or p_payload is null or jsonb_typeof(p_payload)<>'object'
 or p_kind is null or p_kind not in ('profile','plan','checkin','session') or octet_length(p_payload::text)>65536 then
 raise exception 'Invalid input' using errcode='22023'; end if;
 fingerprint:=encode(sha256(convert_to(p_kind||p_expected::text||p_payload::text,'UTF8')),'hex');
 select * into receipt from performance_private.receipts where person_id=own and request_id=p_request;
 if found then
  if receipt.fingerprint<>fingerprint then raise exception 'Request ID reused' using errcode='40001'; end if;
  return receipt.version;
 end if;
 if p_kind='profile' then
  select version into prior from public.performance_profiles where person_id=own;
 elsif p_kind='plan' then
  select version into prior from public.performance_plans where person_id=own;
 elsif p_kind='checkin' then
  if (p_payload->>'day')::date>(now() at time zone zone)::date or (p_payload->>'day')::date<(now() at time zone zone)::date-30 then
   raise exception 'Check-in date out of range' using errcode='22023'; end if;
  select version into prior from public.performance_checkins where person_id=own and day=(p_payload->>'day')::date;
 else
  sid:=(p_payload->>'id')::uuid;
  select * into existing from public.performance_sessions where id=sid;
  if found and existing.person_id<>own then raise exception 'Not authorized' using errcode='42501'; end if;
  prior:=existing.version;
  if existing.status is not null and existing.status<>'active' then raise exception 'Session already finished' using errcode='40001'; end if;
  started:=(p_payload->>'startedAt')::timestamptz; ended:=(p_payload->>'endedAt')::timestamptz;
  if started>now()+interval '5 minutes' or started<now()-interval '90 days' or ended>now()+interval '5 minutes' then raise exception 'Invalid time' using errcode='22023'; end if;
  if existing.id is not null and (started<>existing.started_at or (p_payload->>'unit')<>existing.unit or (p_payload->>'planVersion')::integer<>existing.plan_version) then raise exception 'Session identity changed' using errcode='40001'; end if;
 end if;
 if coalesce(prior,0)<>p_expected then raise exception 'Record changed' using errcode='40001'; end if;
 ver:=coalesce(prior,0)+1;
 if p_kind='profile' then
  insert into public.performance_profiles values(own,p_payload->>'goal',p_payload->>'experience',(p_payload->>'daysPerWeek')::integer,(p_payload->>'minutes')::integer,p_payload->>'equipment',p_payload->>'limitations',p_payload->>'unit',ver,now())
  on conflict(person_id) do update set goal=excluded.goal,experience=excluded.experience,days_per_week=excluded.days_per_week,minutes=excluded.minutes,equipment=excluded.equipment,limitations=excluded.limitations,unit=excluded.unit,version=ver,updated_at=now();
 elsif p_kind='plan' then
  if jsonb_typeof(p_payload->'exercises') is distinct from 'array' then raise exception 'Invalid plan' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_payload->'exercises') loop
   if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string'
   or jsonb_typeof(item->'sets') is distinct from 'number' or jsonb_typeof(item->'reps') is distinct from 'number'
   or jsonb_typeof(item->'load') is distinct from 'number' or jsonb_typeof(item->'restSeconds') is distinct from 'number'
   or item->>'id' is null or (item->>'id')::uuid is null or item->>'name' is null or length(btrim(item->>'name')) not between 1 and 70
   or (item->>'sets') is null or (item->>'sets')::integer not between 1 and 8
   or (item->>'reps') is null or (item->>'reps')::integer not between 1 and 30
   or (item->>'load') is null or (item->>'load')::numeric not between 0 and 1500
   or (item->>'restSeconds') is null or (item->>'restSeconds')::integer not between 15 and 600 then raise exception 'Invalid exercise' using errcode='22023'; end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_payload->'exercises'))<>jsonb_array_length(p_payload->'exercises') then raise exception 'Duplicate exercise' using errcode='22023'; end if;
  insert into public.performance_plans values(own,p_payload->>'title',p_payload->>'unit',p_payload->'exercises',ver,now())
  on conflict(person_id) do update set title=excluded.title,unit=excluded.unit,exercises=excluded.exercises,version=ver,updated_at=now();
  if p_payload ? 'sourceSessionIds' and (jsonb_typeof(p_payload->'sourceSessionIds')<>'array' or jsonb_array_length(p_payload->'sourceSessionIds')<>2) then raise exception 'Invalid sources' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(p_payload->'sourceSessionIds','[]'::jsonb)) s where not exists(select 1 from public.performance_sessions w where w.id=s.value::uuid and w.person_id=own)) then raise exception 'Invalid sources' using errcode='42501'; end if;
  if p_payload ? 'sourceSessionIds' then
   if (p_payload->>'evidenceDay')::date is distinct from (now() at time zone zone)::date
   or (p_payload->>'profileVersion')::integer is distinct from (select version from public.performance_profiles where person_id=own)
   or (p_payload->>'checkinVersion')::integer is distinct from coalesce((select version from public.performance_checkins where person_id=own and day=(now() at time zone zone)::date),0)
   or array(select value::uuid from jsonb_array_elements_text(p_payload->'sourceSessionIds')) is distinct from array(select id from public.performance_sessions where person_id=own and status='complete' order by started_at desc limit 2)
   then raise exception 'Evidence changed' using errcode='40001'; end if;
  end if;
  insert into public.performance_plan_revisions(person_id,version,title,unit,exercises,reason,source_session_ids)
  values(own,ver,p_payload->>'title',p_payload->>'unit',p_payload->'exercises',left(coalesce(p_payload->>'changeReason','Plan reviewed and saved by you'),500),array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'sourceSessionIds','[]'::jsonb))));
 elsif p_kind='checkin' then
  insert into public.performance_checkins(person_id,day,timezone,sleep_minutes,energy,soreness,weight,unit,calories,protein,water_ml,nutrition_complete,version)
  values(own,(p_payload->>'day')::date,zone,(p_payload->>'sleepMinutes')::integer,(p_payload->>'energy')::integer,p_payload->>'soreness',(p_payload->>'weight')::numeric,p_payload->>'unit',(p_payload->>'calories')::integer,(p_payload->>'protein')::numeric,(p_payload->>'waterMl')::integer,(p_payload->>'nutritionComplete')::boolean,ver)
  on conflict(person_id,day) do update set timezone=zone,sleep_minutes=excluded.sleep_minutes,energy=excluded.energy,soreness=excluded.soreness,weight=excluded.weight,unit=excluded.unit,calories=excluded.calories,protein=excluded.protein,water_ml=excluded.water_ml,nutrition_complete=excluded.nutrition_complete,version=ver,updated_at=now();
 else
  if jsonb_typeof(p_payload->'sets') is distinct from 'array' or jsonb_array_length(p_payload->'sets') not between 1 and 96 then raise exception 'Invalid sets' using errcode='22023'; end if;
  if p_payload->>'status'='complete' and not exists(select 1 from jsonb_array_elements(p_payload->'sets') s where (s->>'done')::boolean) then raise exception 'No completed sets' using errcode='22023'; end if;
  insert into public.performance_sessions values(sid,own,p_payload->>'title',(p_payload->>'planVersion')::integer,started,ended,p_payload->>'status',p_payload->>'unit',(p_payload->>'pain')::boolean,p_payload->>'note',ver,now())
  on conflict(id) do update set title=excluded.title,ended_at=excluded.ended_at,status=excluded.status,pain=excluded.pain,note=excluded.note,version=ver,updated_at=now();
  delete from public.performance_sets where person_id=own and session_id=sid;
  for item in select value from jsonb_array_elements(p_payload->'sets') loop
   insert into public.performance_sets values(own,sid,(item->>'id')::uuid,pos,(item->>'exerciseId')::uuid,item->>'exercise',(item->>'targetReps')::integer,(item->>'targetLoad')::numeric,(item->>'reps')::integer,(item->>'load')::numeric,(item->>'effort')::integer,(item->>'done')::boolean);
   pos:=pos+1;
  end loop;
  if p_payload->>'status'='complete' then
   insert into public.personal_events(person_id,kind,occurred_at,source,source_record_id) values(own,'performance.session.completed',ended,'user',sid);
  end if;
 end if;
 insert into performance_private.receipts values(own,p_request,fingerprint,ver);
 return ver;
end $$;
revoke all on function performance_private.save(text,uuid,integer,jsonb) from public,anon;
grant execute on function performance_private.save(text,uuid,integer,jsonb) to authenticated;
create function public.performance_save(p_kind text,p_request uuid,p_expected integer,p_payload jsonb)
returns integer language sql security invoker set search_path='' as $$ select performance_private.save(p_kind,p_request,p_expected,p_payload) $$;
revoke all on function public.performance_save(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.performance_save(text,uuid,integer,jsonb) to authenticated;
