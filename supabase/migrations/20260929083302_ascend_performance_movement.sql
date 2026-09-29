create table public.performance_movements (
 person_id uuid not null references public.persons(id) on delete cascade,
 id uuid not null, day date not null, entry jsonb not null, version integer not null check(version>0), updated_at timestamptz not null default now(),
 primary key(person_id,id)
);
create index performance_movements_owner_day on public.performance_movements(person_id,day);
create table public.performance_movement_revisions (
 person_id uuid not null references public.persons(id) on delete cascade, id uuid not null, version integer not null check(version>0),
 entry jsonb not null, request_id uuid not null, fingerprint text not null, recorded_at timestamptz not null default now(),
 primary key(person_id,id,version),unique(person_id,request_id)
);
do $$ declare t text; begin
 foreach t in array array['performance_movements','performance_movement_revisions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))',t);
 end loop;
end $$;
create function performance_private.save_movement(p_request uuid,p_expected integer,p_entry jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare own uuid; zone text; today date; target date; eid uuid; prior public.performance_movements; receipt public.performance_movement_revisions; fingerprint text; ver integer;
begin
 select id,timezone into own,zone from public.persons where auth_user_id=auth.uid() for update;
 if own is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request is null or p_expected is null or p_expected<0 or jsonb_typeof(p_entry) is distinct from 'object'
  or octet_length(p_entry::text)>8192 or not(p_entry ?& array['id','day','kind','minutes','distance','unit','intensity','note','voided'])
  or (select count(*) from jsonb_object_keys(p_entry))<>9 then raise exception 'Invalid activity input' using errcode='22023'; end if;
 if jsonb_typeof(p_entry->'id') is distinct from 'string' or jsonb_typeof(p_entry->'day') is distinct from 'string' or p_entry->>'day' !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(p_entry->'kind') is distinct from 'string' or p_entry->>'kind' not in ('walk','run','cycle','row','swim','cardio','mobility')
  or jsonb_typeof(p_entry->'minutes') is distinct from 'number' or jsonb_typeof(p_entry->'voided') is distinct from 'boolean'
  or jsonb_typeof(p_entry->'unit') is distinct from 'string' or p_entry->>'unit' not in ('km','mi')
  or jsonb_typeof(p_entry->'note') is distinct from 'string' or length(p_entry->>'note')>240 then raise exception 'Invalid activity values' using errcode='22023'; end if;
 if (p_entry->>'minutes')::numeric not between 1 and 1440 or (p_entry->>'minutes')::numeric%1<>0 then raise exception 'Invalid duration' using errcode='22023'; end if;
 if jsonb_typeof(p_entry->'distance')<>'null' then
  if jsonb_typeof(p_entry->'distance')<>'number' then raise exception 'Invalid distance' using errcode='22023'; end if;
  if (p_entry->>'distance')::numeric<=0 or (p_entry->>'distance')::numeric>1000 then raise exception 'Invalid distance' using errcode='22023'; end if;
 end if;
 if jsonb_typeof(p_entry->'intensity')<>'null' and (jsonb_typeof(p_entry->'intensity')<>'string' or p_entry->>'intensity' not in ('easy','moderate','vigorous')) then raise exception 'Invalid intensity' using errcode='22023'; end if;
 if p_entry->>'kind'='mobility' and (jsonb_typeof(p_entry->'distance')<>'null' or jsonb_typeof(p_entry->'intensity')<>'null') then raise exception 'Mobility uses duration only' using errcode='22023'; end if;
 eid:=(p_entry->>'id')::uuid;target:=(p_entry->>'day')::date;
 fingerprint:=encode(sha256(convert_to(p_expected::text||p_entry::text,'UTF8')),'hex');
 select * into receipt from public.performance_movement_revisions where person_id=own and request_id=p_request;
 if found then
  if receipt.fingerprint<>fingerprint then raise exception 'Request ID reused' using errcode='40001'; end if;
  return receipt.version;
 end if;
 today:=(now() at time zone zone)::date;
 select * into prior from public.performance_movements where person_id=own and id=eid;
 if target>today or target<today-27 or prior.day<today-27 then raise exception 'Activity date outside editable window' using errcode='22023'; end if;
 if coalesce(prior.version,0)<>p_expected then raise exception 'Activity changed; reload saved version' using errcode='40001'; end if;
 if (prior.id is null or prior.day<>target) and (select count(*) from public.performance_movements where person_id=own and day=target)>=20 then raise exception 'Twenty activity records per day, including removed records' using errcode='22023'; end if;
 ver:=coalesce(prior.version,0)+1;
 insert into public.performance_movements values(own,eid,target,p_entry,ver,now()) on conflict(person_id,id) do update set day=excluded.day,entry=excluded.entry,version=ver,updated_at=now();
 insert into public.performance_movement_revisions(person_id,id,version,entry,request_id,fingerprint) values(own,eid,ver,p_entry,p_request,fingerprint);
 return ver;
end $$;
revoke all on function performance_private.save_movement(uuid,integer,jsonb) from public,anon;
grant execute on function performance_private.save_movement(uuid,integer,jsonb) to authenticated;
create function public.performance_save_movement(p_request uuid,p_expected integer,p_entry jsonb) returns integer
language sql security invoker set search_path='' as $$ select performance_private.save_movement(p_request,p_expected,p_entry) $$;
revoke all on function public.performance_save_movement(uuid,integer,jsonb) from public,anon;
grant execute on function public.performance_save_movement(uuid,integer,jsonb) to authenticated;

-- Reserved catalog identities cannot be relabeled. Custom identities stay custom.
create function performance_private.catalog_name_valid(eid text,label text) returns boolean language sql immutable set search_path='' as $$
 select case when eid like '77000000-0000-4000-8000-%' then coalesce(('{"77000000-0000-4000-8000-000000000001": "Goblet squat", "77000000-0000-4000-8000-000000000002": "Barbell back squat", "77000000-0000-4000-8000-000000000003": "Leg press", "77000000-0000-4000-8000-000000000004": "Dumbbell Romanian deadlift", "77000000-0000-4000-8000-000000000005": "Barbell Romanian deadlift", "77000000-0000-4000-8000-000000000006": "Hip thrust", "77000000-0000-4000-8000-000000000007": "Push-up", "77000000-0000-4000-8000-000000000008": "Dumbbell bench press", "77000000-0000-4000-8000-000000000009": "Barbell bench press", "77000000-0000-4000-8000-000000000010": "Dumbbell overhead press", "77000000-0000-4000-8000-000000000011": "Cable row", "77000000-0000-4000-8000-000000000012": "One-arm dumbbell row", "77000000-0000-4000-8000-000000000013": "Lat pulldown", "77000000-0000-4000-8000-000000000014": "Pull-up", "77000000-0000-4000-8000-000000000015": "Reverse lunge", "77000000-0000-4000-8000-000000000016": "Dumbbell split squat", "77000000-0000-4000-8000-000000000017": "Calf raise", "77000000-0000-4000-8000-000000000018": "Dumbbell curl"}'::jsonb->>eid)=label,false) else true end
$$;
revoke all on function performance_private.catalog_name_valid(text,text) from public,anon,authenticated;
create function performance_private.plan_metadata_valid(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$ declare e jsonb; begin
 for e in select value from jsonb_array_elements(p->'exercises') loop
  if not performance_private.catalog_name_valid(e->>'id',e->>'name') or (e ? 'progression' and (jsonb_typeof(e->'progression')<>'string' or e->>'progression' not in ('manual','review'))) then return false; end if;
 end loop;return true;
end $$;
revoke all on function performance_private.plan_metadata_valid(jsonb) from public,anon,authenticated;
create function performance_private.guard_exercise_metadata() returns trigger language plpgsql security definer set search_path='' as $$ declare slot jsonb; begin
 if tg_table_name='performance_programs' then
  for slot in select value from jsonb_array_elements(new.sessions) loop
   if not performance_private.plan_metadata_valid(slot->'plan') then raise exception 'Invalid exercise identity or progression setting' using errcode='22023'; end if;
  end loop;
 elsif tg_table_name='performance_plans' then
  if not performance_private.plan_metadata_valid(jsonb_build_object('exercises',new.exercises)) then raise exception 'Invalid exercise identity or progression setting' using errcode='22023'; end if;
 else
  if not performance_private.catalog_name_valid(new.exercise_id::text,new.exercise) then raise exception 'Invalid exercise identity' using errcode='22023'; end if;
 end if; return new;
end $$;
revoke all on function performance_private.guard_exercise_metadata() from public,anon,authenticated;
create trigger exercise_metadata before insert or update on public.performance_plans for each row execute function performance_private.guard_exercise_metadata();
create trigger exercise_metadata before insert or update on public.performance_programs for each row execute function performance_private.guard_exercise_metadata();
create trigger exercise_metadata before insert or update on public.performance_sets for each row execute function performance_private.guard_exercise_metadata();

create or replace function performance_private.progression_state(own uuid) returns jsonb
language plpgsql stable set search_path='' as $$
declare program public.performance_programs; profile public.performance_profiles; checkin public.performance_checkins;
 zone text; today date; slot jsonb; candidate_ex jsonb; history jsonb; evidence jsonb; proposal jsonb;
 result jsonb:='[]'; reason text; gate text; ids uuid[]; token text; good integer; planned integer;
begin
 select timezone into zone from public.persons where id=own;
 today:=(now() at time zone zone)::date;
 select * into program from public.performance_programs where person_id=own;
 if not found then return result; end if;
 select * into profile from public.performance_profiles where person_id=own;
 select * into checkin from public.performance_checkins where person_id=own and day=today;
 if profile.person_id is null then gate:='Set your direction before reviewing progression.';
 elsif length(btrim(profile.limitations))>0 then gate:='Your recorded limitations need an individual review. Targets stay unchanged.';
 elsif exists(select 1 from public.performance_sessions where person_id=own and status='active') then gate:='Finish or abandon your active workout before changing targets.';
 elsif coalesce((select pain from public.performance_sessions where person_id=own and status='complete' order by started_at desc,id desc limit 1),false) then gate:='Discomfort was recorded in your latest workout. Review it before increasing targets.';
 elsif checkin.sleep_minutes is null or checkin.energy is null or checkin.soreness is null then gate:='Record today’s sleep, energy and soreness before considering a change.';
 elsif checkin.sleep_minutes<360 or checkin.energy<3 or checkin.soreness='high' then gate:='Today’s check-in suggests keeping targets steady. This is a cautious rule, not a readiness score.';
 end if;
 for slot in select value from jsonb_array_elements(program.sessions) loop
  proposal:=null; reason:=gate;
  select coalesce(jsonb_agg(x order by x.started_at desc,x.id desc),'[]') into history from (
   select s.id,s.started_at,s.ended_at,s.pain,c.prescription
   from public.performance_sessions s join public.performance_session_context c on c.person_id=s.person_id and c.session_id=s.id
   where s.person_id=own and c.slot_id=(slot->>'id')::uuid and s.status='complete'
   order by s.started_at desc,s.id desc limit 2
  ) x;
  select coalesce(array_agg((h->>'id')::uuid order by n),'{}') into ids from jsonb_array_elements(history) with ordinality x(h,n);
  select coalesce(jsonb_agg(jsonb_build_object('sessionId',h->>'id','day',((h->>'started_at')::timestamptz at time zone zone)::date,
   'mode',h->'prescription'->>'mode','completedSets',(select count(*) from public.performance_sets where person_id=own and session_id=(h->>'id')::uuid and done),
   'plannedSets',(select count(*) from public.performance_sets where person_id=own and session_id=(h->>'id')::uuid)) order by n),'[]')
   into evidence from jsonb_array_elements(history) with ordinality x(h,n);
  if reason is null then
   if cardinality(ids)<2 then reason:='Two completed workouts for this session are needed. Other sessions do not count as substitutes.';
   elsif exists(select 1 from jsonb_array_elements(history) h where ((h->>'started_at')::timestamptz at time zone zone)::date<today-28 or (h->>'ended_at')::timestamptz>now()) then reason:='The latest two workouts must be recent: within 28 days, with no future records.';
   elsif ((history->0->>'started_at')::timestamptz at time zone zone)::date=((history->1->>'started_at')::timestamptz at time zone zone)::date then reason:='Record comparable workouts on two separate days before changing targets.';
   elsif exists(select 1 from jsonb_array_elements(history) h where (h->>'pain')::boolean) then reason:='Discomfort was recorded in these workouts. Targets stay unchanged.';
   elsif exists(select 1 from jsonb_array_elements(history) h where h->'prescription'->>'mode'<>'planned') then reason:='A recent workout was adapted. That is not a failed workout; collect two comparable planned sessions before increasing targets.';
   elsif exists(select 1 from jsonb_array_elements(history) h where h->'prescription'->'originalPlan' is distinct from slot->'plan') then reason:='Targets changed since these workouts. Learn from two workouts on the current session plan.';
   else
    reason:='Keep targets steady. A proposal needs every planned set completed and one exercise meeting its reps at the target load with recorded effort of 7/10 or lower in both workouts. Rep targets of 20 or more stay manual.';
    -- Full sessions must be completed, not merely the candidate exercise.
    select sum((e->>'sets')::integer) into planned from jsonb_array_elements(slot->'plan'->'exercises') e;
    if (select count(*) from public.performance_sets where person_id=own and session_id=any(ids) and done)=planned*2 then
     for candidate_ex in select value from jsonb_array_elements(slot->'plan'->'exercises') loop
      if candidate_ex->>'progression'='manual' then continue; end if;
      select count(*) into good from public.performance_sets where person_id=own and session_id=any(ids)
       and exercise_id=(candidate_ex->>'id')::uuid and done and reps>=(candidate_ex->>'reps')::integer
       and load=(candidate_ex->>'load')::numeric and effort<=7;
      if good=2*(candidate_ex->>'sets')::integer and (candidate_ex->>'reps')::integer<20 then
       reason:='Both workouts met this exercise’s targets at the same load with effort recorded at 7/10 or lower. Try one more rep per set; the rest of the program stays as planned.';
       token:=encode(sha256(convert_to(jsonb_build_object('rule',1,'program',program.version,'profile',profile.version,'checkin',checkin.version,'today',today,'zone',zone,'slot',slot,'sources',history)::text,'UTF8')),'hex');
       proposal:=jsonb_build_object('ruleVersion',1,'token',token,'programVersion',program.version,'exerciseId',candidate_ex->>'id',
        'exercise',candidate_ex->>'name','from',(candidate_ex->>'reps')::integer,'to',(candidate_ex->>'reps')::integer+1,
        'sets',(candidate_ex->>'sets')::integer,'load',(candidate_ex->>'load')::numeric,'unit',slot->'plan'->>'unit','sourceIds',to_jsonb(ids));
       exit;
      end if;
     end loop;
    end if;
   end if;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('slotId',slot->>'id','title',slot->'plan'->>'title',
   'status',case when proposal is null then 'hold' else 'ready' end,'reason',reason,'evidence',evidence,'proposal',proposal));
 end loop;
 return result;
end $$;

create or replace function performance_private.save(p_kind text,p_request uuid,p_expected integer,p_payload jsonb)
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
  if p_payload ? 'sourceSessionIds' and exists(
   select 1 from public.performance_plans p cross join lateral jsonb_array_elements(p.exercises) e
   where p.person_id=own and e->>'progression'='manual'
    and e is distinct from (select value from jsonb_array_elements(p_payload->'exercises') n where n->>'id'=e->>'id')
  ) then raise exception 'This exercise keeps manual targets' using errcode='40001'; end if;
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
