-- User-entered wellness/planning records. No inferred scores or clinical data.
create table public.daily_entries (
 person_id uuid not null references public.persons(id) on delete cascade,
 day date not null, timezone text not null,
 energy smallint check (energy between 1 and 5),
 sleep_minutes smallint check (sleep_minutes between 0 and 1440),
 intention text not null default '' check (char_length(intention)<=160),
 reflection text not null default '' check (char_length(reflection)<=500),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(),
 primary key(person_id,day)
);
create table public.daily_actions (
 person_id uuid not null, day date not null, id uuid not null,
 title text not null check(char_length(btrim(title)) between 1 and 100),
 done boolean not null default false, position smallint not null check(position between 0 and 4),
 primary key(person_id,day,id), unique(person_id,day,position),
 constraint daily_actions_entry_fkey foreign key(person_id,day) references public.daily_entries(person_id,day) on delete cascade
);
alter table public.daily_entries enable row level security;
alter table public.daily_actions enable row level security;
revoke all on public.daily_entries,public.daily_actions from public,anon,authenticated;
grant select on public.daily_entries,public.daily_actions to authenticated;
create policy daily_entry_owner on public.daily_entries for select to authenticated using
 (person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy daily_action_owner on public.daily_actions for select to authenticated using
 (person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.daily_save(p_day date,p_version integer,p_energy integer,p_sleep integer,p_intention text,p_reflection text,p_actions jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid; zone text; current_version integer; item jsonb; pos integer:=0;
begin
 -- Serialize per-owner mutations, including the first save of a day.
 select id,timezone into owner_id,zone from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_day is null or p_day<>(current_timestamp at time zone zone)::date then
   raise exception 'The local day changed. Reload before saving.' using errcode='22023';
 end if;
 if p_version is null or p_version<0 or (p_energy is not null and p_energy not between 1 and 5)
 or (p_sleep is not null and p_sleep not between 0 and 1440)
 or p_intention is null or char_length(p_intention)>160
 or p_reflection is null or char_length(p_reflection)>500
 or p_actions is null or jsonb_typeof(p_actions)<>'array' then
   raise exception 'Invalid daily record' using errcode='22023';
 end if;
 if jsonb_array_length(p_actions)>5 then raise exception 'Five actions maximum' using errcode='22023'; end if;
 select version into current_version from public.daily_entries where person_id=owner_id and day=p_day;
 if coalesce(current_version,0)<>p_version then
   raise exception 'Daily record changed. Reload before saving.' using errcode='40001';
 end if;
 current_version:=coalesce(current_version,0)+1;
 insert into public.daily_entries(person_id,day,timezone,energy,sleep_minutes,intention,reflection,version)
 values(owner_id,p_day,zone,p_energy,p_sleep,btrim(p_intention),btrim(p_reflection),current_version)
 on conflict(person_id,day) do update set timezone=zone,energy=p_energy,sleep_minutes=p_sleep,
 intention=btrim(p_intention),reflection=btrim(p_reflection),version=current_version,updated_at=now();
 delete from public.daily_actions where person_id=owner_id and day=p_day;
 for item in select value from jsonb_array_elements(p_actions) loop
   if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'title') is distinct from 'string'
   or jsonb_typeof(item->'done') is distinct from 'boolean' then raise exception 'Invalid action' using errcode='22023'; end if;
   insert into public.daily_actions(person_id,day,id,title,done,position)
   values(owner_id,p_day,(item->>'id')::uuid,btrim(item->>'title'),(item->>'done')::boolean,pos);
   pos:=pos+1;
 end loop;
 return current_version;
end $$;
revoke all on function public.daily_save(date,integer,integer,integer,text,text,jsonb) from public,anon;
grant execute on function public.daily_save(date,integer,integer,integer,text,text,jsonb) to authenticated;
