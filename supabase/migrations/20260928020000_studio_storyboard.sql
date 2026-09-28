-- A small ordered storyboard belongs to one private Studio project.
create table public.ai_studio_scenes (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null,
 project_id uuid not null,
 position integer not null check(position>0),
 title text not null check(length(title) between 1 and 80),
 message text not null default '' check(length(message)<=300),
 visual_direction text not null default '' check(length(visual_direction)<=700),
 motion_note text not null default '' check(length(motion_note)<=300),
 channel text not null default 'social' check(channel in ('social','website','pitch','print')),
 asset_version_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(person_id,project_id,id),
 unique(person_id,project_id,position),
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade,
 foreign key(person_id,project_id,asset_version_id) references public.ai_studio_versions(person_id,project_id,id)
);
create index ai_studio_scenes_project on public.ai_studio_scenes(person_id,project_id,position);
alter table public.ai_studio_scenes enable row level security;
grant select,delete on public.ai_studio_scenes to authenticated;
grant update(title,message,visual_direction,motion_note,channel,asset_version_id,updated_at) on public.ai_studio_scenes to authenticated;
create policy studio_scenes_owner on public.ai_studio_scenes for all to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_studio_scene_create(p_project uuid,p_title text,p_message text,p_visual text,p_motion text,p_channel text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_person uuid;v_position integer;v_id uuid;
begin
 select id into v_person from public.persons where auth_user_id=(select auth.uid());
 if v_person is null or not exists(select 1 from public.ai_studio_projects where id=p_project and person_id=v_person) then
  raise exception 'Studio project unavailable';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text || p_project::text,799));
 if (select count(*) from public.ai_studio_scenes where person_id=v_person and project_id=p_project)>=8 then
  raise exception 'Storyboard has eight scenes';
 end if;
 select coalesce(max(position),0)+1 into v_position from public.ai_studio_scenes where person_id=v_person and project_id=p_project;
 insert into public.ai_studio_scenes(person_id,project_id,position,title,message,visual_direction,motion_note,channel)
 values(v_person,p_project,v_position,p_title,p_message,p_visual,p_motion,p_channel) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ai_studio_scene_create(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.ai_studio_scene_create(uuid,text,text,text,text,text) to authenticated;
