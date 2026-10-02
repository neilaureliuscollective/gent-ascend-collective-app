-- Additive Phase 2: versioned training cycles and immutable session decisions.
create table public.performance_programs (
 person_id uuid primary key references public.persons(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 80),
 sessions jsonb not null check(jsonb_typeof(sessions)='array' and jsonb_array_length(sessions) between 1 and 6),
 next_slot_id uuid not null, version integer not null check(version>0), updated_at timestamptz not null default now()
);
create table public.performance_program_revisions (
 person_id uuid not null references public.persons(id) on delete cascade,
 version integer not null, title text not null, sessions jsonb not null,
 recorded_at timestamptz not null default now(), primary key(person_id,version)
);
create table public.performance_session_context (
 person_id uuid not null, session_id uuid not null, program_version integer not null,
 slot_id uuid not null, prescription jsonb not null,
 primary key(person_id,session_id),
 foreign key(person_id,session_id) references public.performance_sessions(person_id,id) on delete cascade,
 foreign key(person_id,program_version) references public.performance_program_revisions(person_id,version)
);
create table performance_private.program_receipts (
 person_id uuid not null references public.persons(id) on delete cascade,
 request_id uuid not null, fingerprint text not null, version integer not null,
 primary key(person_id,request_id)
);
alter table performance_private.program_receipts enable row level security;
revoke all on performance_private.program_receipts from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['performance_programs','performance_program_revisions','performance_session_context'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (person_id in (select id from public.persons where auth_user_id=(select auth.uid())))',t);
 end loop;
end $$;
create function performance_private.valid_plan(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$ declare e jsonb; begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'exercises') is distinct from 'array'
 or jsonb_typeof(p->'title') is distinct from 'string' or length(btrim(p->>'title')) not between 1 and 80
 or p->>'unit' is null or p->>'unit' not in ('kg','lb') then return false; end if;
 if jsonb_array_length(p->'exercises') not between 1 and 12 then return false; end if;
 for e in select value from jsonb_array_elements(p->'exercises') loop
  if jsonb_typeof(e->'id') is distinct from 'string' or (e->>'id')::uuid is null
  or jsonb_typeof(e->'name') is distinct from 'string' or length(btrim(e->>'name')) not between 1 and 70
  or jsonb_typeof(e->'sets') is distinct from 'number' or (e->>'sets')::numeric not between 1 and 8 or (e->>'sets')::numeric%1<>0
  or jsonb_typeof(e->'reps') is distinct from 'number' or (e->>'reps')::numeric not between 1 and 30 or (e->>'reps')::numeric%1<>0
  or jsonb_typeof(e->'load') is distinct from 'number' or (e->>'load')::numeric not between 0 and 1500
  or jsonb_typeof(e->'restSeconds') is distinct from 'number' or (e->>'restSeconds')::numeric not between 15 and 600 or (e->>'restSeconds')::numeric%1<>0 then return false; end if;
 end loop;
 return (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(p->'exercises'))=jsonb_array_length(p->'exercises');
 exception when others then return false;
end $$;
-- Mirrors the client preview; database verifies the accepted decision independently.
create function performance_private.prepare_plan_v1(p jsonb, mode text, budget integer) returns jsonb
language plpgsql immutable set search_path='' as $$
declare a jsonb:=p->'exercises'; i integer; estimate numeric; target integer;
begin
 if mode='lighter' then
  for i in 0..jsonb_array_length(a)-1 loop
   a:=jsonb_set(a,array[i::text,'sets'],to_jsonb(greatest(1,(a->i->>'sets')::integer-1)));
  end loop;
 elsif mode='shorter' then
  loop
   select ceil(5+sum(1+(value->>'sets')::integer*(45+(value->>'restSeconds')::integer)/60.0)) into estimate from jsonb_array_elements(a);
   exit when estimate<=budget;
   target:=null;
   for i in reverse jsonb_array_length(a)-1..0 loop
    if (a->i->>'sets')::integer>1 then target:=i; exit; end if;
   end loop;
   if target is not null then a:=jsonb_set(a,array[target::text,'sets'],to_jsonb((a->target->>'sets')::integer-1));
   elsif jsonb_array_length(a)>1 then a:=a-(jsonb_array_length(a)-1);
   else exit; end if;
  end loop;
 end if;
 return jsonb_set(p,'{exercises}',a);
end $$;
revoke all on function performance_private.valid_plan(jsonb),performance_private.prepare_plan_v1(jsonb,text,integer) from public,anon,authenticated;
create function performance_private.save_program(p_kind text,p_request uuid,p_expected integer,p_payload jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare own uuid; ver integer; current_program public.performance_programs; item jsonb; c jsonb; original jsonb; expected jsonb;
 prior_context jsonb; sid uuid; slot uuid; pv integer; receipt performance_private.program_receipts; fingerprint text;
 next_id uuid; idx integer; actual_sets jsonb; desired_sets jsonb;
begin
 select id into own from public.persons where auth_user_id=auth.uid() for update;
 if own is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request is null or p_expected is null or p_expected<0 or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>65536 then raise exception 'Invalid input' using errcode='22023'; end if;
 if p_kind='session' then
  select prescription into prior_context from public.performance_session_context where person_id=own and session_id=(p_payload->>'id')::uuid;
  if prior_context is not null and prior_context is distinct from p_payload->'prescription' then raise exception 'Session decision changed' using errcode='40001'; end if;
 end if;
 if p_kind<>'program' and not(p_kind='session' and p_payload ? 'prescription') then
  if exists(select 1 from performance_private.program_receipts where person_id=own and request_id=p_request) then raise exception 'Request ID reused' using errcode='40001'; end if;
  return performance_private.save(p_kind,p_request,p_expected,p_payload);
 end if;
 fingerprint:=encode(sha256(convert_to(p_kind||p_expected::text||p_payload::text,'UTF8')),'hex');
 select * into receipt from performance_private.program_receipts where person_id=own and request_id=p_request;
 if found then
  if receipt.fingerprint<>fingerprint then raise exception 'Request ID reused' using errcode='40001'; end if;
  return receipt.version;
 end if;
 if exists(select 1 from performance_private.receipts where person_id=own and request_id=p_request) then raise exception 'Request ID reused' using errcode='40001'; end if;
 select * into current_program from public.performance_programs where person_id=own;
 if p_kind='program' then
  if coalesce(current_program.version,0)<>p_expected then raise exception 'Program changed' using errcode='40001'; end if;
  if jsonb_typeof(p_payload->'title') is distinct from 'string' or jsonb_typeof(p_payload->'sessions') is distinct from 'array' then raise exception 'Invalid program' using errcode='22023'; end if;
  if jsonb_array_length(p_payload->'sessions') not between 1 and 6 then raise exception 'Invalid program' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_payload->'sessions') loop
   if (item->>'id')::uuid is null or not performance_private.valid_plan(item->'plan') then raise exception 'Invalid session plan' using errcode='22023'; end if;
  end loop;
  if (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(p_payload->'sessions'))<>jsonb_array_length(p_payload->'sessions') then raise exception 'Duplicate session' using errcode='22023'; end if;
  ver:=coalesce(current_program.version,0)+1;
  next_id:=current_program.next_slot_id;
  if next_id is null or not exists(select 1 from jsonb_array_elements(p_payload->'sessions') s where (s->>'id')::uuid=next_id) then next_id:=(p_payload->'sessions'->0->>'id')::uuid; end if;
  insert into public.performance_programs values(own,p_payload->>'title',p_payload->'sessions',next_id,ver,now())
  on conflict(person_id) do update set title=excluded.title,sessions=excluded.sessions,next_slot_id=excluded.next_slot_id,version=excluded.version,updated_at=excluded.updated_at;
  insert into public.performance_program_revisions values(own,ver,p_payload->>'title',p_payload->'sessions',now());
 else
  c:=p_payload->'prescription'; sid:=(p_payload->>'id')::uuid; slot:=(c->>'slotId')::uuid; pv:=(c->>'programVersion')::integer;
  if c->'ruleVersion' is distinct from '1'::jsonb or pv is null or slot is null or jsonb_typeof(c->'timeBudget') is distinct from 'number' or (c->>'timeBudget')::numeric%1<>0
  or (c->>'timeBudget')::integer not between 10 and 120 or c->>'mode' is null or c->>'mode' not in ('planned','shorter','lighter') then raise exception 'Invalid decision' using errcode='22023'; end if;
  select s.value->'plan' into original from public.performance_program_revisions r, lateral jsonb_array_elements(r.sessions) s
   where r.person_id=own and r.version=pv and (s.value->>'id')::uuid=slot;
  if original is null then raise exception 'Program source unavailable' using errcode='42501'; end if;
  expected:=performance_private.prepare_plan_v1(original,c->>'mode',(c->>'timeBudget')::integer);
  if c->'originalPlan' is distinct from original or c->'plan' is distinct from expected or p_payload->>'title' is distinct from expected->>'title' or p_payload->>'unit' is distinct from expected->>'unit' or (p_payload->>'planVersion')::integer is distinct from pv then raise exception 'Decision does not match source' using errcode='22023'; end if;
  if prior_context is null and exists(select 1 from public.performance_sessions where id=sid) then raise exception 'Cannot attach decision to existing session' using errcode='40001'; end if;
  select jsonb_agg(jsonb_build_object('exerciseId',e->>'id','exercise',e->>'name','targetReps',(e->>'reps')::integer,'targetLoad',(e->>'load')::numeric) order by n,k) into desired_sets
   from jsonb_array_elements(expected->'exercises') with ordinality x(e,n), lateral generate_series(1,(e->>'sets')::integer) k;
  select jsonb_agg(jsonb_build_object('exerciseId',e->>'exerciseId','exercise',e->>'exercise','targetReps',(e->>'targetReps')::integer,'targetLoad',(e->>'targetLoad')::numeric) order by n) into actual_sets
   from jsonb_array_elements(p_payload->'sets') with ordinality x(e,n);
  if desired_sets is distinct from actual_sets then raise exception 'Session targets changed' using errcode='22023'; end if;
  ver:=performance_private.save('session',p_request,p_expected,p_payload-'prescription');
  insert into public.performance_session_context values(own,sid,pv,slot,c) on conflict(person_id,session_id) do nothing;
  if p_payload->>'status'='complete' and current_program.version=pv and current_program.next_slot_id=slot then
   select (n-1)::integer into idx from jsonb_array_elements(current_program.sessions) with ordinality x(e,n) where (e->>'id')::uuid=slot;
   next_id:=(current_program.sessions->((idx+1)%jsonb_array_length(current_program.sessions))->>'id')::uuid;
   update public.performance_programs set next_slot_id=next_id where person_id=own;
  end if;
 end if;
 insert into performance_private.program_receipts values(own,p_request,fingerprint,ver);
 return ver;
end $$;
revoke all on function performance_private.save_program(text,uuid,integer,jsonb) from public,anon;
grant execute on function performance_private.save_program(text,uuid,integer,jsonb) to authenticated;
create or replace function public.performance_save(p_kind text,p_request uuid,p_expected integer,p_payload jsonb)
returns integer language sql security invoker set search_path='' as $$ select performance_private.save_program(p_kind,p_request,p_expected,p_payload) $$;
