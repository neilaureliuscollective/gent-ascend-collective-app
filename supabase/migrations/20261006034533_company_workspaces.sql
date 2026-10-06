-- Owner-only company rooms. No automatic migration of personal records or client access.
create table public.companies (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.persons(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 100),
 brief text not null default '' check(length(brief)<=12000),
 version integer not null default 1 check(version>0),
 confirmed_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(person_id,id)
);
create function public.company_confirm_brief() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.version<>old.version+1 then raise exception 'Invalid brief version' using errcode='22023'; end if;
 if tg_op='INSERT' then new.version=1; new.created_at=now(); end if;
 new.confirmed_at=now();
 return new;
end $$;
create trigger company_confirm_brief before insert or update on public.companies
 for each row execute function public.company_confirm_brief();
revoke all on function public.company_confirm_brief() from public,anon,authenticated;
alter table public.companies enable row level security;
revoke all on public.companies from public,anon,authenticated;
grant select,insert on public.companies to authenticated;
grant update(name,brief,version,confirmed_at) on public.companies to authenticated;
create policy companies_owner on public.companies for all to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create index companies_owner on public.companies(person_id,created_at desc);

alter table public.ai_conversations add column company_id uuid;
alter table public.ai_conversations add constraint ai_conversation_company_owner
 foreign key(person_id,company_id) references public.companies(person_id,id);
create index ai_conversations_company on public.ai_conversations(person_id,company_id,updated_at desc);
create function public.company_binding_immutable() returns trigger
 language plpgsql set search_path='' as $$
begin
 if new.company_id is distinct from old.company_id or new.person_id is distinct from old.person_id then
  raise exception 'Conversation scope is immutable' using errcode='42501';
 end if;
 return new;
end $$;
create trigger company_binding_immutable before update on public.ai_conversations
 for each row execute function public.company_binding_immutable();
revoke all on function public.company_binding_immutable() from public,anon,authenticated;

-- Each model request records exactly which confirmed brief it received.
alter table public.ai_turns add constraint ai_turn_person_identity unique(person_id,id);
create table public.company_turn_context (
 request_id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 company_id uuid not null,
 name text not null, brief text not null, version integer not null, confirmed_at timestamptz not null,
 foreign key(person_id,request_id) references public.ai_turns(person_id,id) on delete cascade,
 foreign key(person_id,company_id) references public.companies(person_id,id)
);
alter table public.company_turn_context enable row level security;
revoke all on public.company_turn_context from public,anon,authenticated;
grant select on public.company_turn_context to authenticated;
create policy company_context_owner on public.company_turn_context for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

-- Preserve the quota engine behind wrappers; callers cannot bypass the scope check.
alter function public.ai_begin_turn(uuid,uuid,text,text,boolean,text) rename to ai_reserve_turn_internal;
revoke all on function public.ai_reserve_turn_internal(uuid,uuid,text,text,boolean,text) from public,anon,authenticated;
create function public.ai_begin_turn(p_conversation uuid,p_request uuid,p_text text,p_model text,p_context boolean,p_prompt_version text)
 returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if exists(select 1 from public.ai_conversations where id=p_conversation and company_id is not null) then
  raise exception 'Use company Talk' using errcode='42501'; end if;
 return public.ai_reserve_turn_internal(p_conversation,p_request,p_text,p_model,p_context,p_prompt_version);
end $$;
revoke all on function public.ai_begin_turn(uuid,uuid,text,text,boolean,text) from public,anon;
grant execute on function public.ai_begin_turn(uuid,uuid,text,text,boolean,text) to authenticated;

-- Narrow definer is needed to atomically insert a conversation and reserve the existing
-- quota-controlled turn (direct conversation/turn writes remain unavailable). Ownership
-- comes only from Auth, serialized by the same person lock as ai_begin_turn.
create function public.company_begin_turn(p_company uuid,p_conversation uuid,p_request uuid,p_text text,p_model text,p_prompt_version text)
 returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; bound_company uuid; company_record public.companies%rowtype;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 select * into company_record from public.companies where id=p_company and person_id=owner_id for share;
 if owner_id is null or company_record.id is null then
  raise exception 'Company not found' using errcode='42501'; end if;
 if exists(select 1 from public.ai_conversations where id=p_conversation) then
  select company_id into bound_company from public.ai_conversations where id=p_conversation and person_id=owner_id;
  if bound_company is distinct from p_company then raise exception 'Conversation scope mismatch' using errcode='42501'; end if;
 else
  insert into public.ai_conversations(id,person_id,title,company_id)
   values(p_conversation,owner_id,left(btrim(p_text),80),p_company);
 end if;
 perform public.ai_reserve_turn_internal(p_conversation,p_request,p_text,p_model,false,p_prompt_version);
 insert into public.company_turn_context(request_id,person_id,company_id,name,brief,version,confirmed_at)
 values(p_request,owner_id,p_company,company_record.name,company_record.brief,company_record.version,company_record.confirmed_at);
 return p_request;
end $$;
revoke all on function public.company_begin_turn(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.company_begin_turn(uuid,uuid,uuid,text,text,text) to authenticated;

-- Legacy history/search remains unassigned; company rooms have their own history.
create or replace function public.ai_search_conversations(p_query text,p_limit integer default 30)
returns table(id uuid,title text,updated_at timestamptz,archived_at timestamptz,excerpt text)
language plpgsql security invoker set search_path='' as $$
begin
 if length(btrim(coalesce(p_query,'')))<2 or length(p_query)>120 or p_limit not between 1 and 50 then
  raise exception 'Invalid search' using errcode='22023'; end if;
 return query
 select c.id,c.title,c.updated_at,c.archived_at,
  coalesce((select left(m.content,180) from public.ai_messages m
    where m.conversation_id=c.id and m.person_id=c.person_id and m.status='complete'
      and to_tsvector('english',m.content) @@ websearch_to_tsquery('english',p_query)
    order by m.created_at desc limit 1),'')
 from public.ai_conversations c
 where c.company_id is null and c.person_id in (select p.id from public.persons p where p.auth_user_id=(select auth.uid()))
 and (to_tsvector('english',c.title) @@ websearch_to_tsquery('english',p_query)
   or exists(select 1 from public.ai_messages m where m.person_id=c.person_id and m.conversation_id=c.id
       and m.status='complete' and to_tsvector('english',m.content) @@ websearch_to_tsquery('english',p_query)))
 order by c.updated_at desc limit p_limit;
end $$;
create index company_turn_context_owner on public.company_turn_context(person_id,company_id);

-- Revisions also enforce scope directly, independent of any cached nested call.
create or replace function public.ai_begin_revision(p_conversation uuid,p_source uuid,p_request uuid,p_text text,p_kind text,p_model text,p_context boolean,p_prompt_version text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; source_turn record; latest_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if exists(select 1 from public.ai_conversations where id=p_conversation and company_id is not null) then raise exception 'Use company Talk' using errcode='42501'; end if;
 select * into source_turn from public.ai_turns where id=p_source and person_id=owner_id;
 if not found or source_turn.conversation_id<>p_conversation then raise exception 'Turn not found' using errcode='42501'; end if;
 select id into latest_id from public.ai_turns where conversation_id=source_turn.conversation_id
 order by created_at desc,id desc limit 1;
 if latest_id<>p_source or source_turn.status='pending' then raise exception 'Only the latest reply can be revised' using errcode='P0001'; end if;
 if p_kind not in ('retry','regenerate','edit') or
    (p_kind='retry' and source_turn.status='complete') or
    (p_kind='regenerate' and source_turn.status<>'complete') then
   raise exception 'Invalid revision' using errcode='22023'; end if;
 perform public.ai_begin_turn(source_turn.conversation_id,p_request,p_text,p_model,p_context,p_prompt_version);
 update public.ai_turns set parent_turn_id=p_source,revision_kind=p_kind where id=p_request and person_id=owner_id;
 return p_request;
end $$;
