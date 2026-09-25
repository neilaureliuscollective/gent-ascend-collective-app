-- The original thought is retained independently of any proposed interpretation.
create table public.life_captures (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 content text not null check (char_length(btrim(content)) between 1 and 2000),
 kind text not null default 'thought' check (kind in ('thought','idea','task','decision')),
 status text not null default 'inbox' check (status in ('inbox','acted','dismissed')),
 source text not null default 'user' check (source='user'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index life_captures_owner_recent on public.life_captures(person_id,created_at desc);
alter table public.life_captures enable row level security;
revoke all on public.life_captures from public,anon,authenticated;
grant select,insert on public.life_captures to authenticated;
grant update(status,updated_at) on public.life_captures to authenticated;
create policy life_captures_read on public.life_captures for select to authenticated
 using (person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy life_captures_insert on public.life_captures for insert to authenticated
 with check (person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy life_captures_update on public.life_captures for update to authenticated
 using (person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check (person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
