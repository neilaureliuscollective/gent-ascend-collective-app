-- Additive owner-scoped generated applications. Hosted application requires founder-approved migration.
create table public.architect_apps (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 100),
 current_revision integer not null default 0 check(current_revision between 0 and 500),
 last_working_revision integer check(last_working_revision between 1 and 500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(person_id, project_id),
 unique(id, person_id),
 foreign key(project_id, person_id) references public.architect_origin_projects(id, person_id) on delete cascade
);
create index architect_apps_owner on public.architect_apps(person_id, updated_at desc);

create table public.architect_app_revisions (
 id uuid primary key,
 app_id uuid not null,
 person_id uuid not null,
 project_id uuid not null,
 revision integer not null check(revision between 1 and 500),
 parent_revision integer check(parent_revision between 1 and 500),
 tree_hash text not null check(tree_hash ~ '^[0-9a-f]{64}$'),
 approval_hash text not null check(approval_hash ~ '^[0-9a-f]{64}$'),
 profile text not null check(profile='react-ts-vite'),
 profile_version text not null,
 toolchain text not null,
 files jsonb not null check(jsonb_typeof(files)='array' and jsonb_array_length(files) between 1 and 48),
 collections jsonb not null check(jsonb_typeof(collections)='array'),
 behaviors jsonb not null,
 generation jsonb not null,
 status text not null check(status in ('approved','building','ready','failed','superseded')),
 working boolean not null default false,
 created_at timestamptz not null default now(),
 unique(app_id, revision),
 unique(id, person_id),
 foreign key(app_id, person_id) references public.architect_apps(id, person_id) on delete cascade
);
create index architect_app_revisions_owner on public.architect_app_revisions(person_id, project_id, revision desc);

create table public.architect_app_artifacts (
 revision_id uuid primary key,
 person_id uuid not null,
 project_id uuid not null,
 manifest_hash text not null check(manifest_hash ~ '^[0-9a-f]{64}$'),
 files jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(revision_id, person_id) references public.architect_app_revisions(id, person_id) on delete cascade
);

create table public.architect_app_jobs (
 id uuid primary key,
 person_id uuid not null,
 project_id uuid not null,
 app_id uuid not null,
 revision_id uuid not null,
 approval_hash text not null,
 status text not null check(status in ('queued','running','succeeded','failed','cancelled')),
 cancel_requested boolean not null default false,
 worker_id text,
 lease_token uuid,
 lease_until timestamptz,
 result jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(app_id, person_id) references public.architect_apps(id, person_id) on delete cascade
);
create index architect_app_jobs_queue on public.architect_app_jobs(status, created_at);

create table public.architect_app_events (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null,
 person_id uuid not null,
 kind text not null,
 detail text not null,
 created_at timestamptz not null default now()
);

create table public.architect_app_records (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null,
 project_id uuid not null,
 app_id uuid not null,
 collection text not null,
 payload jsonb not null check(octet_length(payload::text)<=8000),
 idempotency_key text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(app_id, collection, idempotency_key),
 foreign key(app_id, person_id) references public.architect_apps(id, person_id) on delete cascade
);
create index architect_app_records_owner on public.architect_app_records(person_id, app_id, collection);

create table public.architect_design_directions (
 request_id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null,
 revision integer not null default 1,
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 receipt jsonb not null,
 started boolean not null default false check(started=false),
 created_at timestamptz not null default now(),
 foreign key(project_id, person_id) references public.architect_origin_projects(id, person_id) on delete cascade
);

alter table public.architect_apps enable row level security;
alter table public.architect_app_revisions enable row level security;
alter table public.architect_app_artifacts enable row level security;
alter table public.architect_app_jobs enable row level security;
alter table public.architect_app_events enable row level security;
alter table public.architect_app_records enable row level security;
alter table public.architect_design_directions enable row level security;

create policy architect_apps_owner on public.architect_apps for select to authenticated using (person_id = auth.uid());
create policy architect_app_revisions_owner on public.architect_app_revisions for select to authenticated using (person_id = auth.uid());
create policy architect_app_artifacts_owner on public.architect_app_artifacts for select to authenticated using (person_id = auth.uid());
create policy architect_app_jobs_owner on public.architect_app_jobs for select to authenticated using (person_id = auth.uid());
create policy architect_app_events_owner on public.architect_app_events for select to authenticated using (person_id = auth.uid());
create policy architect_app_records_owner on public.architect_app_records for select to authenticated using (person_id = auth.uid());
create policy architect_design_directions_owner on public.architect_design_directions for select to authenticated using (person_id = auth.uid());

revoke all on table public.architect_apps from public, anon;
revoke all on table public.architect_app_revisions from public, anon;
revoke all on table public.architect_app_artifacts from public, anon;
revoke all on table public.architect_app_jobs from public, anon;
revoke all on table public.architect_app_events from public, anon;
revoke all on table public.architect_app_records from public, anon;
revoke all on table public.architect_design_directions from public, anon;
grant select on table public.architect_apps to authenticated;
grant select on table public.architect_app_revisions to authenticated;
grant select on table public.architect_app_artifacts to authenticated;
grant select on table public.architect_app_jobs to authenticated;
grant select on table public.architect_app_events to authenticated;
grant select on table public.architect_app_records to authenticated;
grant select on table public.architect_design_directions to authenticated;
