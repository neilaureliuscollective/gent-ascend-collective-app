-- Founder authority is a trusted, person-bound assignment, not a signup order,
-- email match, membership tier, or user-editable Auth metadata.
-- Grant through a reviewed administrative operation after verifying the Auth user.
create table public.founder_access (
 person_id uuid primary key references public.persons(id) on delete cascade,
 granted_at timestamptz not null default now(),
 grant_reason text not null check (length(btrim(grant_reason)) between 8 and 200)
);
alter table public.founder_access enable row level security;
revoke all on public.founder_access from anon, authenticated;
grant select on public.founder_access to authenticated;
grant all on public.founder_access to service_role;
create policy founder_access_self_read on public.founder_access
 for select to authenticated
 using (exists (select 1 from public.persons p
               where p.id = person_id and p.auth_user_id = (select auth.uid())));
-- There is intentionally no authenticated INSERT, UPDATE, or DELETE policy.
