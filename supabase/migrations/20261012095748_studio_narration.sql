-- Additive, unapplied candidate. CLI generation was attempted but its home is read-only in this workspace.
create table public.ai_studio_narrations (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null, title text not null check(length(title) between 1 and 80),
 script text not null check(length(script) between 3 and 600),
 voice text not null check(voice in ('alloy','ash','coral')), tone text not null check(tone in ('clear','calm','confident')),
 model text not null default 'gpt-audio-1.5' check(model='gpt-audio-1.5'),
 status text not null default 'pending' check(status in ('pending','complete','failed')),
 storage_key text, duration double precision, failure_code text, created_at timestamptz not null default now(),
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade,
 check((status='complete' and storage_key is not null and duration is not null and duration>0 and duration<=60) or (status<>'complete' and storage_key is null and duration is null))
);
create index studio_narration_project on public.ai_studio_narrations(person_id,project_id,created_at desc);
create table public.ai_studio_narration_usage (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade, created_at timestamptz not null default now()
);
create index studio_narration_usage_time on public.ai_studio_narration_usage(person_id,created_at desc);
alter table public.ai_studio_narrations enable row level security;
alter table public.ai_studio_narration_usage enable row level security;
revoke all on public.ai_studio_narrations,public.ai_studio_narration_usage from public,anon,authenticated;
grant select on public.ai_studio_narrations,public.ai_studio_narration_usage to authenticated;
create policy studio_narrations_owner on public.ai_studio_narrations for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy studio_narration_usage_owner on public.ai_studio_narration_usage for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.ai_studio_narration_begin(p_id uuid,p_project uuid,p_title text,p_script text,p_voice text,p_tone text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or not exists(select 1 from public.ai_studio_projects p where id=p_project and person_id=v_person and (to_jsonb(p)->>'company_id') is null) then raise exception 'Studio project unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text,732));
 if exists(select 1 from public.ai_studio_narration_usage where id=p_id) then return false; end if;
 if (select count(*) from public.ai_studio_narration_usage where person_id=v_person and created_at>now()-interval '1 day')>=3 or exists(select 1 from public.ai_studio_narrations where person_id=v_person and status='pending') then raise exception 'Narration generation limit or concurrent request reached'; end if;
 insert into public.ai_studio_narrations(id,person_id,project_id,title,script,voice,tone) values(p_id,v_person,p_project,p_title,p_script,p_voice,p_tone);
 insert into public.ai_studio_narration_usage(id,person_id) values(p_id,v_person);
 return true;
end $$;
create function public.ai_studio_narration_finish(p_id uuid,p_status text,p_key text default null,p_duration double precision default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_person uuid;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or p_status is null or p_status not in ('complete','failed') then raise exception 'Invalid narration completion'; end if;
 if (p_status='complete' and (p_key is distinct from (select auth.uid())::text || '/' || (select project_id::text from public.ai_studio_narrations where id=p_id and person_id=v_person) || '/' || p_id::text || '.wav' or p_duration is null or not(p_duration>0 and p_duration<=60))) or (p_status='failed' and (p_key is not null or p_duration is not null)) then raise exception 'Invalid narration completion'; end if;
 update public.ai_studio_narrations set status=p_status,storage_key=p_key,duration=p_duration,failure_code=case when p_status='failed' then 'generation_failed' else null end where id=p_id and person_id=v_person and status='pending';
 return found;
end $$;
revoke all on function public.ai_studio_narration_begin(uuid,uuid,text,text,text,text),public.ai_studio_narration_finish(uuid,text,text,double precision) from public,anon;
grant execute on function public.ai_studio_narration_begin(uuid,uuid,text,text,text,text),public.ai_studio_narration_finish(uuid,text,text,double precision) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('aethelios-studio-audio','aethelios-studio-audio',false,3000000,array['audio/wav']) on conflict(id) do nothing;
create policy studio_audio_objects_owner on storage.objects for all to authenticated using(bucket_id='aethelios-studio-audio' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='aethelios-studio-audio' and (storage.foldername(name))[1]=(select auth.uid())::text);
