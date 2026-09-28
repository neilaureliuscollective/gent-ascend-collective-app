-- Deliberately chosen daily routines. Observations remain in versioned check-ins.
create table public.performance_recovery_routines (
 person_id uuid not null references public.persons(id) on delete cascade,
 day date not null, timezone text not null, routine jsonb not null,
 version integer not null check(version>0), updated_at timestamptz not null default now(),
 primary key(person_id,day)
);
create table public.performance_recovery_revisions (
 person_id uuid not null references public.persons(id) on delete cascade,
 day date not null, version integer not null check(version>0), routine jsonb not null,
 request_id uuid not null, fingerprint text not null, recorded_at timestamptz not null default now(),
 primary key(person_id,day,version), unique(person_id,request_id)
);
do $$ declare t text; begin
 foreach t in array array['performance_recovery_routines','performance_recovery_revisions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))',t);
 end loop;
end $$;
create function performance_private.save_recovery_routine(p_request uuid,p_expected integer,p_routine jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare own uuid; zone text; today date; target date; prior public.performance_recovery_routines; receipt public.performance_recovery_revisions; fingerprint text; ver integer;
begin
 select id,timezone into own,zone from public.persons where auth_user_id=auth.uid() for update;
 if own is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request is null or p_expected is null or p_expected<0 or jsonb_typeof(p_routine) is distinct from 'object'
  or octet_length(p_routine::text)>8192 or not(p_routine ?& array['day','action','minutes','cue','outcome'])
  or (select count(*) from jsonb_object_keys(p_routine))<>5 then raise exception 'Invalid routine input' using errcode='22023'; end if;
 if jsonb_typeof(p_routine->'day') is distinct from 'string' or p_routine->>'day' !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(p_routine->'action') is distinct from 'string' or p_routine->>'action' not in ('quiet-time','screen-break','gentle-mobility','rest')
  or jsonb_typeof(p_routine->'minutes') is distinct from 'number'
  or jsonb_typeof(p_routine->'cue') is distinct from 'string' or length(p_routine->>'cue')>120
  or (jsonb_typeof(p_routine->'outcome') is distinct from 'null' and (jsonb_typeof(p_routine->'outcome') is distinct from 'string' or p_routine->>'outcome' not in ('done','partial','skipped'))) then
  raise exception 'Invalid routine values' using errcode='22023'; end if;
 if (p_routine->>'minutes')::numeric not between 5 and 60 or (p_routine->>'minutes')::numeric%1<>0 then raise exception 'Invalid minutes' using errcode='22023'; end if;
 target:=(p_routine->>'day')::date;
 fingerprint:=encode(sha256(convert_to(p_expected::text||p_routine::text,'UTF8')),'hex');
 select * into receipt from public.performance_recovery_revisions where person_id=own and request_id=p_request;
 if found then
  if receipt.fingerprint<>fingerprint then raise exception 'Request ID reused' using errcode='40001'; end if;
  return receipt.version;
 end if;
 today:=(now() at time zone zone)::date;
 if target>today or target<today-27 then raise exception 'Routine date outside editable window' using errcode='22023'; end if;
 select * into prior from public.performance_recovery_routines where person_id=own and day=target;
 if coalesce(prior.version,0)<>p_expected then raise exception 'Routine changed; reload saved version' using errcode='40001'; end if;
 if target<today and (prior.version is null or (prior.routine-'outcome') is distinct from (p_routine-'outcome')) then
  raise exception 'Past routine plans are fixed; only follow-through can change' using errcode='22023'; end if;
 if target=today and jsonb_typeof(p_routine->'outcome')<>'null' then raise exception 'Review follow-through from the next day' using errcode='22023'; end if;
 ver:=coalesce(prior.version,0)+1;
 insert into public.performance_recovery_routines values(own,target,zone,p_routine,ver,now())
 on conflict(person_id,day) do update set routine=excluded.routine,version=ver,updated_at=now();
 insert into public.performance_recovery_revisions(person_id,day,version,routine,request_id,fingerprint) values(own,target,ver,p_routine,p_request,fingerprint);
 return ver;
end $$;
revoke all on function performance_private.save_recovery_routine(uuid,integer,jsonb) from public,anon;
grant execute on function performance_private.save_recovery_routine(uuid,integer,jsonb) to authenticated;
create function public.performance_save_recovery_routine(p_request uuid,p_expected integer,p_routine jsonb) returns integer
language sql security invoker set search_path='' as $$ select performance_private.save_recovery_routine(p_request,p_expected,p_routine) $$;
revoke all on function public.performance_save_recovery_routine(uuid,integer,jsonb) from public,anon;
grant execute on function public.performance_save_recovery_routine(uuid,integer,jsonb) to authenticated;
