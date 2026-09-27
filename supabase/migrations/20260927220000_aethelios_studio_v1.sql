-- Studio projects and versions are application-owned. No provider response ID is required
-- to revisit or edit an image. Images live in a private bucket under auth-user paths.
create table public.ai_studio_projects (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.persons(id) on delete cascade,
 title text not null check(length(title) between 1 and 80),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(person_id,id)
);
create index ai_studio_projects_recent on public.ai_studio_projects(person_id,updated_at desc,id desc);
alter table public.ai_studio_projects enable row level security;
grant select,insert,update on public.ai_studio_projects to authenticated;
create policy studio_projects_owner on public.ai_studio_projects for all to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create table public.ai_studio_references (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null,
 project_id uuid not null,
 storage_key text not null unique,
 media_type text not null check(media_type in ('image/png','image/jpeg','image/webp')),
 byte_size integer not null check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now(),
 unique(person_id,project_id,id),
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade
);
create index ai_studio_references_project on public.ai_studio_references(person_id,project_id,created_at desc);
alter table public.ai_studio_references enable row level security;
grant select,insert on public.ai_studio_references to authenticated;
create policy studio_references_owner on public.ai_studio_references for all to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid()))
  and storage_key like (select auth.uid())::text || '/' || project_id::text || '/%');

create table public.ai_studio_versions (
 id uuid primary key,
 person_id uuid not null,
 project_id uuid not null,
 parent_id uuid,
 reference_id uuid,
 prompt text not null check(length(prompt) between 3 and 3000),
 model text not null check(model in ('gpt-image-2.5-flare','gpt-image-2.5-sunburst')),
 image_size text not null check(image_size in ('1024x1024','1536x1024','1024x1536')),
 status text not null default 'pending' check(status in ('pending','complete','failed')),
 storage_key text unique,
 failure_code text,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(person_id,project_id,id),
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade,
 foreign key(person_id,project_id,parent_id) references public.ai_studio_versions(person_id,project_id,id),
 foreign key(person_id,project_id,reference_id) references public.ai_studio_references(person_id,project_id,id),
 check((status='complete' and storage_key is not null and completed_at is not null) or
       (status<>'complete' and storage_key is null))
);
create index ai_studio_versions_recent on public.ai_studio_versions(person_id,project_id,created_at desc,id desc);
create index ai_studio_versions_quota on public.ai_studio_versions(person_id,created_at desc);
alter table public.ai_studio_versions enable row level security;
grant select on public.ai_studio_versions to authenticated;
create policy studio_versions_owner on public.ai_studio_versions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

-- A project can eventually be deleted without replenishing paid generation allowance.
create table public.ai_studio_usage (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index ai_studio_usage_owner_time on public.ai_studio_usage(person_id,created_at desc);
alter table public.ai_studio_usage enable row level security;
grant select on public.ai_studio_usage to authenticated;
create policy studio_usage_owner on public.ai_studio_usage for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_studio_begin(p_id uuid,p_project uuid,p_parent uuid,p_reference uuid,p_prompt text,p_model text,p_size text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or not exists(select 1 from public.ai_studio_projects where id=p_project and person_id=v_person) then
  raise exception 'Studio project unavailable';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text,731));
 if exists(select 1 from public.ai_studio_versions where id=p_id) then return false; end if;
 update public.ai_studio_versions set status='failed',failure_code='interrupted'
  where person_id=v_person and status='pending' and created_at<now()-interval '5 minutes';
 if (select count(*) from public.ai_studio_usage where person_id=v_person and created_at>now()-interval '1 day')>=12
    or exists(select 1 from public.ai_studio_versions where person_id=v_person and status='pending') then
  raise exception 'Studio generation limit or concurrent request reached';
 end if;
 insert into public.ai_studio_versions(id,person_id,project_id,parent_id,reference_id,prompt,model,image_size)
 values(p_id,v_person,p_project,p_parent,p_reference,p_prompt,p_model,p_size);
 insert into public.ai_studio_usage(id,person_id) values(p_id,v_person);
 return true;
end $$;
create function public.ai_studio_finish(p_id uuid,p_status text,p_key text default null,p_failure text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 if p_status not in ('complete','failed') or
   (p_status='complete' and p_key is distinct from (select auth.uid())::text || '/' ||
    (select project_id::text from public.ai_studio_versions where id=p_id) || '/' || p_id::text || '.png') or
   (p_status='failed' and p_key is not null) then
  raise exception 'Invalid Studio completion';
 end if;
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 update public.ai_studio_versions set status=p_status,storage_key=p_key,
 failure_code=case when p_status='failed' then left(p_failure,40) else null end,
 completed_at=case when p_status='complete' then now() else null end
 where id=p_id and person_id=v_person and status='pending';
 if not found then return false; end if;
 update public.ai_studio_projects set updated_at=now() where id=(select project_id from public.ai_studio_versions where id=p_id) and person_id=v_person;
 return true;
end $$;
revoke all on function public.ai_studio_begin(uuid,uuid,uuid,uuid,text,text,text) from public,anon;
revoke all on function public.ai_studio_finish(uuid,text,text,text) from public,anon;
grant execute on function public.ai_studio_begin(uuid,uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ai_studio_finish(uuid,text,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('aethelios-studio','aethelios-studio',false,10485760,array['image/png','image/jpeg','image/webp'])
 on conflict(id) do nothing;
create policy studio_objects_owner on storage.objects for all to authenticated
 using(bucket_id='aethelios-studio' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='aethelios-studio' and (storage.foldername(name))[1]=(select auth.uid())::text);
