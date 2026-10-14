-- Preserve stale Talk proposals without overwriting the current version.
-- Hosted apply requires founder authorization; this file is not production access.
alter table public.ai_talk_creations
  add column if not exists candidate boolean not null default false;

create function public.ai_talk_save_candidate(p_id uuid,p_conversation uuid,p_turn uuid,p_kind text,p_base uuid,p_content jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; prior public.ai_talk_creations; existing public.ai_talk_creations; next_version integer;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_id is null or p_base is null or p_kind not in ('brief','plan','palette') or not public.talk_creation_valid(p_kind,p_content) then raise exception 'Invalid creation' using errcode='P0001'; end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id is null and archived_at is null) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 if p_turn is null or not exists(select 1 from public.ai_turns where id=p_turn and person_id=owner_id and conversation_id=p_conversation) then raise exception 'Turn unavailable' using errcode='42501'; end if;
 select * into existing from public.ai_talk_creations where id=p_id;
 if existing.id is not null then
  if existing.person_id=owner_id and existing.conversation_id=p_conversation and existing.kind=p_kind
     and existing.candidate and existing.content=p_content and existing.predecessor_id is not distinct from p_base then
   return jsonb_build_object('id',existing.id,'lineageId',existing.lineage_id,'version',existing.version,'recovered',true,'candidate',true);
  end if;
  raise exception 'Creation request reused with different inputs' using errcode='23514';
 end if;
 select * into prior from public.ai_talk_creations where id=p_base and person_id=owner_id and conversation_id=p_conversation;
 if prior.id is null or prior.kind<>p_kind then raise exception 'Base version unavailable' using errcode='42501'; end if;
 if (select count(*) from public.ai_talk_creations where person_id=owner_id and created_at>now()-interval '1 minute')>=12 then raise exception 'Creation limit reached' using errcode='P0001'; end if;
 next_version := (select coalesce(max(version),0)+1 from public.ai_talk_creations where lineage_id=prior.lineage_id);
 if next_version>200 then raise exception 'Creation version limit' using errcode='P0001'; end if;
 insert into public.ai_talk_creations(id,person_id,conversation_id,source_turn_id,lineage_id,version,kind,content,predecessor_id,candidate)
 values(p_id,owner_id,p_conversation,p_turn,prior.lineage_id,next_version,p_kind,p_content,p_base,true);
 return jsonb_build_object('id',p_id,'lineageId',prior.lineage_id,'version',next_version,'candidate',true);
end $$;

create or replace function public.ai_talk_select_creation(p_conversation uuid,p_creation uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; chosen public.ai_talk_creations;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select * into chosen from public.ai_talk_creations where id=p_creation and person_id=owner_id and conversation_id=p_conversation;
 if chosen.id is null or chosen.kind not in ('brief','plan','palette') or chosen.superseded_by is not null or chosen.candidate then raise exception 'Creation unavailable' using errcode='42501'; end if;
 insert into public.ai_talk_selection(person_id,conversation_id,kind,creation_id)
 values(owner_id,p_conversation,chosen.kind,chosen.id)
 on conflict(person_id,conversation_id,kind) do update set creation_id=excluded.creation_id;
 return true;
end $$;

create or replace function public.ai_talk_save_creation(p_id uuid,p_conversation uuid,p_turn uuid,p_kind text,p_predecessor uuid,p_content jsonb)
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
  if prior.id is null or prior.kind<>p_kind or prior.superseded_by is not null or prior.candidate then raise exception 'Stale creation version' using errcode='P0001'; end if;
  lineage := prior.lineage_id;
  next_version := (select coalesce(max(version),0)+1 from public.ai_talk_creations where lineage_id=prior.lineage_id);
  if next_version>200 then raise exception 'Creation version limit' using errcode='P0001'; end if;
  turn_id := prior.source_turn_id;
 end if;
 insert into public.ai_talk_creations(id,person_id,conversation_id,source_turn_id,lineage_id,version,kind,content,predecessor_id)
 values(p_id,owner_id,p_conversation,turn_id,lineage,next_version,p_kind,p_content,p_predecessor);
 if p_predecessor is not null then
  update public.ai_talk_creations set superseded_by=p_id where id=p_predecessor and person_id=owner_id and superseded_by is null and not candidate;
  if not found then raise exception 'Stale creation version' using errcode='P0001'; end if;
 end if;
 if p_kind in ('brief','plan','palette') then
  insert into public.ai_talk_selection(person_id,conversation_id,kind,creation_id)
  values(owner_id,p_conversation,p_kind,p_id)
  on conflict(person_id,conversation_id,kind) do update set creation_id=excluded.creation_id;
 end if;
 return jsonb_build_object('id',p_id,'lineageId',lineage,'version',next_version);
end $$;

revoke all on function public.ai_talk_save_candidate(uuid,uuid,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.ai_talk_save_candidate(uuid,uuid,uuid,text,uuid,jsonb) to authenticated;
revoke all on function public.ai_talk_save_creation(uuid,uuid,uuid,text,uuid,jsonb), public.ai_talk_select_creation(uuid,uuid) from public,anon;
grant execute on function public.ai_talk_save_creation(uuid,uuid,uuid,text,uuid,jsonb), public.ai_talk_select_creation(uuid,uuid) to authenticated;
