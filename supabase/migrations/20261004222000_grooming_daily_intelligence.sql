-- Additive daily ritual receipts. Historical check-ins are retained unchanged.
alter table public.grooming_checkins add column local_day date;
create unique index grooming_daily_practice on public.grooming_checkins(person_id,ritual_id,local_day) where done and local_day is not null;
create table public.grooming_practice_requests (
 person_id uuid not null references public.persons(id) on delete cascade,
 id uuid not null, ritual_id uuid not null, ritual_version integer not null,
 local_day date not null, note text not null, checkin_id uuid not null references public.grooming_checkins(id) on delete cascade,
 primary key(person_id,id), foreign key(person_id,ritual_id) references public.grooming_rituals(person_id,id) on delete cascade
);
create table public.grooming_ritual_requests (
 person_id uuid not null references public.persons(id) on delete cascade, id uuid not null,
 payload jsonb not null, ritual_id uuid not null, primary key(person_id,id),
 foreign key(person_id,ritual_id) references public.grooming_rituals(person_id,id) on delete cascade
);
alter table public.grooming_practice_requests enable row level security;
alter table public.grooming_ritual_requests enable row level security;
revoke all on public.grooming_practice_requests, public.grooming_ritual_requests from public,anon,authenticated;
-- Only reviewed RPCs write completions. Existing owner-select policy remains.
revoke insert on public.grooming_checkins from authenticated;
create function public.grooming_record_practice(p_request uuid,p_ritual uuid,p_version integer,p_day date,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_timezone text; v_kind text; v public.grooming_checkins%rowtype; r public.grooming_practice_requests%rowtype;
begin
 select id,timezone into v_person,v_timezone from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or p_request is null or p_ritual is null or p_version is null or p_day is null or p_note is null or length(p_note)>300 then raise exception 'Invalid practice'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text||p_request::text,110));
 select * into r from public.grooming_practice_requests where person_id=v_person and id=p_request;
 if found then
  if (r.ritual_id,r.ritual_version,r.local_day,r.note) is distinct from (p_ritual,p_version,p_day,p_note) then raise exception using errcode='40001',message='Practice request changed'; end if;
  select * into v from public.grooming_checkins where person_id=v_person and id=r.checkin_id;
  return jsonb_build_object('id',v.id,'ritualId',v.ritual_id,'occurredAt',v.occurred_at);
 end if;
 select kind into v_kind from public.grooming_rituals where person_id=v_person and id=p_ritual;
 if v_kind is null then raise exception using errcode='40001',message='Ritual changed'; end if;
 -- Shares the existing ritual-versioning lock to serialize edits with completion.
 perform pg_advisory_xact_lock(hashtextextended(v_person::text||v_kind,102));
 if p_day is distinct from (now() at time zone v_timezone)::date or not exists(select 1 from public.grooming_rituals where person_id=v_person and id=p_ritual and version=p_version and active) then raise exception using errcode='40001',message='Ritual or day changed'; end if;
 -- Adopt an existing legacy completion today without changing/deleting it.
 select * into v from public.grooming_checkins where person_id=v_person and ritual_id=p_ritual and done and coalesce(local_day,(occurred_at at time zone v_timezone)::date)=p_day order by occurred_at limit 1;
 if not found then
  insert into public.grooming_checkins(id,person_id,ritual_id,done,note,local_day) values(p_request,v_person,p_ritual,true,p_note,p_day) returning * into v;
 end if;
 insert into public.grooming_practice_requests values(v_person,p_request,p_ritual,p_version,p_day,p_note,v.id);
 return jsonb_build_object('id',v.id,'ritualId',v.ritual_id,'occurredAt',v.occurred_at);
end $$;
create function public.grooming_practice_feedback(p_checkin uuid,p_note text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_note text;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or p_note is null or p_note not in ('Comfortable','Too much effort','Something irritated') then raise exception 'Invalid feedback'; end if;
 select note into v_note from public.grooming_checkins where person_id=v_person and id=p_checkin and done for update;
 if not found then raise exception 'Practice not found'; end if;
 if v_note=p_note then return true; end if;
 if v_note<>'' then raise exception using errcode='40001',message='Feedback already recorded'; end if;
 update public.grooming_checkins set note=p_note where person_id=v_person and id=p_checkin;
 return true;
end $$;
create function public.grooming_review_ritual(p_request uuid,p_kind text,p_version integer,p_title text,p_steps text,p_source uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_current integer; v_old uuid; v_new uuid; v_payload jsonb; r public.grooming_ritual_requests%rowtype;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or p_request is null or p_kind is null or p_kind not in ('morning','evening','weekly') or p_version is null or p_version<0 or p_title is null or length(trim(p_title)) not between 3 and 100 or p_steps is null or length(trim(p_steps)) not between 3 and 1000 then raise exception 'Invalid ritual'; end if;
 v_payload=jsonb_build_object('kind',p_kind,'version',p_version,'title',trim(p_title),'steps',trim(p_steps),'source',p_source);
 perform pg_advisory_xact_lock(hashtextextended(v_person::text||p_request::text,111));
 select * into r from public.grooming_ritual_requests where person_id=v_person and id=p_request;
 if found then
  if r.payload is distinct from v_payload then raise exception using errcode='40001',message='Review request changed'; end if;
  return r.ritual_id;
 end if;
 if p_source is not null and not exists(select 1 from public.ai_turns where person_id=v_person and id=p_source and status='complete') then raise exception 'Conversation unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text||p_kind,102));
 select id,version into v_old,v_current from public.grooming_rituals where person_id=v_person and kind=p_kind and active;
 if coalesce(v_current,0)<>p_version then raise exception using errcode='40001',message='Ritual changed'; end if;
 v_new=public.grooming_set_ritual(p_kind,p_title,p_steps);
 -- A member-approved revision retains links to the same conceptual ritual.
 update public.grooming_products set ritual_id=v_new where person_id=v_person and ritual_id=v_old;
 insert into public.grooming_ritual_requests values(v_person,p_request,v_payload,v_new);
 return v_new;
end $$;
revoke all on function public.grooming_record_practice(uuid,uuid,integer,date,text),public.grooming_practice_feedback(uuid,text),public.grooming_review_ritual(uuid,text,integer,text,text,uuid) from public,anon;
grant execute on function public.grooming_record_practice(uuid,uuid,integer,date,text),public.grooming_practice_feedback(uuid,text),public.grooming_review_ritual(uuid,text,integer,text,text,uuid) to authenticated;
