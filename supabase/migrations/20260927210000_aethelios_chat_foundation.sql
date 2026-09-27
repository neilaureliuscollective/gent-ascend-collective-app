-- Expand the established chat ledger without changing saved turn IDs or action links.
alter table public.ai_conversations
 add column archived_at timestamptz,
 add column title_source text not null default 'first_message' check(title_source in ('first_message','generated','user')),
 add column context_summary text not null default '',
 add column summary_through uuid,
 add column summary_updated_at timestamptz;

alter table public.ai_turns
 add column parent_turn_id uuid references public.ai_turns(id) on delete set null,
 add column revision_kind text check(revision_kind in ('retry','regenerate','edit'));
create index ai_turns_parent on public.ai_turns(parent_turn_id) where parent_turn_id is not null;
create index ai_conversations_owner_active on public.ai_conversations(person_id,updated_at desc,id desc) where archived_at is null;

-- A durable per-message representation. Legacy turn IDs remain available to the
-- already-shipped feedback/action flow; the trigger keeps both representations atomic.
create table public.ai_messages (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid not null,
 turn_id uuid references public.ai_turns(id) on delete cascade,
 role text not null check(role in ('user','assistant','tool')),
 position smallint not null check(position in (0,1,2)),
 content text not null default '',
 parts jsonb not null default '[]'::jsonb check(jsonb_typeof(parts)='array'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 status text not null check(status in ('pending','complete','failed','cancelled')),
 created_at timestamptz not null default now(),
 unique(turn_id,role),
 unique(turn_id,position),
 unique(person_id,id),
 unique(person_id,conversation_id,id),
 check((role='tool' and turn_id is null) or (role in ('user','assistant') and turn_id is not null)),
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete cascade
);
create index ai_messages_conversation_order on public.ai_messages(person_id,conversation_id,created_at,position,id);
create index ai_messages_search on public.ai_messages using gin(to_tsvector('english',content)) where status='complete';
alter table public.ai_messages enable row level security;
revoke all on public.ai_messages from public,anon,authenticated;
grant select on public.ai_messages to authenticated;
create policy ai_messages_owner on public.ai_messages for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_sync_messages() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ai_messages(person_id,conversation_id,turn_id,role,position,content,parts,status,created_at)
 values(new.person_id,new.conversation_id,new.id,'user',0,new.user_text,
        jsonb_build_array(jsonb_build_object('type','text','text',new.user_text)), 'complete',new.created_at)
 on conflict(turn_id,role) do update set content=excluded.content,
   parts=(select coalesce(jsonb_agg(part),'[]'::jsonb) from jsonb_array_elements(public.ai_messages.parts) part where part->>'type'<>'text') || excluded.parts;
 insert into public.ai_messages(person_id,conversation_id,turn_id,role,position,content,parts,status,created_at)
 values(new.person_id,new.conversation_id,new.id,'assistant',1,new.assistant_text,
        case when new.assistant_text='' then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type','text','text',new.assistant_text)) end,
        new.status,new.created_at)
 on conflict(turn_id,role) do update set content=excluded.content,
   parts=(select coalesce(jsonb_agg(part),'[]'::jsonb) from jsonb_array_elements(public.ai_messages.parts) part where part->>'type'<>'text') || excluded.parts,
   status=excluded.status;
 return new;
end $$;
create trigger ai_turn_messages after insert or update of user_text,assistant_text,status on public.ai_turns
 for each row execute function public.ai_sync_messages();
insert into public.ai_messages(person_id,conversation_id,turn_id,role,position,content,parts,status,created_at)
 select person_id,conversation_id,id,'user',0,user_text,jsonb_build_array(jsonb_build_object('type','text','text',user_text)),'complete',created_at from public.ai_turns;
insert into public.ai_messages(person_id,conversation_id,turn_id,role,position,content,parts,status,created_at)
 select person_id,conversation_id,id,'assistant',1,assistant_text,
 case when assistant_text='' then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type','text','text',assistant_text)) end,
 status,created_at from public.ai_turns;

-- Metadata only. A later upload/Studio slice creates the private Storage bucket
-- and owner-validated write flow. Chat can evolve beyond text without changing IDs.
create table public.ai_message_assets (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid not null,
 message_id uuid not null,
 origin text not null check(origin in ('uploaded','generated')),
 media_type text not null check(length(media_type) between 3 and 100),
 storage_key text not null unique check(length(storage_key) between 1 and 500),
 original_name text check(length(original_name)<=255),
 byte_size bigint not null check(byte_size between 1 and 52428800),
 parent_asset_id uuid references public.ai_message_assets(id) on delete set null,
 created_at timestamptz not null default now(),
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete cascade,
 foreign key(person_id,conversation_id,message_id) references public.ai_messages(person_id,conversation_id,id) on delete cascade
);
create index ai_message_assets_message on public.ai_message_assets(person_id,message_id,created_at);
alter table public.ai_message_assets enable row level security;
revoke all on public.ai_message_assets from public,anon,authenticated;
grant select on public.ai_message_assets to authenticated;
create policy ai_message_assets_owner on public.ai_message_assets for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create table public.ai_aux_usage (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 kind text not null check(kind in ('title','summary')),
 created_at timestamptz not null default now(),
 input_tokens integer check(input_tokens>=0),
 output_tokens integer check(output_tokens>=0)
);
create index ai_aux_usage_owner_time on public.ai_aux_usage(person_id,created_at desc);
alter table public.ai_aux_usage enable row level security;
revoke all on public.ai_aux_usage from public,anon,authenticated;
grant select on public.ai_aux_usage to authenticated;
create policy ai_aux_usage_owner on public.ai_aux_usage for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create function public.ai_reserve_auxiliary(p_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_id is null or p_kind not in ('title','summary') then raise exception 'Invalid auxiliary request' using errcode='22023'; end if;
 if (select count(*) from public.ai_aux_usage where person_id=owner_id and created_at>now()-interval '24 hours')>=60
 or (select count(*) from public.ai_aux_usage where person_id=owner_id and created_at>now()-interval '1 minute')>=5 then
  raise exception 'Auxiliary usage limit reached' using errcode='P0001'; end if;
 insert into public.ai_aux_usage(id,person_id,kind) values(p_id,owner_id,p_kind);
 return true;
end $$;
create function public.ai_finish_auxiliary(p_id uuid,p_input integer,p_output integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 update public.ai_aux_usage set input_tokens=p_input,output_tokens=p_output
 where id=p_id and person_id in (select p.id from public.persons p where p.auth_user_id=(select auth.uid()))
 and input_tokens is null;
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.ai_reserve_auxiliary(uuid,text),public.ai_finish_auxiliary(uuid,integer,integer) from public,anon;
grant execute on function public.ai_reserve_auxiliary(uuid,text),public.ai_finish_auxiliary(uuid,integer,integer) to authenticated;

-- Search is bounded and executes as the session owner. No user ID is accepted.
create function public.ai_search_conversations(p_query text,p_limit integer default 30)
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
 where c.person_id in (select p.id from public.persons p where p.auth_user_id=(select auth.uid()))
 and (to_tsvector('english',c.title) @@ websearch_to_tsquery('english',p_query)
   or exists(select 1 from public.ai_messages m where m.person_id=c.person_id and m.conversation_id=c.id
       and m.status='complete' and to_tsvector('english',m.content) @@ websearch_to_tsquery('english',p_query)))
 order by c.updated_at desc limit p_limit;
end $$;
revoke all on function public.ai_search_conversations(text,integer) from public,anon;
grant execute on function public.ai_search_conversations(text,integer) to authenticated;

-- Metadata mutations are atomic and owner-derived. The application checks access too.
create function public.ai_update_conversation(p_id uuid,p_title text,p_archive boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if (p_title is null and p_archive is null) or (p_title is not null and length(btrim(p_title)) not between 1 and 80) then
  raise exception 'Invalid conversation update' using errcode='22023'; end if;
 update public.ai_conversations c set
   title=case when p_title is null then c.title else btrim(p_title) end,
   title_source=case when p_title is null then c.title_source else 'user' end,
   archived_at=case when p_archive is null then c.archived_at when p_archive then now() else null end
 where c.id=p_id and c.person_id in (select p.id from public.persons p where p.auth_user_id=(select auth.uid()));
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.ai_update_conversation(uuid,text,boolean) from public,anon;
grant execute on function public.ai_update_conversation(uuid,text,boolean) to authenticated;

create function public.ai_set_generated_title(p_id uuid,p_title text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if p_title is null or length(btrim(p_title)) not between 1 and 80 then return false; end if;
 update public.ai_conversations c set title=btrim(p_title),title_source='generated'
 where c.id=p_id and c.title_source='first_message'
 and c.person_id in (select p.id from public.persons p where p.auth_user_id=(select auth.uid()));
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.ai_set_generated_title(uuid,text) from public,anon;
grant execute on function public.ai_set_generated_title(uuid,text) to authenticated;

create function public.ai_save_thread_summary(p_id uuid,p_summary text,p_through uuid,p_expected uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; changed integer;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_summary is null or length(btrim(p_summary)) not between 1 and 6000
 or not exists(select 1 from public.ai_turns where id=p_through and conversation_id=p_id and person_id=owner_id and status='complete') then
  raise exception 'Invalid summary' using errcode='22023'; end if;
 update public.ai_conversations set context_summary=btrim(p_summary),summary_through=p_through,summary_updated_at=now()
 where id=p_id and person_id=owner_id and summary_through is not distinct from p_expected;
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.ai_save_thread_summary(uuid,text,uuid,uuid) from public,anon;
grant execute on function public.ai_save_thread_summary(uuid,text,uuid,uuid) to authenticated;

-- Preserve the existing atomic quota/idempotency reservation while removing
-- arbitrary history caps. List/history are paginated at the application layer.
create or replace function public.ai_begin_turn(p_conversation uuid,p_request uuid,p_text text,p_model text,p_context boolean,p_prompt_version text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_request is null or p_conversation is null or p_text is null or length(btrim(p_text)) not between 1 and 6000
    or p_prompt_version is null or length(p_prompt_version)>80 or p_model is null or length(p_model) not between 1 and 100 then
  raise exception 'Invalid turn' using errcode='22023'; end if;
 if exists(select 1 from public.ai_usage where id=p_request) then raise exception 'Duplicate request' using errcode='23505'; end if;
 if (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '24 hours')>=120
 or (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '1 minute')>=10 then
  raise exception 'Usage limit reached' using errcode='P0001'; end if;
 update public.ai_turns set status='failed',finished_at=now() where person_id=owner_id and status='pending' and created_at<now()-interval '2 minutes';
 if exists(select 1 from public.ai_turns where person_id=owner_id and status='pending') then raise exception 'Reply already in progress' using errcode='55P03'; end if;
 if exists(select 1 from public.ai_conversations where id=p_conversation and person_id<>owner_id) then raise exception 'Not found' using errcode='42501'; end if;
 insert into public.ai_conversations(id,person_id,title) values(p_conversation,owner_id,left(btrim(p_text),80)) on conflict(id) do nothing;
 if exists(select 1 from public.ai_conversations where id=p_conversation and archived_at is not null) then raise exception 'Conversation archived' using errcode='P0001'; end if;
 insert into public.ai_usage(id,person_id) values(p_request,owner_id);
 insert into public.ai_turns(id,person_id,conversation_id,user_text,model,context_included,prompt_version)
 values(p_request,owner_id,p_conversation,btrim(p_text),p_model,p_context,p_prompt_version);
 update public.ai_conversations set updated_at=now() where id=p_conversation;
 return p_request;
end $$;

create function public.ai_begin_revision(p_conversation uuid,p_source uuid,p_request uuid,p_text text,p_kind text,p_model text,p_context boolean,p_prompt_version text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; source_turn record; latest_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
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
revoke all on function public.ai_begin_revision(uuid,uuid,uuid,text,text,text,boolean,text) from public,anon;
grant execute on function public.ai_begin_revision(uuid,uuid,uuid,text,text,text,boolean,text) to authenticated;
