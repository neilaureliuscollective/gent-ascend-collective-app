-- Talk text creations are independent of Live voice admission. Hosted apply requires founder approval.
create function public.talk_creation_valid(p_kind text, p_content jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; step jsonb; dep text; ids text[];
begin
 if p_kind is null or p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>24000 then return false; end if;
 if p_kind='brief' then
  if not p_content ?& array['title','purpose','audience','visualDirection','requirements','unresolved']
   or (select count(*) from jsonb_object_keys(p_content))<>6
   or jsonb_typeof(p_content->'title')<>'string' or length(trim(p_content->>'title')) not between 1 and 80
   or jsonb_typeof(p_content->'purpose')<>'string' or length(p_content->>'purpose')>800
   or jsonb_typeof(p_content->'audience')<>'string' or length(p_content->>'audience')>500
   or jsonb_typeof(p_content->'visualDirection')<>'string' or length(p_content->>'visualDirection')>800
   or jsonb_typeof(p_content->'requirements')<>'array' or jsonb_array_length(p_content->'requirements')>12
   or jsonb_typeof(p_content->'unresolved')<>'array' or jsonb_array_length(p_content->'unresolved')>8 then return false; end if;
  for item in select value from jsonb_array_elements(p_content->'requirements') loop
   if jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 1 and 280 then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_content->'unresolved') loop
   if jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 1 and 280 then return false; end if;
  end loop;
  return true;
 elsif p_kind='plan' then
  if not p_content ?& array['title','summary','steps']
   or (select count(*) from jsonb_object_keys(p_content))<>3
   or jsonb_typeof(p_content->'title')<>'string' or length(trim(p_content->>'title')) not between 1 and 80
   or jsonb_typeof(p_content->'summary')<>'string' or length(p_content->>'summary')>500
   or jsonb_typeof(p_content->'steps')<>'array' or jsonb_array_length(p_content->'steps') not between 1 and 16 then return false; end if;
  ids := array[]::text[];
  for step in select value from jsonb_array_elements(p_content->'steps') loop
   if jsonb_typeof(step)<>'object' or not step ?& array['id','title','detail','dependsOn']
    or (select count(*) from jsonb_object_keys(step))<>4
    or jsonb_typeof(step->'id')<>'string' or (step->>'id') !~ '^[a-z][a-z0-9-]{0,31}$'
    or jsonb_typeof(step->'title')<>'string' or length(trim(step->>'title')) not between 1 and 120
    or jsonb_typeof(step->'detail')<>'string' or length(step->>'detail')>500
    or jsonb_typeof(step->'dependsOn')<>'array' or jsonb_array_length(step->'dependsOn')>8 then return false; end if;
   if step->>'id' = any(ids) then return false; end if;
   ids := ids || (step->>'id');
  end loop;
  for step in select value from jsonb_array_elements(p_content->'steps') loop
   for dep in select value#>>'{}' from jsonb_array_elements(step->'dependsOn') loop
    if dep is null or not dep = any(ids) or dep = step->>'id' then return false; end if;
   end loop;
  end loop;
  return true;
 elsif p_kind='palette' then
  if not p_content ?& array['title','notes','swatches','contrast']
   or (select count(*) from jsonb_object_keys(p_content))<>4
   or jsonb_typeof(p_content->'title')<>'string' or length(trim(p_content->>'title')) not between 1 and 80
   or jsonb_typeof(p_content->'notes')<>'string' or length(p_content->>'notes')>400
   or jsonb_typeof(p_content->'swatches')<>'array' or jsonb_array_length(p_content->'swatches') not between 2 and 12
   or jsonb_typeof(p_content->'contrast')<>'array' or jsonb_array_length(p_content->'contrast')>16 then return false; end if;
  for item in select value from jsonb_array_elements(p_content->'swatches') loop
   if jsonb_typeof(item)<>'object' or not item ?& array['hex','name','role']
    or (select count(*) from jsonb_object_keys(item))<>3
    or jsonb_typeof(item->'hex')<>'string' or (item->>'hex') !~ '^#[0-9A-Fa-f]{6}$'
    or jsonb_typeof(item->'name')<>'string' or length(trim(item->>'name')) not between 1 and 40
    or jsonb_typeof(item->'role')<>'string'
    or item->>'role' not in ('background','surface','text','accent','highlight','muted','border','custom') then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_content->'contrast') loop
   if jsonb_typeof(item)<>'object' or not item ?& array['foreground','background','ratio','pair','passesAa']
    or (select count(*) from jsonb_object_keys(item))<>5
    or jsonb_typeof(item->'foreground')<>'string' or (item->>'foreground') !~ '^#[0-9A-Fa-f]{6}$'
    or jsonb_typeof(item->'background')<>'string' or (item->>'background') !~ '^#[0-9A-Fa-f]{6}$'
    or jsonb_typeof(item->'pair')<>'string' or length(trim(item->>'pair')) not between 1 and 80
    or jsonb_typeof(item->'passesAa')<>'boolean' then return false; end if;
  end loop;
  return true;
 elsif p_kind='handoff' then
  if p_content->>'schema'<>'talk-architect-handoff/v1'
   or jsonb_typeof(p_content->'conversationId')<>'string'
   or jsonb_typeof(p_content->'idea')<>'string' or length(trim(p_content->>'idea')) not between 1 and 3000
   or jsonb_typeof(p_content->'selections')<>'array' or jsonb_array_length(p_content->'selections') not between 1 and 6
   or jsonb_typeof(p_content->'images')<>'array' or jsonb_array_length(p_content->'images')>6
   or p_content->>'imported'<>'false' then return false; end if;
  return true;
 end if;
 return false;
exception when others then return false;
end $$;
revoke all on function public.talk_creation_valid(text,jsonb) from public,anon;
grant execute on function public.talk_creation_valid(text,jsonb) to authenticated;

create table public.ai_talk_creations (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid not null,
 source_turn_id uuid,
 lineage_id uuid not null,
 version integer not null check(version between 1 and 200),
 kind text not null check(kind in ('brief','plan','palette','handoff')),
 content jsonb not null,
 predecessor_id uuid,
 superseded_by uuid,
 created_at timestamptz not null default now(),
 unique(person_id,conversation_id,id),
 unique(lineage_id,version),
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete cascade,
 foreign key(predecessor_id) references public.ai_talk_creations(id),
 check(public.talk_creation_valid(kind,content)),
 check(predecessor_id is null or predecessor_id<>id),
 check(superseded_by is null or superseded_by<>id)
);
create index ai_talk_creations_owner_time on public.ai_talk_creations(person_id,conversation_id,created_at desc);
create index ai_talk_creations_lineage on public.ai_talk_creations(person_id,lineage_id,version desc);
alter table public.ai_talk_creations enable row level security;
revoke all on public.ai_talk_creations from public,anon,authenticated;
grant select on public.ai_talk_creations to authenticated;
create policy talk_creations_owner on public.ai_talk_creations for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create table public.ai_talk_selection (
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid not null,
 kind text not null check(kind in ('brief','plan','palette')),
 creation_id uuid not null,
 primary key(person_id,conversation_id,kind),
 foreign key(person_id,conversation_id,creation_id) references public.ai_talk_creations(person_id,conversation_id,id) on delete cascade
);
alter table public.ai_talk_selection enable row level security;
revoke all on public.ai_talk_selection from public,anon,authenticated;
grant select on public.ai_talk_selection to authenticated;
create policy talk_selection_owner on public.ai_talk_selection for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_talk_save_creation(p_id uuid,p_conversation uuid,p_turn uuid,p_kind text,p_predecessor uuid,p_content jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; prior public.ai_talk_creations; existing public.ai_talk_creations; lineage uuid; next_version integer; turn_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_id is null or p_kind not in ('brief','plan','palette','handoff') or not public.talk_creation_valid(p_kind,p_content) then raise exception 'Invalid creation' using errcode='P0001'; end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id is null and archived_at is null) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 select * into existing from public.ai_talk_creations where id=p_id;
 if existing.id is not null then
  if existing.person_id=owner_id and existing.conversation_id=p_conversation and existing.kind=p_kind
     and existing.content=p_content and existing.predecessor_id is not distinct from p_predecessor then
   return jsonb_build_object('id',existing.id,'lineageId',existing.lineage_id,'version',existing.version,'recovered',true);
  end if;
  raise exception 'Creation request reused with different inputs' using errcode='23514';
 end if;
 if (select count(*) from public.ai_talk_creations where person_id=owner_id and created_at>now()-interval '1 minute')>=12 then raise exception 'Creation limit reached' using errcode='P0001'; end if;
 if p_predecessor is null then
  if p_turn is not null and not exists(select 1 from public.ai_turns where id=p_turn and person_id=owner_id and conversation_id=p_conversation) then raise exception 'Turn unavailable' using errcode='42501'; end if;
  lineage := p_id;
  next_version := 1;
  turn_id := p_turn;
 else
  select * into prior from public.ai_talk_creations where id=p_predecessor and person_id=owner_id and conversation_id=p_conversation for update;
  if prior.id is null or prior.kind<>p_kind or prior.superseded_by is not null then raise exception 'Stale creation version' using errcode='P0001'; end if;
  lineage := prior.lineage_id;
  next_version := prior.version+1;
  if next_version>200 then raise exception 'Creation version limit' using errcode='P0001'; end if;
  turn_id := prior.source_turn_id;
 end if;
 insert into public.ai_talk_creations(id,person_id,conversation_id,source_turn_id,lineage_id,version,kind,content,predecessor_id)
 values(p_id,owner_id,p_conversation,turn_id,lineage,next_version,p_kind,p_content,p_predecessor);
 if p_predecessor is not null then
  update public.ai_talk_creations set superseded_by=p_id where id=p_predecessor and person_id=owner_id and superseded_by is null;
  if not found then raise exception 'Stale creation version' using errcode='P0001'; end if;
 end if;
 if p_kind in ('brief','plan','palette') then
  insert into public.ai_talk_selection(person_id,conversation_id,kind,creation_id)
  values(owner_id,p_conversation,p_kind,p_id)
  on conflict(person_id,conversation_id,kind) do update set creation_id=excluded.creation_id;
 end if;
 return jsonb_build_object('id',p_id,'lineageId',lineage,'version',next_version);
end $$;

create function public.ai_talk_select_creation(p_conversation uuid,p_creation uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; chosen public.ai_talk_creations;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into chosen from public.ai_talk_creations where id=p_creation and person_id=owner_id and conversation_id=p_conversation;
 if chosen.id is null or chosen.kind not in ('brief','plan','palette') or chosen.superseded_by is not null then raise exception 'Creation unavailable' using errcode='42501'; end if;
 insert into public.ai_talk_selection(person_id,conversation_id,kind,creation_id)
 values(owner_id,p_conversation,chosen.kind,chosen.id)
 on conflict(person_id,conversation_id,kind) do update set creation_id=excluded.creation_id;
 return true;
end $$;

revoke all on function public.ai_talk_save_creation(uuid,uuid,uuid,text,uuid,jsonb),public.ai_talk_select_creation(uuid,uuid) from public,anon;
grant execute on function public.ai_talk_save_creation(uuid,uuid,uuid,text,uuid,jsonb),public.ai_talk_select_creation(uuid,uuid) to authenticated;
