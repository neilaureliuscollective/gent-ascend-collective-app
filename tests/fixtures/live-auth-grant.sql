-- LOCAL SYNTHETIC DB ONLY. CI invokes this with `supabase db query --local` after reset.
-- This is a real trusted row for the seeded synthetic account, not a JWT/metadata override.
insert into public.founder_access(person_id,grant_reason)
select p.id,'Local synthetic Live Auth acceptance' from public.persons p join auth.users u on u.id=p.auth_user_id
where u.id='00000000-0000-4000-8000-000000000001' and u.email='founder@aurelius.test'
on conflict(person_id) do nothing;
