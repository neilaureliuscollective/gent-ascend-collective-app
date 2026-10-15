-- Durable owner-authorized Design export jobs on the same worker as Film.
-- Pins the immutable revision at begin. Failed jobs never rewrite the editable document.
alter table public.ai_studio_design_exports drop constraint if exists ai_studio_design_exports_storage_key_check;
alter table public.ai_studio_design_exports add constraint ai_studio_design_exports_storage_key_check
 check(storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}(/design)?\.(png|svg|pdf)$');

create table public.ai_studio_design_export_jobs (
 id uuid primary key, person_id uuid not null, project_id uuid not null,
 design_id uuid not null, revision_id uuid not null,
 format text not null check(format in ('png','svg','pdf')),
 font_mode text not null default 'embed' check(font_mode in ('embed','outline')),
 idempotency_key uuid not null unique,
 status text not null default 'queued' check(status in ('queued','running','complete','failed','cancelled','interrupted')),
 lease_token uuid, lease_until timestamptz, failure_code text,
 retry_count integer not null default 0 check(retry_count between 0 and 8),
 storage_key text, export_id uuid,
 width integer, height integer, ppi integer,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(person_id,project_id,id),
 foreign key(person_id,project_id,design_id) references public.ai_studio_designs(person_id,project_id,id) on delete cascade,
 foreign key(person_id,project_id,revision_id) references public.ai_studio_design_revisions(person_id,project_id,id),
 foreign key(export_id) references public.ai_studio_design_exports(id),
 check((status='complete' and storage_key is not null and export_id is not null and width is not null and height is not null and ppi is not null)
    or (status<>'complete' and storage_key is null and export_id is null))
);
create index studio_design_export_jobs_project on public.ai_studio_design_export_jobs(person_id,project_id,created_at desc);
alter table public.ai_studio_design_export_jobs enable row level security;
revoke all on public.ai_studio_design_export_jobs from public,anon,authenticated;
grant select on public.ai_studio_design_export_jobs to authenticated;
grant select,update on public.ai_studio_design_export_jobs to service_role;
create policy studio_design_export_jobs_owner on public.ai_studio_design_export_jobs for select to authenticated
 using(person_id=(select public.ai_studio_owner()));

create function public.ai_studio_design_export_begin(p_id uuid,p_project uuid,p_design uuid,p_revision uuid,p_format text,p_font_mode text,p_key uuid)
returns table(id uuid, status text, created boolean, export_id uuid) language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_existing public.ai_studio_design_export_jobs%rowtype;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null then raise exception 'Studio project unavailable'; end if;
 if p_format not in ('png','svg','pdf') or p_font_mode not in ('embed','outline') then raise exception 'Invalid design export'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text,814));
 select j.* into v_existing from public.ai_studio_design_export_jobs j where j.idempotency_key=p_key;
 if found then
  if v_existing.person_id is distinct from v_person then raise exception 'Design export key unavailable'; end if;
  if v_existing.design_id is distinct from p_design or v_existing.revision_id is distinct from p_revision
     or v_existing.format is distinct from p_format or v_existing.font_mode is distinct from p_font_mode then
   raise exception 'DESIGN_EXPORT_INPUT_CHANGED';
  end if;
  id := v_existing.id; status := v_existing.status; created := false; export_id := v_existing.export_id;
  return next; return;
 end if;
 if not exists(select 1 from public.ai_studio_design_revisions r where r.id=p_revision and r.person_id=v_person
   and r.design_id=p_design and r.project_id=p_project) then
  raise exception 'Pinned design revision unavailable';
 end if;
 if exists(select 1 from public.ai_studio_design_export_jobs j where j.person_id=v_person and j.status in ('queued','running')) then
  raise exception 'A design export is already in progress';
 end if;
 if (select count(*) from public.ai_studio_design_export_jobs j where j.person_id=v_person and j.created_at>now()-interval '1 day')>=20 then
  raise exception 'Daily design export limit reached';
 end if;
 insert into public.ai_studio_design_export_jobs(id,person_id,project_id,design_id,revision_id,format,font_mode,idempotency_key)
  values(p_id,v_person,p_project,p_design,p_revision,p_format,p_font_mode,p_key);
 id := p_id; status := 'queued'; created := true; export_id := null;
 return next;
end $$;

create function public.ai_studio_design_export_cancel(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 select public.ai_studio_owner() into v_person;
 update public.ai_studio_design_export_jobs j set status='cancelled',lease_token=null,lease_until=null,updated_at=now()
  where j.id=p_id and j.person_id=v_person and j.status in ('queued','running');
 return found;
end $$;

create function public.ai_studio_design_export_claim(p_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_role text;
begin
 v_role := coalesce(nullif(auth.role(),''), current_user);
 select public.ai_studio_owner() into v_person;
 if v_role is distinct from 'service_role' and v_person is null then raise exception 'Design export claim denied'; end if;
 update public.ai_studio_design_export_jobs j set status='running',lease_token=p_token,lease_until=now()+interval '2 minutes',updated_at=now()
  where j.id=p_id and j.status='queued' and (v_role='service_role' or j.person_id=v_person);
 return found;
end $$;

create function public.ai_studio_design_export_heartbeat(p_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ai_studio_design_export_jobs j set lease_until=now()+interval '2 minutes',updated_at=now()
  where j.id=p_id and j.lease_token=p_token and j.status='running' and j.lease_until>now();
 return found;
end $$;

create function public.ai_studio_design_export_finish(p_id uuid,p_token uuid,p_key text,p_width integer,p_height integer,p_ppi integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid; v_job public.ai_studio_design_export_jobs%rowtype; v_export uuid := gen_random_uuid(); v_prefix text;
begin
 select j.* into v_job from public.ai_studio_design_export_jobs j
  where j.id=p_id and j.lease_token=p_token and j.status='running' and j.lease_until is not null and j.lease_until>now();
 if not found then raise exception 'Design export lease lost'; end if;
 select p.auth_user_id into v_uid from public.persons p where p.id=v_job.person_id;
 v_prefix := v_uid::text || '/' || v_job.project_id::text || '/' || p_id::text || '/' || p_token::text || '/design.' || v_job.format;
 if v_uid is null or p_key is distinct from v_prefix then raise exception 'Invalid design export storage key'; end if;
 insert into public.ai_studio_design_exports(id,person_id,project_id,design_id,revision_id,format,storage_key,width_px,height_px,ppi)
  values(v_export,v_job.person_id,v_job.project_id,v_job.design_id,v_job.revision_id,v_job.format,p_key,p_width,p_height,p_ppi);
 update public.ai_studio_design_export_jobs j set status='complete',storage_key=p_key,export_id=v_export,
  width=p_width,height=p_height,ppi=p_ppi,lease_token=null,lease_until=null,updated_at=now()
  where j.id=p_id and j.lease_token=p_token and j.status='running' and j.lease_until>now();
 if not found then raise exception 'Design export lease lost'; end if;
 return v_export;
end $$;

create function public.ai_studio_design_export_fail(p_id uuid,p_token uuid,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ai_studio_design_export_jobs j set status=case
   when j.status='cancelled' then 'cancelled'
   when p_code='retry' and j.retry_count<3 then 'interrupted'
   else 'failed' end,
  failure_code=p_code,lease_token=null,lease_until=null,updated_at=now()
  where j.id=p_id and j.lease_token=p_token and j.status in ('running','cancelled');
 return found;
end $$;

create function public.ai_studio_design_export_recover()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer; v_role text;
begin
 v_role := coalesce(nullif(auth.role(),''), current_user);
 if v_role is distinct from 'service_role' then raise exception 'Design export recovery denied'; end if;
 update public.ai_studio_design_export_jobs j set status='interrupted',lease_token=null,lease_until=null,failure_code='lease_expired',updated_at=now()
  where j.status='running' and (j.lease_until is null or j.lease_until<now());
 get diagnostics n = row_count;
 return n;
end $$;

create function public.ai_studio_design_export_requeue()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer; v_role text;
begin
 v_role := coalesce(nullif(auth.role(),''), current_user);
 if v_role is distinct from 'service_role' then raise exception 'Design export recovery denied'; end if;
 update public.ai_studio_design_export_jobs j set status='queued',lease_token=null,lease_until=null,updated_at=now(),retry_count=j.retry_count+1
  where j.status='interrupted' and j.retry_count<3;
 get diagnostics n = row_count;
 return n;
end $$;

revoke all on function public.ai_studio_design_export_begin(uuid,uuid,uuid,uuid,text,text,uuid),
 public.ai_studio_design_export_cancel(uuid),public.ai_studio_design_export_claim(uuid,uuid),
 public.ai_studio_design_export_heartbeat(uuid,uuid),public.ai_studio_design_export_finish(uuid,uuid,text,integer,integer,integer),
 public.ai_studio_design_export_fail(uuid,uuid,text),public.ai_studio_design_export_recover(),public.ai_studio_design_export_requeue()
 from public,anon;
grant execute on function public.ai_studio_design_export_begin(uuid,uuid,uuid,uuid,text,text,uuid),
 public.ai_studio_design_export_cancel(uuid) to authenticated;
grant execute on function public.ai_studio_design_export_claim(uuid,uuid),public.ai_studio_design_export_heartbeat(uuid,uuid),
 public.ai_studio_design_export_finish(uuid,uuid,text,integer,integer,integer),public.ai_studio_design_export_fail(uuid,uuid,text),
 public.ai_studio_design_export_recover(),public.ai_studio_design_export_requeue() to service_role;
grant execute on function public.ai_studio_design_export_claim(uuid,uuid),public.ai_studio_design_export_heartbeat(uuid,uuid),
 public.ai_studio_design_export_finish(uuid,uuid,text,integer,integer,integer),public.ai_studio_design_export_fail(uuid,uuid,text)
 to authenticated;
