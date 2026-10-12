-- Additive candidate, not applied remotely. CLI attempted; its home directory is read-only here.
create table public.ai_studio_footage (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null, title text not null check(length(title) between 1 and 80),
 prompt text not null check(length(prompt) between 3 and 1000), duration integer not null check(duration in(5,10)),
 ratio text not null check(ratio in('1280:720','720:1280')),
 estimate integer generated always as (duration*12) stored,
 policy text not null default 'runway-gen45-2026-10-12' check(policy='runway-gen45-2026-10-12'),
 expires_at timestamptz not null, quote_signature text not null check(quote_signature ~ '^[a-f0-9]{64}$'),
 provider_id uuid, provider_signature text, provider_credits numeric check(provider_credits>=0),
 status text not null default 'quoted' check(status in('quoted','submitting','queued','complete','failed','uncertain')),
 storage_key text, checked_at timestamptz, created_at timestamptz not null default now(),
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade,
 check((provider_id is null and provider_signature is null) or (provider_id is not null and provider_signature is not null and provider_signature ~ '^[a-f0-9]{64}$')),
 check((status='complete' and storage_key is not null) or (status<>'complete' and storage_key is null))
);
create index studio_footage_project on public.ai_studio_footage(person_id,project_id,created_at desc);
create table public.ai_studio_footage_usage (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 estimate integer not null check(estimate in(60,120)), created_at timestamptz not null default now()
);
create index studio_footage_usage_time on public.ai_studio_footage_usage(person_id,created_at desc);
alter table public.ai_studio_footage enable row level security;
alter table public.ai_studio_footage_usage enable row level security;
revoke all on public.ai_studio_footage,public.ai_studio_footage_usage from public,anon,authenticated;
grant select on public.ai_studio_footage,public.ai_studio_footage_usage to authenticated;
create policy studio_footage_owner on public.ai_studio_footage for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy studio_footage_usage_owner on public.ai_studio_footage_usage for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.ai_studio_footage_quote(p_id uuid,p_project uuid,p_title text,p_prompt text,p_duration integer,p_ratio text,p_expires timestamptz,p_signature text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or not exists(select 1 from public.ai_studio_projects p where id=p_project and person_id=v_person and (to_jsonb(p)->>'company_id') is null) or p_expires<=now() or p_expires>now()+interval '11 minutes' then raise exception 'Footage project or quote unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text,733));
 if (select count(*) from public.ai_studio_footage where person_id=v_person and created_at>now()-interval '1 day')>=30 then raise exception 'Footage quote limit reached'; end if;
 insert into public.ai_studio_footage(id,person_id,project_id,title,prompt,duration,ratio,expires_at,quote_signature) values(p_id,v_person,p_project,p_title,p_prompt,p_duration,p_ratio,p_expires,p_signature);
 return true;
end $$;
create function public.ai_studio_footage_begin(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_job public.ai_studio_footage;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null then raise exception 'Session required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text,733));
 select * into v_job from public.ai_studio_footage where id=p_id and person_id=v_person for update;
 if not found or v_job.status<>'quoted' or v_job.expires_at<=now() then return false; end if;
 if (select count(*) from public.ai_studio_footage_usage where person_id=v_person and created_at>now()-interval '1 day')>=3 or
 (select coalesce(sum(estimate),0) from public.ai_studio_footage_usage where person_id=v_person and created_at>now()-interval '1 day')+v_job.estimate>180 or
 exists(select 1 from public.ai_studio_footage where person_id=v_person and status in('submitting','queued','uncertain')) then raise exception 'Footage allowance or pending request limit reached'; end if;
 insert into public.ai_studio_footage_usage(id,person_id,estimate) values(p_id,v_person,v_job.estimate);
 update public.ai_studio_footage set status='submitting' where id=p_id;
 return true;
end $$;
create function public.ai_studio_footage_receipt(p_id uuid,p_provider uuid default null,p_signature text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ai_studio_footage set provider_id=p_provider,provider_signature=p_signature,status=case when p_provider is null then 'uncertain' else 'queued' end
 where id=p_id and person_id in(select id from public.persons where auth_user_id=(select auth.uid())) and status in('submitting','uncertain') and provider_id is null;
 return found;
end $$;
-- Three-minute copy lease; task GET never calls generation. Stale leases are safely retriable.
create function public.ai_studio_footage_check(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ai_studio_footage set checked_at=now() where id=p_id and person_id in(select id from public.persons where auth_user_id=(select auth.uid())) and status='queued' and (checked_at is null or checked_at<now()-interval '3 minutes');
 return found;
end $$;
create function public.ai_studio_footage_finish(p_id uuid,p_status text,p_key text default null,p_credits numeric default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_project uuid;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 select project_id into v_project from public.ai_studio_footage where id=p_id and person_id=v_person;
 if v_person is null or p_status is null or p_status not in('queued','complete','failed') or
 (p_status='complete' and p_key is distinct from (select auth.uid())::text || '/' || v_project::text || '/' || p_id::text || '.mp4') or (p_status<>'complete' and p_key is not null) then raise exception 'Invalid footage completion'; end if;
 update public.ai_studio_footage set status=p_status,storage_key=p_key,provider_credits=p_credits,checked_at=case when p_status='queued' then now()-interval '165 seconds' else checked_at end where id=p_id and person_id=v_person and status='queued';
 return found;
end $$;
revoke all on function public.ai_studio_footage_quote(uuid,uuid,text,text,integer,text,timestamptz,text),public.ai_studio_footage_begin(uuid),public.ai_studio_footage_receipt(uuid,uuid,text),public.ai_studio_footage_check(uuid),public.ai_studio_footage_finish(uuid,text,text,numeric) from public,anon;
grant execute on function public.ai_studio_footage_quote(uuid,uuid,text,text,integer,text,timestamptz,text),public.ai_studio_footage_begin(uuid),public.ai_studio_footage_receipt(uuid,uuid,text),public.ai_studio_footage_check(uuid),public.ai_studio_footage_finish(uuid,text,text,numeric) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('aethelios-studio-video','aethelios-studio-video',false,30000000,array['video/mp4']) on conflict(id) do nothing;
create policy studio_video_objects_owner on storage.objects for all to authenticated using(bucket_id='aethelios-studio-video' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='aethelios-studio-video' and (storage.foldername(name))[1]=(select auth.uid())::text);
