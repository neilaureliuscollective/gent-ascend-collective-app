-- Personal work products: immutable versions, explicit review, no executor or model call.
create table public.mission_deliverables (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.persons(id) on delete cascade,
 mission_id uuid, source_turn_id uuid, source_mission_id uuid not null, source_revision integer not null,
 revision integer not null default 1 check(revision>0), created_at timestamptz not null default now(),
 unique(person_id,id), unique(person_id,source_mission_id,source_turn_id),
 foreign key(person_id,mission_id) references public.intelligence_missions(person_id,id) on delete set null(mission_id),
 foreign key(person_id,source_turn_id) references public.ai_turns(person_id,id) on delete set null(source_turn_id)
);
create table public.mission_deliverable_versions (
 id uuid primary key, person_id uuid not null, deliverable_id uuid not null, revision integer not null check(revision>0),
 title text not null check(length(btrim(title)) between 1 and 120),
 body text not null check(length(btrim(body)) between 1 and 50000),
 acceptance text not null default '' check(length(acceptance)<=2000),
 source text not null check(source in ('reply','manual')),
 reviewed_at timestamptz, review_note text check(length(btrim(review_note)) between 3 and 2000),
 created_at timestamptz not null default now(), unique(deliverable_id,revision),
 check((reviewed_at is null)=(review_note is null)),
 foreign key(person_id,deliverable_id) references public.mission_deliverables(person_id,id) on delete cascade
);
create index mission_deliverables_owner on public.mission_deliverables(person_id,mission_id,created_at desc);
alter table public.mission_deliverables enable row level security;
alter table public.mission_deliverable_versions enable row level security;
revoke all on public.mission_deliverables,public.mission_deliverable_versions from public,anon,authenticated;
grant select on public.mission_deliverables,public.mission_deliverable_versions to authenticated;
create policy deliverables_owner on public.mission_deliverables for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy deliverable_versions_owner on public.mission_deliverable_versions for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create function public.mission_create_deliverable(p_mission uuid,p_turn uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; m public.intelligence_missions%rowtype; t public.ai_turns%rowtype; d uuid;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid()) for update;
 select * into m from public.intelligence_missions where id=p_mission and person_id=o for share;
 if m.id is null then raise exception 'Mission unavailable' using errcode='42501'; end if;
 select id into d from public.mission_deliverables where person_id=o and source_mission_id=p_mission and source_turn_id=p_turn;
 if d is not null then return d; end if;
 if p_revision is null or m.revision<>p_revision or m.status in ('completed','archived') then raise exception 'Mission changed; reload' using errcode='40001'; end if;
 select * into t from public.ai_turns where id=p_turn and person_id=o and conversation_id=m.conversation_id and status='complete';
 if t.id is null or length(btrim(t.assistant_text)) not between 1 and 50000 then raise exception 'Completed reply of 1 to 50000 characters required' using errcode='22023'; end if;
 if (select count(*) from public.mission_deliverables where person_id=o)>=500 then raise exception 'Deliverable allowance reached' using errcode='22023'; end if;
 insert into public.mission_deliverables(person_id,mission_id,source_turn_id,source_mission_id,source_revision) values(o,m.id,t.id,m.id,m.revision) returning id into d;
 insert into public.mission_deliverable_versions(id,person_id,deliverable_id,revision,title,body,source) values(gen_random_uuid(),o,d,1,m.title,t.assistant_text,'reply');
 return d;
end $$;
create function public.mission_save_deliverable(p_id uuid,p_version uuid,p_expected integer,p_title text,p_body text,p_acceptance text) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; d public.mission_deliverables%rowtype; old public.mission_deliverable_versions%rowtype;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid());
 select * into d from public.mission_deliverables where id=p_id and person_id=o for update;
 if d.id is null then raise exception 'Deliverable unavailable' using errcode='42501'; end if;
 select * into old from public.mission_deliverable_versions where id=p_version;
 if found then
  if old.person_id=o and old.deliverable_id=p_id and old.revision=p_expected+1 and old.source='manual' and old.title=p_title and old.body=p_body and old.acceptance=p_acceptance then return old.id; end if;
  raise exception 'Version request changed' using errcode='22023';
 end if;
 if p_expected is null or d.revision<>p_expected then raise exception 'Deliverable changed; reload' using errcode='40001'; end if;
 if d.revision>=100 then raise exception 'Version allowance reached' using errcode='22023'; end if;
 insert into public.mission_deliverable_versions(id,person_id,deliverable_id,revision,title,body,acceptance,source) values(p_version,o,d.id,d.revision+1,p_title,p_body,p_acceptance,'manual');
 update public.mission_deliverables set revision=revision+1 where id=d.id;
 return p_version;
end $$;
create function public.mission_review_deliverable(p_id uuid,p_version uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; d public.mission_deliverables%rowtype; v public.mission_deliverable_versions%rowtype;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid());
 select * into d from public.mission_deliverables where id=p_id and person_id=o for update;
 select * into v from public.mission_deliverable_versions where id=p_version and person_id=o and deliverable_id=p_id;
 if d.id is null or v.id is null then raise exception 'Deliverable unavailable' using errcode='42501'; end if;
 if v.reviewed_at is not null then
  if v.review_note=p_note then return v.id; end if;
  raise exception 'Review request changed' using errcode='22023';
 end if;
 if d.revision<>v.revision then raise exception 'Deliverable changed; review latest version' using errcode='40001'; end if;
 if p_note is null or length(btrim(p_note)) not between 3 and 2000 or length(btrim(v.acceptance))<3 then raise exception 'Record acceptance criteria and a review note first' using errcode='22023'; end if;
 update public.mission_deliverable_versions set reviewed_at=now(),review_note=p_note where id=v.id;
 return v.id;
end $$;
revoke all on function public.mission_create_deliverable(uuid,uuid,integer),public.mission_save_deliverable(uuid,uuid,integer,text,text,text),public.mission_review_deliverable(uuid,uuid,text) from public,anon;
grant execute on function public.mission_create_deliverable(uuid,uuid,integer),public.mission_save_deliverable(uuid,uuid,integer,text,text,text),public.mission_review_deliverable(uuid,uuid,text) to authenticated;

-- Capture exact version IDs and bounded text only when Mission context is explicitly used.
create or replace function public.mission_capture_context(p_turn uuid,p_mission uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid; m public.intelligence_missions%rowtype; d jsonb; previous public.mission_turn_context%rowtype;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid());
 select * into m from public.intelligence_missions where id=p_mission and person_id=o for share;
 if m.id is null or not exists(select 1 from public.ai_turns where id=p_turn and person_id=o and conversation_id=m.conversation_id and status='pending') then raise exception 'Mission context unavailable' using errcode='42501'; end if;
 select * into previous from public.mission_turn_context where turn_id=p_turn;
 if found then
  if previous.mission_id=p_mission and previous.revision=p_revision then return previous.direction; end if;
  raise exception 'Context request changed' using errcode='22023';
 end if;
 if m.revision<>p_revision or m.status in ('archived','completed') then raise exception 'Mission changed; reload' using errcode='40001'; end if;
 d=jsonb_build_object('title',m.title,'objective',m.objective,'decisions',m.decisions,'open_questions',m.open_questions,'next_actions',m.next_actions,'revision',m.revision);
 d=d || jsonb_build_object('saved_outputs',coalesce((select jsonb_agg(x) from (
  select t.id as source_turn,left(t.assistant_text,1800) as excerpt from public.mission_outputs p join public.ai_turns t on t.id=p.turn_id and t.person_id=o
  where p.mission_id=m.id and p.person_id=o and t.status='complete' order by p.created_at desc limit 3
 ) x),'[]'::jsonb),'studio', (select jsonb_build_object('project_id',l.project_id,'brief',s.brief,'source_revision',l.source_revision,'images_not_inspected',true)
 from public.mission_studio_links l join public.ai_studio_projects s on s.id=l.project_id and s.person_id=o and s.company_id is null where l.mission_id=m.id and l.person_id=o));
 d=d || jsonb_build_object('deliverables',coalesce((select jsonb_agg(x) from (
 select d.id as deliverable_id,v.id as version_id,v.revision,v.title,left(v.body,1800) as excerpt,left(v.acceptance,600) as acceptance,v.reviewed_at is not null as reviewed_by_user
 from public.mission_deliverables d join public.mission_deliverable_versions v on v.deliverable_id=d.id and v.person_id=o and v.revision=d.revision
 where d.person_id=o and d.mission_id=m.id order by v.created_at desc,d.id limit 3
 ) x),'[]'::jsonb));
 insert into public.mission_turn_context values(p_turn,o,m.id,m.revision,d);
 return d;
end $$;

create view public.mission_deliverable_summaries with (security_invoker=true) as
 select d.*,v.title,(v.reviewed_at is not null) as reviewed
 from public.mission_deliverables d join public.mission_deliverable_versions v
 on v.deliverable_id=d.id and v.person_id=d.person_id and v.revision=d.revision;
revoke all on public.mission_deliverable_summaries from public,anon,authenticated;
grant select on public.mission_deliverable_summaries to authenticated;

create function public.mission_delete_deliverable(p_id uuid,p_expected integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; d public.mission_deliverables%rowtype;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid());
 select * into d from public.mission_deliverables where id=p_id and person_id=o for update;
 if d.id is null then raise exception 'Deliverable unavailable' using errcode='42501'; end if;
 if p_expected is null or d.revision<>p_expected then raise exception 'Deliverable changed; reload' using errcode='40001'; end if;
 delete from public.mission_deliverables where id=d.id;
 return d.id;
end $$;
revoke all on function public.mission_delete_deliverable(uuid,integer) from public,anon;
grant execute on function public.mission_delete_deliverable(uuid,integer) to authenticated;
