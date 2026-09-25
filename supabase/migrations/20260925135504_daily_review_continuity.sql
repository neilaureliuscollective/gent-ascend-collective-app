-- Confirmed, revisable evening review. Model drafts never reach this table directly.
create table public.daily_reviews (
 person_id uuid not null, day date not null,
 progress text not null default '' check(char_length(progress)<=240),
 blocker text not null default '' check(char_length(blocker)<=240),
 tomorrow text not null default '' check(char_length(tomorrow)<=240),
 source_kind text not null default 'user' check(source_kind='user'),
 source_day_version integer not null check(source_day_version>0),
 version integer not null default 1 check(version>0),
 confirmed_at timestamptz not null default now(),
 primary key(person_id,day),
 constraint daily_reviews_entry_fkey foreign key(person_id,day) references public.daily_entries(person_id,day) on delete cascade,
 constraint daily_reviews_content check(char_length(btrim(progress))+char_length(btrim(blocker))+char_length(btrim(tomorrow))>0)
);
create table public.daily_review_revisions (
 request_id uuid primary key,
 person_id uuid not null, day date not null,
 version integer not null check(version>0),
 progress text not null, blocker text not null, tomorrow text not null,
 source_kind text not null default 'user' check(source_kind='user'), source_day_version integer not null,
 confirmed_at timestamptz not null default now(),
 foreign key(person_id,day) references public.daily_entries(person_id,day) on delete cascade,
 unique(person_id,day,version)
);
create index daily_review_revisions_owner_day on public.daily_review_revisions(person_id,day,version desc);
alter table public.daily_reviews enable row level security;
alter table public.daily_review_revisions enable row level security;
revoke all on public.daily_reviews,public.daily_review_revisions from public,anon,authenticated;
grant select on public.daily_reviews,public.daily_review_revisions to authenticated;
create policy daily_reviews_owner on public.daily_reviews for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy daily_review_revisions_owner on public.daily_review_revisions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.daily_confirm_review(
 p_request uuid,p_day date,p_expected_review_version integer,p_source_day_version integer,
 p_progress text,p_blocker text,p_tomorrow text
) returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid; zone text; current_day_version integer; current_review_version integer; old_revision record; next_version integer;
begin
 select id,timezone into owner_id,zone from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into old_revision from public.daily_review_revisions where request_id=p_request;
 if found then
  if old_revision.person_id=owner_id and old_revision.day=p_day and old_revision.version=p_expected_review_version+1
   and old_revision.source_day_version=p_source_day_version and old_revision.progress=btrim(p_progress)
   and old_revision.blocker=btrim(p_blocker) and old_revision.tomorrow=btrim(p_tomorrow) then return old_revision.version; end if;
  raise exception 'Request already used with different content' using errcode='23505';
 end if;
 if p_request is null or p_day is null or p_day<>(current_timestamp at time zone zone)::date
 or p_expected_review_version is null or p_expected_review_version<0
 or p_source_day_version is null or p_source_day_version<1
 or p_progress is null or p_blocker is null or p_tomorrow is null
 or char_length(p_progress)>240 or char_length(p_blocker)>240 or char_length(p_tomorrow)>240
 or char_length(btrim(p_progress))+char_length(btrim(p_blocker))+char_length(btrim(p_tomorrow))=0 then
  raise exception 'Invalid review' using errcode='22023';
 end if;
 select version into current_day_version from public.daily_entries where person_id=owner_id and day=p_day;
 if current_day_version is distinct from p_source_day_version then
  raise exception 'Daily record changed. Reload before confirming.' using errcode='40001'; end if;
 select version into current_review_version from public.daily_reviews where person_id=owner_id and day=p_day;
 if coalesce(current_review_version,0)<>p_expected_review_version then
  raise exception 'Review changed. Reload before confirming.' using errcode='40001'; end if;
 next_version:=coalesce(current_review_version,0)+1;
 insert into public.daily_reviews(person_id,day,progress,blocker,tomorrow,source_day_version,version)
 values(owner_id,p_day,btrim(p_progress),btrim(p_blocker),btrim(p_tomorrow),p_source_day_version,next_version)
 on conflict(person_id,day) do update set progress=excluded.progress,blocker=excluded.blocker,
 tomorrow=excluded.tomorrow,source_day_version=excluded.source_day_version,
 version=excluded.version,confirmed_at=now();
 insert into public.daily_review_revisions(request_id,person_id,day,version,progress,blocker,tomorrow,source_day_version)
 values(p_request,owner_id,p_day,next_version,btrim(p_progress),btrim(p_blocker),btrim(p_tomorrow),p_source_day_version);
 return next_version;
end $$;
revoke all on function public.daily_confirm_review(uuid,date,integer,integer,text,text,text) from public,anon;
grant execute on function public.daily_confirm_review(uuid,date,integer,integer,text,text,text) to authenticated;
