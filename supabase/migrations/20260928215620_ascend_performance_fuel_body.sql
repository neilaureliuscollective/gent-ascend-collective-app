-- User-entered reference targets, never an inferred nutrition prescription.
create table public.performance_fuel_targets (
 person_id uuid primary key references public.persons(id) on delete cascade,
 targets jsonb not null, version integer not null check(version>0), updated_at timestamptz not null default now()
);
create table public.performance_fuel_target_revisions (
 person_id uuid not null references public.persons(id) on delete cascade,
 version integer not null check(version>0), targets jsonb not null,
 request_id uuid not null, fingerprint text not null, recorded_at timestamptz not null default now(),
 primary key(person_id,version), unique(person_id,request_id)
);
do $$ declare t text; begin
 foreach t in array array['performance_fuel_targets','performance_fuel_target_revisions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))',t);
 end loop;
end $$;
create function performance_private.save_fuel_targets(p_request uuid,p_expected integer,p_targets jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare own uuid; ver integer; prior integer; receipt public.performance_fuel_target_revisions; fingerprint text; k text; value numeric;
begin
 select id into own from public.persons where auth_user_id=auth.uid() for update;
 if own is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request is null or p_expected is null or p_expected<0 or jsonb_typeof(p_targets) is distinct from 'object'
  or octet_length(p_targets::text)>8192
  or not (p_targets ?& array['calories','protein','waterMl','goalWeight','unit'])
  or (select count(*) from jsonb_object_keys(p_targets))<>5
  or jsonb_typeof(p_targets->'unit') is distinct from 'string' or p_targets->>'unit' not in ('kg','lb') then
  raise exception 'Invalid target input' using errcode='22023'; end if;
 foreach k in array array['calories','protein','waterMl','goalWeight'] loop
  if jsonb_typeof(p_targets->k)='null' then continue; end if;
  if jsonb_typeof(p_targets->k) is distinct from 'number' then raise exception 'Invalid target value' using errcode='22023'; end if;
  value:=(p_targets->>k)::numeric;
  if value<=0 or value>(case when k='protein' then 1000 when k='goalWeight' then 700 else 15000 end)
   or (k='goalWeight' and value<20) or (k in ('calories','waterMl') and value%1<>0) then
   raise exception 'Target value out of range' using errcode='22023'; end if;
 end loop;
 fingerprint:=encode(sha256(convert_to(p_expected::text||p_targets::text,'UTF8')),'hex');
 select * into receipt from public.performance_fuel_target_revisions where person_id=own and request_id=p_request;
 if found then
  if receipt.fingerprint<>fingerprint then raise exception 'Request ID reused' using errcode='40001'; end if;
  return receipt.version;
 end if;
 select version into prior from public.performance_fuel_targets where person_id=own;
 if coalesce(prior,0)<>p_expected then raise exception 'Targets changed; reload saved version' using errcode='40001'; end if;
 ver:=coalesce(prior,0)+1;
 insert into public.performance_fuel_targets values(own,p_targets,ver,now())
 on conflict(person_id) do update set targets=excluded.targets,version=ver,updated_at=now();
 insert into public.performance_fuel_target_revisions(person_id,version,targets,request_id,fingerprint) values(own,ver,p_targets,p_request,fingerprint);
 return ver;
end $$;
revoke all on function performance_private.save_fuel_targets(uuid,integer,jsonb) from public,anon;
grant execute on function performance_private.save_fuel_targets(uuid,integer,jsonb) to authenticated;
create function public.performance_save_fuel_targets(p_request uuid,p_expected integer,p_targets jsonb) returns integer
language sql security invoker set search_path='' as $$ select performance_private.save_fuel_targets(p_request,p_expected,p_targets) $$;
revoke all on function public.performance_save_fuel_targets(uuid,integer,jsonb) from public,anon;
grant execute on function public.performance_save_fuel_targets(uuid,integer,jsonb) to authenticated;
