-- LOCAL SYNTHETIC DATA ONLY. Hosted deploys apply migrations, never this seed.
-- Passwords are random per machine and assigned by scripts/dev-setup.mjs.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token)
values
 ('00000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','founder@aurelius.test','', '2026-01-01', '{"provider":"email","providers":["email"]}', '{}','2026-01-01','2026-01-01','','','','','',''),
 ('00000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member@aurelius.test','', '2026-01-01', '{"provider":"email","providers":["email"]}', '{}','2026-01-01','2026-01-01','','','','','','')
on conflict (id) do nothing;
insert into auth.identities (id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select id,id,id::text,jsonb_build_object('sub',id::text,'email',email),'email','2026-01-01','2026-01-01'
from auth.users where email in ('founder@aurelius.test','member@aurelius.test')
on conflict (provider_id,provider) do nothing;
update public.persons set display_name = case when auth_user_id = '00000000-0000-4000-8000-000000000001' then 'Founder' else 'Test member' end, timezone='America/Chicago'
where auth_user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into public.personal_events (id,person_id,kind,occurred_at,recorded_at,source)
select '10000000-0000-4000-8000-000000000001',id,'workspace.created','2026-01-01','2026-01-01','user'
from public.persons where auth_user_id = '00000000-0000-4000-8000-000000000001'
on conflict(id) do nothing;

-- Deterministic synthetic pattern relative to reset day; founder starts today empty.
-- A missing day is intentional. Never use this seed on a hosted environment.
insert into public.daily_entries(person_id,day,timezone,energy,sleep_minutes,intention,reflection)
select p.id, (current_timestamp at time zone p.timezone)::date - s.offset_days,
 p.timezone, s.energy, s.sleep_minutes, '', ''
from public.persons p cross join (values (6,3,420),(5,4,450),(3,2,390),(2,3,435),(1,4,465))
 as s(offset_days,energy,sleep_minutes)
where p.auth_user_id='00000000-0000-4000-8000-000000000001'
on conflict(person_id,day) do nothing;
