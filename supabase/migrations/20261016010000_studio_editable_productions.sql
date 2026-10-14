-- Additive Studio design documents, media compositions and local render jobs.
-- Does not reapply narration/footage schema. Feature flags stay default-off.
do $role$
begin
  if to_regprocedure('auth.role()') is null then
    execute $fn$create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user)$$;$fn$;
    execute 'grant execute on function auth.role() to authenticated, anon, service_role';
  end if;
end
$role$;
create table public.ai_studio_designs (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null, title text not null check(length(title) between 1 and 80),
 document jsonb not null, revision integer not null default 1 check(revision>=1),
 updated_at timestamptz not null default now(),
 unique(person_id,project_id,id),
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade,
 check(document->>'schema'='studio-design/v1'), check(pg_column_size(document) between 32 and 524288)
);
create index studio_designs_project on public.ai_studio_designs(person_id,project_id,updated_at desc);
create table public.ai_studio_design_revisions (
 id uuid primary key default gen_random_uuid(), person_id uuid not null, project_id uuid not null, design_id uuid not null,
 revision integer not null check(revision>=1), kind text not null check(kind in ('autosave','explicit')),
 document jsonb not null, created_at timestamptz not null default now(),
 unique(design_id,revision), unique(person_id,project_id,id),
 foreign key(person_id,project_id,design_id) references public.ai_studio_designs(person_id,project_id,id) on delete cascade,
 check(document->>'schema'='studio-design/v1')
);
create table public.ai_studio_design_exports (
 id uuid primary key default gen_random_uuid(), person_id uuid not null, project_id uuid not null,
 design_id uuid not null, revision_id uuid not null, format text not null check(format in ('png','svg','pdf')),
 storage_key text not null unique, width_px integer not null check(width_px between 1 and 20000),
 height_px integer not null check(height_px between 1 and 20000), ppi integer not null check(ppi between 72 and 600),
 created_at timestamptz not null default now(),
 foreign key(person_id,project_id,design_id) references public.ai_studio_designs(person_id,project_id,id) on delete cascade,
 foreign key(person_id,project_id,revision_id) references public.ai_studio_design_revisions(person_id,project_id,id),
 check(storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|svg|pdf)$')
);
create table public.ai_studio_compositions (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null, title text not null check(length(title) between 1 and 80),
 document jsonb not null, revision integer not null default 1 check(revision>=1),
 updated_at timestamptz not null default now(),
 unique(person_id,project_id,id),
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade,
 check(document->>'schema'='studio-composition/v1'), check(pg_column_size(document) between 32 and 262144)
);
create index studio_compositions_project on public.ai_studio_compositions(person_id,project_id,updated_at desc);
create table public.ai_studio_composition_revisions (
 id uuid primary key default gen_random_uuid(), person_id uuid not null, project_id uuid not null, composition_id uuid not null,
 revision integer not null check(revision>=1), kind text not null check(kind in ('autosave','explicit')),
 document jsonb not null, created_at timestamptz not null default now(),
 unique(composition_id,revision), unique(person_id,project_id,id),
 foreign key(person_id,project_id,composition_id) references public.ai_studio_compositions(person_id,project_id,id) on delete cascade,
 check(document->>'schema'='studio-composition/v1')
);
create table public.ai_studio_render_jobs (
 id uuid primary key, person_id uuid not null, project_id uuid not null, composition_id uuid not null, revision_id uuid not null,
 idempotency_key uuid not null unique,
 status text not null default 'queued' check(status in ('queued','running','complete','failed','cancelled','interrupted')),
 lease_token uuid, lease_until timestamptz, failure_code text,
 storage_film text, storage_cover text, storage_captions text,
 width integer, height integer, duration_ms integer,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(person_id,project_id,id),
 foreign key(person_id,project_id,composition_id) references public.ai_studio_compositions(person_id,project_id,id) on delete cascade,
 foreign key(person_id,project_id,revision_id) references public.ai_studio_composition_revisions(person_id,project_id,id),
 check((status='complete' and storage_film is not null and storage_cover is not null and storage_captions is not null and duration_ms is not null)
    or (status<>'complete' and storage_film is null and storage_cover is null and storage_captions is null))
);
create index studio_render_jobs_project on public.ai_studio_render_jobs(person_id,project_id,created_at desc);

alter table public.ai_studio_designs enable row level security;
alter table public.ai_studio_design_revisions enable row level security;
alter table public.ai_studio_design_exports enable row level security;
alter table public.ai_studio_compositions enable row level security;
alter table public.ai_studio_composition_revisions enable row level security;
alter table public.ai_studio_render_jobs enable row level security;
revoke all on public.ai_studio_designs,public.ai_studio_design_revisions,public.ai_studio_design_exports,
 public.ai_studio_compositions,public.ai_studio_composition_revisions,public.ai_studio_render_jobs from public,anon,authenticated;
grant select,insert on public.ai_studio_designs,public.ai_studio_compositions to authenticated;
grant update(title,document,revision,updated_at) on public.ai_studio_designs,public.ai_studio_compositions to authenticated;
grant select on public.ai_studio_design_revisions,public.ai_studio_design_exports,
 public.ai_studio_composition_revisions,public.ai_studio_render_jobs to authenticated;
create policy studio_designs_owner on public.ai_studio_designs for all to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy studio_design_revisions_owner on public.ai_studio_design_revisions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy studio_design_exports_owner on public.ai_studio_design_exports for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy studio_compositions_owner on public.ai_studio_compositions for all to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy studio_composition_revisions_owner on public.ai_studio_composition_revisions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy studio_render_jobs_owner on public.ai_studio_render_jobs for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_studio_owner() returns uuid language sql stable set search_path='' as $$
 select id from public.persons where auth_user_id=(select auth.uid())
$$;

create function public.ai_studio_design_save(p_id uuid,p_project uuid,p_title text,p_document jsonb,p_updated timestamptz,p_expected integer)
returns table(id uuid,revision integer,updated_at timestamptz) language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_now timestamptz := now();
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null or not exists(select 1 from public.ai_studio_projects p where p.id=p_project and p.person_id=v_person and (to_jsonb(p)->>'company_id') is null) then raise exception 'Studio project unavailable'; end if;
 if p_document is null or p_document->>'schema' is distinct from 'studio-design/v1' or pg_column_size(p_document)>524288 then raise exception 'Invalid design document'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text || p_id::text,811));
 if p_updated is null then
  if (select count(*) from public.ai_studio_designs where person_id=v_person and project_id=p_project)>=20 then raise exception 'Design limit reached'; end if;
  insert into public.ai_studio_designs(id,person_id,project_id,title,document,updated_at) values(p_id,v_person,p_project,p_title,p_document,v_now);
  insert into public.ai_studio_design_revisions(person_id,project_id,design_id,revision,kind,document) values(v_person,p_project,p_id,1,'autosave',p_document);
  return query select p_id,1,v_now;
  return;
 end if;
 update public.ai_studio_designs set title=p_title,document=p_document,revision=p_expected+1,updated_at=v_now
  where id=p_id and person_id=v_person and project_id=p_project and updated_at=p_updated and revision=p_expected;
 if not found then raise exception 'DESIGN_CONFLICT'; end if;
 insert into public.ai_studio_design_revisions(person_id,project_id,design_id,revision,kind,document)
  values(v_person,p_project,p_id,p_expected+1,'autosave',p_document);
 return query select p_id,p_expected+1,v_now;
end $$;

create function public.ai_studio_design_freeze(p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_rev public.ai_studio_design_revisions%rowtype;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null then raise exception 'Studio project unavailable'; end if;
 update public.ai_studio_design_revisions r set kind='explicit'
  from public.ai_studio_designs d
  where d.id=p_id and d.person_id=v_person and r.design_id=d.id and r.revision=d.revision
  returning r.* into v_rev;
 if v_rev.id is null then raise exception 'Design revision unavailable'; end if;
 return v_rev.id;
end $$;

create function public.ai_studio_composition_save(p_id uuid,p_project uuid,p_title text,p_document jsonb,p_updated timestamptz,p_expected integer)
returns table(id uuid,revision integer,updated_at timestamptz) language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_now timestamptz := now();
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null or not exists(select 1 from public.ai_studio_projects p where p.id=p_project and p.person_id=v_person and (to_jsonb(p)->>'company_id') is null) then raise exception 'Studio project unavailable'; end if;
 if p_document is null or p_document->>'schema' is distinct from 'studio-composition/v1' or pg_column_size(p_document)>262144 then raise exception 'Invalid composition document'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text || p_id::text,812));
 if p_updated is null then
  if (select count(*) from public.ai_studio_compositions where person_id=v_person and project_id=p_project)>=8 then raise exception 'Composition limit reached'; end if;
  insert into public.ai_studio_compositions(id,person_id,project_id,title,document,updated_at) values(p_id,v_person,p_project,p_title,p_document,v_now);
  insert into public.ai_studio_composition_revisions(person_id,project_id,composition_id,revision,kind,document) values(v_person,p_project,p_id,1,'autosave',p_document);
  return query select p_id,1,v_now;
  return;
 end if;
 update public.ai_studio_compositions set title=p_title,document=p_document,revision=p_expected+1,updated_at=v_now
  where id=p_id and person_id=v_person and project_id=p_project and updated_at=p_updated and revision=p_expected;
 if not found then raise exception 'COMPOSITION_CONFLICT'; end if;
 insert into public.ai_studio_composition_revisions(person_id,project_id,composition_id,revision,kind,document)
  values(v_person,p_project,p_id,p_expected+1,'autosave',p_document);
 return query select p_id,p_expected+1,v_now;
end $$;

create function public.ai_studio_composition_freeze(p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_rev public.ai_studio_composition_revisions%rowtype;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null then raise exception 'Studio project unavailable'; end if;
 update public.ai_studio_composition_revisions r set kind='explicit'
  from public.ai_studio_compositions d
  where d.id=p_id and d.person_id=v_person and r.composition_id=d.id and r.revision=d.revision
  returning r.* into v_rev;
 if v_rev.id is null then raise exception 'Composition revision unavailable'; end if;
 return v_rev.id;
end $$;

create function public.ai_studio_render_begin(p_id uuid,p_project uuid,p_composition uuid,p_revision uuid,p_key uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null then raise exception 'Studio project unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text,813));
 if exists(select 1 from public.ai_studio_render_jobs where idempotency_key=p_key) then
  return false;
 end if;
 if not exists(select 1 from public.ai_studio_composition_revisions r where r.id=p_revision and r.person_id=v_person and r.composition_id=p_composition and r.project_id=p_project) then
  raise exception 'Pinned composition revision unavailable';
 end if;
 if exists(select 1 from public.ai_studio_render_jobs where person_id=v_person and status in ('queued','running')) then
  raise exception 'A film render is already in progress';
 end if;
 if (select count(*) from public.ai_studio_render_jobs where person_id=v_person and created_at>now()-interval '1 day')>=10 then
  raise exception 'Daily film render limit reached';
 end if;
 insert into public.ai_studio_render_jobs(id,person_id,project_id,composition_id,revision_id,idempotency_key)
  values(p_id,v_person,p_project,p_composition,p_revision,p_key);
 return true;
end $$;

create function public.ai_studio_render_cancel(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 select public.ai_studio_owner() into v_person;
 update public.ai_studio_render_jobs set status='cancelled',lease_token=null,lease_until=null,updated_at=now()
  where id=p_id and person_id=v_person and status in ('queued','running');
 return found;
end $$;

create function public.ai_studio_render_claim(p_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_role text;
begin
 v_role := coalesce(nullif(auth.role(),''), current_user);
 select public.ai_studio_owner() into v_person;
 if v_role is distinct from 'service_role' and v_person is null then raise exception 'Render claim denied'; end if;
 update public.ai_studio_render_jobs set status='running',lease_token=p_token,lease_until=now()+interval '2 minutes',updated_at=now()
  where id=p_id and status='queued' and (v_role='service_role' or person_id=v_person);
 return found;
end $$;

create function public.ai_studio_render_heartbeat(p_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ai_studio_render_jobs set lease_until=now()+interval '2 minutes',updated_at=now()
  where id=p_id and lease_token=p_token and status='running' and lease_until>now();
 return found;
end $$;

create function public.ai_studio_render_finish(p_id uuid,p_token uuid,p_film text,p_cover text,p_captions text,p_width integer,p_height integer,p_duration integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid());
declare v_job public.ai_studio_render_jobs%rowtype;
begin
 select * into v_job from public.ai_studio_render_jobs where id=p_id and lease_token=p_token and status in ('running','cancelled');
 if not found then raise exception 'Render lease lost'; end if;
 if v_job.status='cancelled' then
  update public.ai_studio_render_jobs set lease_token=null,lease_until=null,updated_at=now() where id=p_id;
  return false;
 end if;
 if v_uid is not null and (
   p_film is distinct from v_uid::text || '/' || v_job.project_id::text || '/' || p_id::text || '/film.mp4' or
   p_cover is distinct from v_uid::text || '/' || v_job.project_id::text || '/' || p_id::text || '/cover.png' or
   p_captions is distinct from v_uid::text || '/' || v_job.project_id::text || '/' || p_id::text || '/captions.vtt'
 ) then raise exception 'Invalid render storage key'; end if;
 update public.ai_studio_render_jobs set status='complete',storage_film=p_film,storage_cover=p_cover,storage_captions=p_captions,
  width=p_width,height=p_height,duration_ms=p_duration,lease_token=null,lease_until=null,updated_at=now()
  where id=p_id and lease_token=p_token and status='running';
 return found;
end $$;

create function public.ai_studio_render_fail(p_id uuid,p_token uuid,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ai_studio_render_jobs set status=case when status='cancelled' then 'cancelled' else 'failed' end,
  failure_code=p_code,lease_token=null,lease_until=null,updated_at=now()
  where id=p_id and lease_token=p_token and status in ('running','cancelled');
 return found;
end $$;

create function public.ai_studio_render_recover()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.ai_studio_render_jobs set status='interrupted',lease_token=null,lease_until=null,failure_code='lease_expired',updated_at=now()
  where status='running' and (lease_until is null or lease_until<now());
 get diagnostics n = row_count;
 return n;
end $$;

create function public.ai_studio_export_record(p_design uuid,p_revision uuid,p_format text,p_key text,p_width integer,p_height integer,p_ppi integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_id uuid := gen_random_uuid(); v_project uuid;
begin
 select public.ai_studio_owner() into v_person;
 select project_id into v_project from public.ai_studio_designs where id=p_design and person_id=v_person;
 if v_person is null or v_project is null then raise exception 'Design export unavailable'; end if;
 if p_key is distinct from (select auth.uid())::text || '/' || v_project::text || '/' || p_design::text || '/' || p_revision::text || '.' || p_format then
  raise exception 'Invalid design export key';
 end if;
 insert into public.ai_studio_design_exports(id,person_id,project_id,design_id,revision_id,format,storage_key,width_px,height_px,ppi)
  values(v_id,v_person,v_project,p_design,p_revision,p_format,p_key,p_width,p_height,p_ppi);
 return v_id;
end $$;

revoke all on function public.ai_studio_owner(),public.ai_studio_design_save(uuid,uuid,text,jsonb,timestamptz,integer),
 public.ai_studio_design_freeze(uuid),public.ai_studio_composition_save(uuid,uuid,text,jsonb,timestamptz,integer),
 public.ai_studio_composition_freeze(uuid),public.ai_studio_render_begin(uuid,uuid,uuid,uuid,uuid),
 public.ai_studio_render_cancel(uuid),public.ai_studio_render_claim(uuid,uuid),public.ai_studio_render_heartbeat(uuid,uuid),
 public.ai_studio_render_finish(uuid,uuid,text,text,text,integer,integer,integer),public.ai_studio_render_fail(uuid,uuid,text),
 public.ai_studio_render_recover(),public.ai_studio_export_record(uuid,uuid,text,text,integer,integer,integer)
 from public,anon;
grant execute on function public.ai_studio_owner(),public.ai_studio_design_save(uuid,uuid,text,jsonb,timestamptz,integer),
 public.ai_studio_design_freeze(uuid),public.ai_studio_composition_save(uuid,uuid,text,jsonb,timestamptz,integer),
 public.ai_studio_composition_freeze(uuid),public.ai_studio_render_begin(uuid,uuid,uuid,uuid,uuid),
 public.ai_studio_render_cancel(uuid),public.ai_studio_render_claim(uuid,uuid),public.ai_studio_render_heartbeat(uuid,uuid),
 public.ai_studio_render_finish(uuid,uuid,text,text,text,integer,integer,integer),public.ai_studio_render_fail(uuid,uuid,text),
 public.ai_studio_render_recover(),public.ai_studio_export_record(uuid,uuid,text,text,integer,integer,integer)
 to authenticated;
grant execute on function public.ai_studio_render_claim(uuid,uuid),public.ai_studio_render_heartbeat(uuid,uuid),
 public.ai_studio_render_finish(uuid,uuid,text,text,text,integer,integer,integer),public.ai_studio_render_fail(uuid,uuid,text),
 public.ai_studio_render_recover() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('aethelios-studio-designs','aethelios-studio-designs',false,20000000,array['image/png','image/svg+xml','application/pdf'])
 on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('aethelios-studio-renders','aethelios-studio-renders',false,80000000,array['video/mp4','image/png','text/vtt'])
 on conflict(id) do nothing;
create policy studio_design_objects_owner on storage.objects for all to authenticated
 using(bucket_id='aethelios-studio-designs' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='aethelios-studio-designs' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy studio_render_objects_owner on storage.objects for all to authenticated
 using(bucket_id='aethelios-studio-renders' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='aethelios-studio-renders' and (storage.foldername(name))[1]=(select auth.uid())::text);
