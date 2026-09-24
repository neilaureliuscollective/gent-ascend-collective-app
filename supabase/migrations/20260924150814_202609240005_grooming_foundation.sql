-- One person-owned grooming record. The ritual is written/reviewed by its owner.
create table public.grooming_profiles (
 person_id uuid primary key references public.persons(id) on delete cascade,
 hair_focus text not null default '' check(char_length(hair_focus)<=200),
 beard_focus text not null default '' check(char_length(beard_focus)<=200),
 skin_focus text not null default '' check(char_length(skin_focus)<=200),
 morning_ritual text not null default '' check(char_length(morning_ritual)<=500),
 evening_ritual text not null default '' check(char_length(evening_ritual)<=500),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now()
);
alter table public.grooming_profiles enable row level security;
revoke all on public.grooming_profiles from public,anon,authenticated;
grant select on public.grooming_profiles to authenticated;
grant insert(person_id,hair_focus,beard_focus,skin_focus,morning_ritual,evening_ritual) on public.grooming_profiles to authenticated;
grant update(hair_focus,beard_focus,skin_focus,morning_ritual,evening_ritual) on public.grooming_profiles to authenticated;
create policy grooming_owner_read on public.grooming_profiles for select to authenticated
 using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy grooming_owner_insert on public.grooming_profiles for insert to authenticated
 with check(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy grooming_owner_update on public.grooming_profiles for update to authenticated
 using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())))
 with check(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create function public.version_grooming_profile() returns trigger language plpgsql set search_path='' as $$
begin
 new.version:=old.version+1;
 new.updated_at:=now();
 return new;
end;
$$;
revoke all on function public.version_grooming_profile() from public,anon,authenticated;
create trigger grooming_profile_version before update on public.grooming_profiles
 for each row execute function public.version_grooming_profile();
