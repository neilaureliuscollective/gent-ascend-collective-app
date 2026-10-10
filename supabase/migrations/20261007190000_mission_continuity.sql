-- Public Mission continuity. Additive; no new execution or global memory authority.
alter table public.intelligence_missions add constraint mission_owner_identity unique(person_id,id);
create table public.mission_proposals (
 id uuid primary key, person_id uuid not null, mission_id uuid not null,
 source_turn_id uuid not null, base_revision integer not null check(base_revision>0),
 direction jsonb not null check(jsonb_typeof(direction)='object' and octet_length(direction::text)<=50000),
 status text not null default 'pending' check(status in ('pending','accepted','dismissed')),
 input_tokens integer not null default 0 check(input_tokens>=0), output_tokens integer not null default 0 check(output_tokens>=0), elapsed_ms integer not null default 0 check(elapsed_ms>=0),
 accepted_direction jsonb, created_at timestamptz not null default now(),
 foreign key(person_id,mission_id) references public.intelligence_missions(person_id,id) on delete cascade,
 foreign key(person_id,source_turn_id) references public.ai_turns(person_id,id) on delete cascade
);
create table public.mission_studio_links (
 mission_id uuid primary key, person_id uuid not null, project_id uuid not null unique,
 source_revision integer not null, created_at timestamptz not null default now(),
 foreign key(person_id,mission_id) references public.intelligence_missions(person_id,id) on delete cascade,
 foreign key(person_id,project_id) references public.ai_studio_projects(person_id,id) on delete cascade
);
create table public.mission_outputs (
 id uuid primary key default gen_random_uuid(), person_id uuid not null, mission_id uuid not null,
 turn_id uuid not null, created_at timestamptz not null default now(), unique(mission_id,turn_id),
 foreign key(person_id,mission_id) references public.intelligence_missions(person_id,id) on delete cascade,
 foreign key(person_id,turn_id) references public.ai_turns(person_id,id) on delete cascade
);
create table public.mission_turn_context (
 turn_id uuid primary key, person_id uuid not null, mission_id uuid not null,
 revision integer not null, direction jsonb not null,
 foreign key(person_id,mission_id) references public.intelligence_missions(person_id,id) on delete cascade,
 foreign key(person_id,turn_id) references public.ai_turns(person_id,id) on delete cascade
);
create index mission_proposal_owner on public.mission_proposals(person_id,mission_id,created_at desc);
create index mission_outputs_owner on public.mission_outputs(person_id,mission_id);
alter table public.mission_proposals enable row level security;
alter table public.mission_studio_links enable row level security;
alter table public.mission_outputs enable row level security;
alter table public.mission_turn_context enable row level security;
revoke all on public.mission_proposals,public.mission_studio_links,public.mission_outputs,public.mission_turn_context from public,anon,authenticated;
grant select on public.mission_proposals,public.mission_studio_links,public.mission_outputs,public.mission_turn_context to authenticated;
create policy mission_proposals_owner on public.mission_proposals for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy mission_links_owner on public.mission_studio_links for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy mission_outputs_owner on public.mission_outputs for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy mission_context_owner on public.mission_turn_context for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create function public.mission_capture_context(p_turn uuid,p_mission uuid,p_revision integer) returns jsonb
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
 insert into public.mission_turn_context values(p_turn,o,m.id,m.revision,d);
 return d;
end $$;
create function public.mission_store_proposal(p_id uuid,p_mission uuid,p_turn uuid,p_revision integer,p_direction jsonb,p_input integer default 0,p_output integer default 0,p_elapsed integer default 0) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; m public.intelligence_missions%rowtype; old public.mission_proposals%rowtype;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid()) for update;
 select * into m from public.intelligence_missions where id=p_mission and person_id=o for share;
 if m.id is null or not exists(select 1 from public.ai_turns where id=p_turn and person_id=o and conversation_id=m.conversation_id and status='complete') then raise exception 'Saved Mission turn required' using errcode='42501'; end if;
 select * into old from public.mission_proposals where id=p_id;
 if found then
  if old.person_id=o and old.mission_id=p_mission and old.source_turn_id=p_turn and old.base_revision=p_revision and old.direction=p_direction then return p_id; end if;
  raise exception 'Proposal request changed' using errcode='22023';
 end if;
 if m.revision<>p_revision or m.status in ('archived','completed') then raise exception 'Mission changed; reload' using errcode='40001'; end if;
 insert into public.mission_proposals(id,person_id,mission_id,source_turn_id,base_revision,direction,input_tokens,output_tokens,elapsed_ms) values(p_id,o,p_mission,p_turn,p_revision,p_direction,p_input,p_output,p_elapsed);
 return p_id;
end $$;
create function public.mission_decide_proposal(p_id uuid,p_accept boolean,p_direction jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; p public.mission_proposals%rowtype; m public.intelligence_missions%rowtype;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid()) for update;
 select * into p from public.mission_proposals where id=p_id and person_id=o for update;
 if p.id is null then raise exception 'Proposal unavailable' using errcode='42501'; end if;
 if p.status<>'pending' then
  if (p_accept and p.status='accepted' and p.accepted_direction=p_direction) or (not p_accept and p.status='dismissed' and p_direction is null) then return p.mission_id; end if;
  raise exception 'Decision request changed' using errcode='22023';
 end if;
 if p_accept then
  select * into m from public.intelligence_missions where id=p.mission_id and person_id=o for update;
  if m.revision<>p.base_revision or m.status in ('archived','completed') then raise exception 'Mission changed; reload and prepare a new proposal' using errcode='40001'; end if;
  if p_direction is null or jsonb_typeof(p_direction)<>'object' or exists(select 1 from unnest(array['title','objective','decisions','open_questions','next_actions']) k where jsonb_typeof(p_direction->k) is distinct from 'string') or (p_direction - array['title','objective','decisions','open_questions','next_actions'])<>'{}'::jsonb then raise exception 'Invalid direction' using errcode='22023'; end if;
  update public.intelligence_missions set title=p_direction->>'title',objective=p_direction->>'objective',decisions=p_direction->>'decisions',open_questions=p_direction->>'open_questions',next_actions=p_direction->>'next_actions',revision=revision+1,updated_at=now() where id=m.id;
 elsif p_direction is not null then raise exception 'Dismissal has no direction' using errcode='22023'; end if;
 update public.mission_proposals set status=case when p_accept then 'accepted' else 'dismissed' end,accepted_direction=p_direction where id=p.id;
 return p.mission_id;
end $$;
create function public.mission_pin_output(p_mission uuid,p_turn uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; m public.intelligence_missions%rowtype; result uuid;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid());
 select * into m from public.intelligence_missions where id=p_mission and person_id=o for share;
 if m.id is null or not exists(select 1 from public.ai_turns where id=p_turn and person_id=o and conversation_id=m.conversation_id and status='complete') then raise exception 'Completed Mission output required' using errcode='42501'; end if;
 insert into public.mission_outputs(person_id,mission_id,turn_id) values(o,m.id,p_turn) on conflict(mission_id,turn_id) do nothing;
 select id into result from public.mission_outputs where mission_id=m.id and turn_id=p_turn;
 return result;
end $$;
create function public.mission_open_studio(p_mission uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare o uuid; m public.intelligence_missions%rowtype; project uuid;
begin
 select id into o from public.persons where auth_user_id=(select auth.uid()) for update;
 select * into m from public.intelligence_missions where id=p_mission and person_id=o for update;
 if m.id is null then raise exception 'Mission unavailable' using errcode='42501'; end if;
 select project_id into project from public.mission_studio_links where mission_id=m.id and person_id=o;
 if project is not null then return project; end if;
 if m.revision<>p_revision or m.status in ('archived','completed') then raise exception 'Mission changed; reload' using errcode='40001'; end if;
 project=gen_random_uuid();
 insert into public.ai_studio_projects(id,person_id,title,creative_type,brief) values(project,o,left(m.title,80),'personal',jsonb_build_object('purpose',left(m.objective,500),'direction',left(m.decisions,700),'audience','','palette','','avoid',''));
 insert into public.mission_studio_links(mission_id,person_id,project_id,source_revision) values(m.id,o,project,m.revision);
 return project;
end $$;
revoke all on function public.mission_capture_context(uuid,uuid,integer),public.mission_store_proposal(uuid,uuid,uuid,integer,jsonb,integer,integer,integer),public.mission_decide_proposal(uuid,boolean,jsonb),public.mission_pin_output(uuid,uuid),public.mission_open_studio(uuid,integer) from public,anon;
grant execute on function public.mission_capture_context(uuid,uuid,integer),public.mission_store_proposal(uuid,uuid,uuid,integer,jsonb,integer,integer,integer),public.mission_decide_proposal(uuid,boolean,jsonb),public.mission_pin_output(uuid,uuid),public.mission_open_studio(uuid,integer) to authenticated;
