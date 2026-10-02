-- One genuine visitor direction, imported once under the authenticated owner's lock.
create table public.onboarding_claims (
 person_id uuid not null references public.persons(id) on delete cascade,
 request_id uuid not null,
 focus text not null check(focus in ('body','presence','focus')),
 day date not null,
 intention text not null check(char_length(intention)<=160),
 created_at timestamptz not null default now(),
 primary key(person_id,request_id)
);
alter table public.onboarding_claims enable row level security;
revoke all on public.onboarding_claims from public,anon,authenticated;
grant select on public.onboarding_claims to authenticated;
create policy claim_owner on public.onboarding_claims for select to authenticated using
 (person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
-- Definer is necessary to compose the existing protected daily RPC and insert its receipt
-- atomically. No client owner argument; no direct table writes or anonymous execution.
create function public.onboarding_claim(p_request uuid,p_focus text,p_intention text,p_timezone text,p_created timestamptz,p_replace boolean,p_expected integer,p_day date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; zone text; finished boolean; target_day date; entry_version integer; existing text; receipt public.onboarding_claims; saved_version integer; daily public.daily_entries; actions jsonb;
begin
 select id,timezone,onboarding_completed into owner_id,zone,finished from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_request is null or p_focus is null or p_focus not in ('body','presence','focus') or p_intention is null or char_length(btrim(p_intention))>160 or p_created is null or p_created<now()-interval '24 hours' or p_created>now()+interval '1 minute' or p_replace is null or p_expected is null or p_expected<0 then raise exception 'Invalid draft' using errcode='22023'; end if;
 select * into receipt from public.onboarding_claims where person_id=owner_id and request_id=p_request;
 if found then
   if receipt.intention<>btrim(p_intention) or receipt.focus<>p_focus then raise exception 'Draft changed after saving' using errcode='22023'; end if;
   return jsonb_build_object('status','saved','id',p_request,'day',receipt.day,'intention',receipt.intention,'version',0,'focus',receipt.focus);
 end if;
 if not finished and not exists(select 1 from public.daily_entries where person_id=owner_id) then
   if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
   zone:=p_timezone;
 end if;
 target_day:=(current_timestamp at time zone zone)::date;
 select * into daily from public.daily_entries where person_id=owner_id and day=target_day;
 entry_version:=coalesce(daily.version,0); existing:=coalesce(daily.intention,'');
 if (p_day is not null and p_day<>target_day) or (p_day is null and (p_created at time zone zone)::date<>target_day) then
   return jsonb_build_object('status','day_changed','id',p_request,'day',target_day,'intention',existing,'version',entry_version,'focus',p_focus);
 end if;
 if btrim(p_intention)<>'' and existing<>'' and existing<>btrim(p_intention) and (not p_replace or p_expected<>entry_version) then
   return jsonb_build_object('status','conflict','id',p_request,'day',target_day,'intention',existing,'version',entry_version,'focus',p_focus);
 end if;
 if not finished then update public.persons set timezone=zone where id=owner_id; end if;
 saved_version:=entry_version;
 if btrim(p_intention)<>'' and existing<>btrim(p_intention) then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'done',done) order by position),'[]'::jsonb) into actions from public.daily_actions where person_id=owner_id and day=target_day;
   saved_version:=public.daily_save(target_day,entry_version,daily.energy,daily.sleep_minutes,btrim(p_intention),coalesce(daily.reflection,''),actions);
 end if;
 insert into public.onboarding_claims(person_id,request_id,focus,day,intention) values(owner_id,p_request,p_focus,target_day,btrim(p_intention));
 update public.persons set onboarding_completed=true where id=owner_id;
 return jsonb_build_object('status','saved','id',p_request,'day',target_day,'intention',btrim(p_intention),'version',saved_version,'focus',p_focus);
end $$;
revoke all on function public.onboarding_claim(uuid,text,text,text,timestamptz,boolean,integer,date) from public,anon;
grant execute on function public.onboarding_claim(uuid,text,text,text,timestamptz,boolean,integer,date) to authenticated;
