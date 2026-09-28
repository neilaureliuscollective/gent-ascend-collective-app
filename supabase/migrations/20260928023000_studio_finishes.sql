-- One editable, private finishing composition per completed Studio image.
create table public.ai_studio_finishes (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null,
 project_id uuid not null,
 version_id uuid not null,
 format text not null default 'portrait' check(format in ('square','portrait','landscape')),
 treatment text not null default 'editorial' check(treatment in ('editorial','centered','quiet')),
 brand text not null default '' check(length(brand)<=60),
 headline text not null default '' check(length(headline)<=120),
 supporting text not null default '' check(length(supporting)<=180),
 footer text not null default '' check(length(footer)<=80),
 focal_x integer not null default 50 check(focal_x between 0 and 100),
 focal_y integer not null default 50 check(focal_y between 0 and 100),
 updated_at timestamptz not null default now(),
 unique(person_id,project_id,version_id),
 foreign key(person_id,project_id,version_id) references public.ai_studio_versions(person_id,project_id,id)
);
create index ai_studio_finishes_project on public.ai_studio_finishes(person_id,project_id);
alter table public.ai_studio_finishes enable row level security;
grant select,insert,delete on public.ai_studio_finishes to authenticated;
grant update(format,treatment,brand,headline,supporting,footer,focal_x,focal_y,updated_at) on public.ai_studio_finishes to authenticated;
create policy studio_finishes_owner on public.ai_studio_finishes for all to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
