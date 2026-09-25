-- Private founding cohort. Auth invitations are sent separately by the Auth admin.
create table public.pilot_invitations (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254),
 status text not null default 'pending' check (status in ('pending','claimed','revoked')),
 person_id uuid unique references public.persons(id) on delete set null,
 created_at timestamptz not null default now(),
 claimed_at timestamptz,
 check ((status = 'claimed') = (person_id is not null and claimed_at is not null))
);
create table public.pilot_feedback (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.persons(id) on delete cascade,
 category text not null check (category in ('friction','idea','working')),
 message text not null check (length(btrim(message)) between 10 and 1500),
 created_at timestamptz not null default now()
);
create index pilot_feedback_recent on public.pilot_feedback(created_at desc);
alter table public.pilot_invitations enable row level security;
alter table public.pilot_feedback enable row level security;
revoke all on public.pilot_invitations, public.pilot_feedback from anon, authenticated;
grant select on public.pilot_invitations, public.pilot_feedback to authenticated;
grant all on public.pilot_invitations, public.pilot_feedback to service_role;
create policy pilot_invitations_founder_read on public.pilot_invitations for select to authenticated
 using (exists (select 1 from public.persons p join public.founder_access f on f.person_id=p.id where p.auth_user_id=(select auth.uid())));
create policy pilot_feedback_owner_or_founder_read on public.pilot_feedback for select to authenticated
 using (exists (select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid()))
 or exists (select 1 from public.persons p join public.founder_access f on f.person_id=p.id where p.auth_user_id=(select auth.uid())));

create function public.pilot_reserve(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(p_email)); v_id uuid;
begin
 if auth.uid() is null or not exists (select 1 from public.persons p join public.founder_access f on f.person_id=p.id where p.auth_user_id=auth.uid()) then
  raise exception 'Founder access required';
 end if;
 if v_email is null or length(v_email) not between 3 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception 'Invalid email';
 end if;
 insert into public.pilot_invitations(email) values(v_email) on conflict (email) do nothing returning id into v_id;
 if v_id is null then raise exception 'An invitation for this email already exists'; end if;
 return v_id;
end; $$;

create function public.pilot_claim() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_person uuid; v_email text; v_confirmed timestamptz; v_invitation uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select lower(btrim(u.email)), u.email_confirmed_at, p.id into v_email,v_confirmed,v_person
 from auth.users u join public.persons p on p.auth_user_id=u.id where u.id=auth.uid();
 if v_person is null or v_confirmed is null then raise exception 'Verified email required'; end if;
 select id into v_invitation from public.pilot_invitations
 where email=v_email and (status='pending' or (status='claimed' and person_id=v_person)) for update;
 if v_invitation is null then return false; end if;
 update public.pilot_invitations set status='claimed',person_id=v_person,claimed_at=coalesce(claimed_at,now()) where id=v_invitation;
 update public.membership_accounts set beta_access=true,updated_at=now() where person_id=v_person;
 return true;
end; $$;

create function public.pilot_submit_feedback(p_category text,p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_person uuid; v_id uuid;
begin
 select p.id into v_person from public.persons p join public.membership_accounts m on m.person_id=p.id
 where p.auth_user_id=auth.uid() and m.beta_access=true;
 if v_person is null then raise exception 'Pilot access required'; end if;
 if p_category not in ('friction','idea','working') or p_message is null or length(btrim(p_message)) not between 10 and 1500 then
  raise exception 'Invalid feedback';
 end if;
 insert into public.pilot_feedback(person_id,category,message) values(v_person,p_category,btrim(p_message)) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.pilot_reserve(text),public.pilot_claim(),public.pilot_submit_feedback(text,text) from public,anon,authenticated;
grant execute on function public.pilot_reserve(text),public.pilot_claim(),public.pilot_submit_feedback(text,text) to authenticated;
