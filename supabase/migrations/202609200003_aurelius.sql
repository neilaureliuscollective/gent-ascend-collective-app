-- Aurelius conversations are private working records, never clinical truth.
create table public.ai_conversations (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 title text not null check(length(title) between 1 and 80),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(person_id,id)
);
create table public.ai_turns (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid not null,
 user_text text not null check(length(btrim(user_text)) between 1 and 6000),
 assistant_text text not null default '' check(length(assistant_text)<=64000),
 status text not null default 'pending' check(status in ('pending','complete','failed','cancelled')),
 model text not null check(length(model) between 1 and 100),
 context_included boolean not null,
 prompt_version text not null,
 feedback text check(feedback in ('helpful','needs_work')),
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete cascade
);
-- Non-content ledger survives conversation deletion so deleting a chat cannot reset limits.
create table public.ai_usage (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 created_at timestamptz not null default now(),
 input_tokens integer check(input_tokens>=0),
 output_tokens integer check(output_tokens>=0)
);
create table public.ai_memories (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 content text not null check(length(btrim(content)) between 1 and 500),
 kind text not null check(kind in ('preference','fact')),
 source text not null default 'user' check(source='user'),
 confirmed_at timestamptz not null default now(),
 version integer not null default 1 check(version>0)
);
create index ai_conversations_owner_time on public.ai_conversations(person_id,updated_at desc);
create index ai_turns_conversation_time on public.ai_turns(conversation_id,created_at);
create index ai_turns_pending on public.ai_turns(person_id,created_at) where status='pending';
create index ai_usage_owner_time on public.ai_usage(person_id,created_at);
create index ai_memories_owner on public.ai_memories(person_id);

alter table public.ai_conversations enable row level security;
alter table public.ai_turns enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_memories enable row level security;
revoke all on public.ai_conversations,public.ai_turns,public.ai_usage,public.ai_memories from public,anon,authenticated;
grant select,delete on public.ai_conversations to authenticated;
grant select on public.ai_turns,public.ai_usage,public.ai_memories to authenticated;
grant update(feedback) on public.ai_turns to authenticated;
grant all on public.ai_conversations,public.ai_turns,public.ai_usage,public.ai_memories to service_role;
create policy ai_conversations_owner on public.ai_conversations for all to authenticated using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy ai_turns_owner on public.ai_turns for all to authenticated using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy ai_usage_owner on public.ai_usage for select to authenticated using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy ai_memories_owner on public.ai_memories for select to authenticated using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));

-- These RPCs derive ownership from auth.uid(), never a supplied person ID.
-- No model credentials or external calls exist in SQL. The app rechecks capabilities
-- before spending provider credits. RPC content is user-owned, not a trusted audit log.
create function public.ai_begin_turn(p_conversation uuid,p_request uuid,p_text text,p_model text,p_context boolean,p_prompt_version text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_prompt_version is null or length(p_prompt_version)>80 then raise exception 'Invalid prompt version' using errcode='22023'; end if;
 if exists(select 1 from public.ai_usage where id=p_request) then raise exception 'Duplicate request' using errcode='23505'; end if;
 if (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '24 hours')>=120
 or (select count(*) from public.ai_usage where person_id=owner_id and created_at>now()-interval '1 minute')>=10 then
  raise exception 'Usage limit reached' using errcode='P0001';
 end if;
 update public.ai_turns set status='failed',finished_at=now() where person_id=owner_id and status='pending' and created_at<now()-interval '2 minutes';
 if exists(select 1 from public.ai_turns where person_id=owner_id and status='pending') then raise exception 'Reply already in progress' using errcode='55P03'; end if;
 if exists(select 1 from public.ai_conversations where id=p_conversation and person_id<>owner_id) then raise exception 'Not found' using errcode='42501'; end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation) then
  if (select count(*) from public.ai_conversations where person_id=owner_id)>=100 then raise exception 'Conversation limit reached' using errcode='P0001'; end if;
  insert into public.ai_conversations(id,person_id,title) values(p_conversation,owner_id,left(btrim(p_text),80));
 end if;
 if (select count(*) from public.ai_turns where conversation_id=p_conversation)>=200 then raise exception 'Start a new conversation' using errcode='P0001'; end if;
 insert into public.ai_usage(id,person_id) values(p_request,owner_id);
 insert into public.ai_turns(id,person_id,conversation_id,user_text,model,context_included,prompt_version)
 values(p_request,owner_id,p_conversation,btrim(p_text),p_model,p_context,p_prompt_version);
 update public.ai_conversations set updated_at=now() where id=p_conversation;
 return p_request;
end;
$$;
create function public.ai_finish_turn(p_request uuid,p_text text,p_status text,p_input integer default null,p_output integer default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; changed integer;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_status not in ('complete','failed','cancelled') or p_status is null then raise exception 'Invalid status' using errcode='22023'; end if;
 if p_status='complete' and length(btrim(p_text))=0 then raise exception 'Empty reply' using errcode='22023'; end if;
 update public.ai_turns set assistant_text=p_text,status=p_status,finished_at=now() where id=p_request and person_id=owner_id and status='pending';
 get diagnostics changed=row_count;
 if changed=1 then
  update public.ai_usage set input_tokens=p_input,output_tokens=p_output where id=p_request and person_id=owner_id;
 end if;
 return changed=1;
end;
$$;
create function public.ai_save_memory(p_id uuid,p_content text,p_kind text,p_version integer)
returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid; next_version integer;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_version=0 then
  if (select count(*) from public.ai_memories where person_id=owner_id)>=24 then raise exception 'Memory limit reached' using errcode='P0001'; end if;
  insert into public.ai_memories(id,person_id,content,kind) values(p_id,owner_id,btrim(p_content),p_kind) returning version into next_version;
 else
  update public.ai_memories set content=btrim(p_content),kind=p_kind,version=version+1,confirmed_at=now() where id=p_id and person_id=owner_id and version=p_version returning version into next_version;
 end if;
 if next_version is null then raise exception 'Memory changed or missing' using errcode='40001'; end if;
 return next_version;
end;
$$;
create function public.ai_delete_memory(p_id uuid,p_version integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 delete from public.ai_memories where id=p_id and version=p_version and person_id=(select id from public.persons where auth_user_id=(select auth.uid()));
 get diagnostics changed=row_count;
 return changed=1;
end;
$$;
revoke all on function public.ai_begin_turn(uuid,uuid,text,text,boolean,text),public.ai_finish_turn(uuid,text,text,integer,integer),public.ai_save_memory(uuid,text,text,integer),public.ai_delete_memory(uuid,integer) from public,anon;
grant execute on function public.ai_begin_turn(uuid,uuid,text,text,boolean,text),public.ai_finish_turn(uuid,text,text,integer,integer),public.ai_save_memory(uuid,text,text,integer),public.ai_delete_memory(uuid,integer) to authenticated;
