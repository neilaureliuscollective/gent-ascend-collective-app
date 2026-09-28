-- Phase 3. One database evaluator serves both preview and atomic acceptance.
-- Thresholds are conservative product rules, not validated readiness physiology.
create index performance_context_slot on public.performance_session_context(person_id,slot_id,session_id);
create table public.performance_progression_decisions (
 person_id uuid not null references public.persons(id) on delete cascade,
 request_id uuid not null, fingerprint text not null,
 from_version integer not null, to_version integer not null,
 evidence jsonb not null, created_at timestamptz not null default now(),
 primary key(person_id,request_id),
 foreign key(person_id,from_version) references public.performance_program_revisions(person_id,version),
 foreign key(person_id,to_version) references public.performance_program_revisions(person_id,version)
);
alter table public.performance_progression_decisions enable row level security;
revoke all on public.performance_progression_decisions from public,anon,authenticated;
grant select on public.performance_progression_decisions to authenticated;
create policy owner_read on public.performance_progression_decisions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function performance_private.progression_state(own uuid) returns jsonb
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
revoke all on function performance_private.progression_state(uuid) from public,anon,authenticated;
create function performance_private.progression_read() returns jsonb
language plpgsql security definer stable set search_path='' as $$ declare own uuid; begin
 select id into own from public.persons where auth_user_id=auth.uid();
 if own is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return performance_private.progression_state(own);
end $$;
revoke all on function performance_private.progression_read() from public,anon;
grant execute on function performance_private.progression_read() to authenticated;
create function public.performance_progression() returns jsonb language sql security invoker set search_path=''
 as $$ select performance_private.progression_read() $$;
revoke all on function public.performance_progression() from public,anon;
grant execute on function public.performance_progression() to authenticated;

create function performance_private.progression_accept(p_request uuid,p_expected integer,p_slot uuid,p_token text) returns integer
language plpgsql security definer set search_path='' as $$
declare own uuid; fingerprint text; receipt public.performance_progression_decisions; review jsonb; program public.performance_programs;
 updated jsonb; i integer; j integer; ver integer;
begin
 -- Shared lock with all Performance writers: evidence cannot change between evaluation and commit.
 select id into own from public.persons where auth_user_id=auth.uid() for update;
 if own is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request is null or p_expected is null or p_expected<1 or p_slot is null or p_token is null or length(p_token)<>64 then raise exception 'Invalid input' using errcode='22023'; end if;
 fingerprint:=encode(sha256(convert_to(p_expected::text||p_slot::text||p_token,'UTF8')),'hex');
 select * into receipt from public.performance_progression_decisions where person_id=own and request_id=p_request;
 if found then
  if receipt.fingerprint<>fingerprint then raise exception 'Request ID reused' using errcode='40001'; end if;
  return receipt.to_version;
 end if;
 select * into program from public.performance_programs where person_id=own;
 if program.version is distinct from p_expected then raise exception 'Program changed' using errcode='40001'; end if;
 select value into review from jsonb_array_elements(performance_private.progression_state(own)) where value->>'slotId'=p_slot::text;
 if review is null or review->>'status'<>'ready' or review->'proposal'->>'token' is distinct from p_token then raise exception 'Evidence changed; reload review' using errcode='40001'; end if;
 updated:=jsonb_build_object('title',program.title,'sessions',program.sessions);
 select (n-1)::integer into i from jsonb_array_elements(program.sessions) with ordinality x(e,n) where e->>'id'=p_slot::text;
 select (n-1)::integer into j from jsonb_array_elements(program.sessions->i->'plan'->'exercises') with ordinality x(e,n) where e->>'id'=review->'proposal'->>'exerciseId';
 updated:=jsonb_set(updated,array['sessions',i::text,'plan','exercises',j::text,'reps'],review->'proposal'->'to');
 ver:=performance_private.save_program('program',p_request,p_expected,updated);
 insert into public.performance_progression_decisions values(own,p_request,fingerprint,p_expected,ver,review,now());
 insert into public.personal_events(person_id,kind,occurred_at,source,source_record_id) values(own,'performance.progression.approved',now(),'user',p_request);
 return ver;
end $$;
revoke all on function performance_private.progression_accept(uuid,integer,uuid,text) from public,anon;
grant execute on function performance_private.progression_accept(uuid,integer,uuid,text) to authenticated;
create function public.performance_progression_accept(p_request uuid,p_expected integer,p_slot uuid,p_token text) returns integer
language sql security invoker set search_path='' as $$ select performance_private.progression_accept(p_request,p_expected,p_slot,p_token) $$;
revoke all on function public.performance_progression_accept(uuid,integer,uuid,text) from public,anon;
grant execute on function public.performance_progression_accept(uuid,integer,uuid,text) to authenticated;
