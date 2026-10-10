-- Immutable version reference, not a duplicated brief. No hosted provisioning.
create table public.technology_turn_context (
 turn_id uuid primary key,
 person_id uuid not null,
 project_id uuid not null,
 revision integer not null,
 created_at timestamptz not null default now(),
 foreign key(person_id,turn_id) references public.ai_turns(person_id,id) on delete cascade,
 foreign key(person_id,project_id) references public.technology_projects(person_id,id) on delete cascade,
 foreign key(project_id,revision) references public.technology_site_versions(project_id,revision)
);
create index technology_context_owner on public.technology_turn_context(person_id,project_id);
alter table public.technology_turn_context enable row level security;
revoke all on public.technology_turn_context from public,anon,authenticated;
grant select on public.technology_turn_context to authenticated;
create policy technology_context_owner_read on public.technology_turn_context for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.technology_capture_context(p_turn uuid,p_project uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid:=public.technology_owner(); p public.technology_projects; v public.technology_site_versions; old public.technology_turn_context;
begin
 select * into p from public.technology_projects where id=p_project and person_id=o for share;
 if not found or p.revision<>p_revision then raise exception 'Website changed; reload' using errcode='40001'; end if;
 perform 1 from public.intelligence_missions m join public.ai_turns t
 on t.conversation_id=m.conversation_id and t.person_id=m.person_id
 where m.id=p.mission_id and m.person_id=o and m.status not in ('archived','completed')
 and t.id=p_turn and t.status='pending' for share of m;
 if not found then raise exception 'Website conversation unavailable' using errcode='42501'; end if;
 select * into v from public.technology_site_versions where project_id=p.id and person_id=o and revision=p_revision;
 if not found then raise exception 'Website version unavailable' using errcode='42501'; end if;
 if octet_length(v.brief::text)>13000 then raise exception 'Website context limit exceeded'; end if;
 select * into old from public.technology_turn_context where turn_id=p_turn;
 if found then
  if old.person_id<>o or old.project_id<>p.id or old.revision<>p_revision then raise exception 'Website context changed'; end if;
 else
  insert into public.technology_turn_context(turn_id,person_id,project_id,revision) values(p_turn,o,p.id,p_revision);
 end if;
 return jsonb_build_object('projectId',p.id,'versionId',v.id,'revision',v.revision,'reviewed',v.reviewed_at is not null,'brief',v.brief);
end $$;
revoke all on function public.technology_capture_context(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.technology_capture_context(uuid,uuid,integer) to authenticated;
