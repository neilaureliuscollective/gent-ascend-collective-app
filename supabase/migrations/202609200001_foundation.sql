-- Application schema only. No developer grant or seed identity in migrations.
create table public.persons (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null unique references auth.users(id) on delete cascade,
 display_name text not null default 'Member' check (length(display_name) between 1 and 100),
 timezone text not null default 'UTC' check (length(timezone) between 1 and 100),
 onboarding_completed boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.membership_accounts (
 person_id uuid primary key references public.persons(id) on delete cascade,
 tier text not null default 'free' check (tier in ('free','aurelius','health')),
 billing_state text not null default 'none' check (billing_state in ('none','trialing','active','past_due','canceled','unpaid','incomplete','paused')),
 beta_access boolean not null default false,
 trial_ends_at timestamptz,
 access_until timestamptz,
 updated_at timestamptz not null default now()
);
create table public.personal_events (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.persons(id) on delete cascade,
 kind text not null check (length(kind) between 1 and 80),
 version integer not null default 1 check (version > 0),
 occurred_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 source text not null check (source in ('user','import','derived','provider')),
 source_record_id uuid
);
create index personal_events_person_time on public.personal_events(person_id,occurred_at desc);

create function public.provision_person() returns trigger
language plpgsql security definer set search_path = '' as $$
declare person uuid;
begin
 insert into public.persons (auth_user_id) values (new.id) returning id into person;
 insert into public.membership_accounts(person_id) values(person);
 return new;
end;
$$;
revoke all on function public.provision_person() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.provision_person();

alter table public.persons enable row level security;
alter table public.membership_accounts enable row level security;
alter table public.personal_events enable row level security;
revoke all on public.persons, public.membership_accounts, public.personal_events from anon, authenticated;
grant select on public.persons, public.membership_accounts, public.personal_events to authenticated;
grant update(display_name,timezone,onboarding_completed) on public.persons to authenticated;
grant all on public.persons, public.membership_accounts, public.personal_events to service_role;
create policy person_select on public.persons for select to authenticated using (auth_user_id = (select auth.uid()));
create policy person_update on public.persons for update to authenticated using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
create policy membership_select on public.membership_accounts for select to authenticated using (exists(select 1 from public.persons where persons.id = person_id and persons.auth_user_id = (select auth.uid())));
create policy events_select on public.personal_events for select to authenticated using (exists(select 1 from public.persons where persons.id = person_id and persons.auth_user_id = (select auth.uid())));
