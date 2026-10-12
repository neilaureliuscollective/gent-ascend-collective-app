-- Default-off, founder/beta-only voice pilot. Reservations survive chat deletion.
create table public.ai_live_sessions (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '120 seconds'),
 ended_at timestamptz,
 call_id text,
 call_tag text,
 model text not null check(length(model) between 1 and 80),
 reserved_seconds integer not null default 120 check(reserved_seconds=120),
 input_tokens bigint not null default 0 check(input_tokens>=0),
 output_tokens bigint not null default 0 check(output_tokens>=0),
 reason text check(reason in ('ended','expired','failed','revoked')),
 unique(person_id,id),
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete set null(conversation_id)
);
create index ai_live_sessions_owner_time on public.ai_live_sessions(person_id,created_at desc);
alter table public.ai_live_sessions enable row level security;
revoke all on public.ai_live_sessions from public,anon,authenticated;
grant select on public.ai_live_sessions to authenticated;
create policy ai_live_sessions_owner on public.ai_live_sessions for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_live_reserve(p_id uuid,p_conversation uuid,p_model text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare owner_id uuid; deadline timestamptz;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if not exists(select 1 from public.founder_access where person_id=owner_id)
 and not exists(select 1 from public.membership_accounts where person_id=owner_id and beta_access) then
  raise exception 'Pilot access required' using errcode='42501'; end if;
 if p_id is null or p_conversation is null or p_model is null then raise exception 'Invalid session' using errcode='22023'; end if;
 if exists(select 1 from public.ai_live_sessions where person_id=owner_id and ended_at is null and expires_at>now())
 or exists(select 1 from public.ai_turns where person_id=owner_id and status='pending' and created_at>now()-interval '2 minutes') then
  raise exception 'Conversation already active' using errcode='55P03'; end if;
 if (select count(*) from public.ai_live_sessions where person_id=owner_id and created_at>now()-interval '24 hours')>=10
 or (select count(*) from public.ai_live_sessions where person_id=owner_id and created_at>now()-interval '1 minute')>=3 then
  raise exception 'Voice usage limit reached' using errcode='P0001'; end if;
 insert into public.ai_conversations(id,person_id,title) values(p_conversation,owner_id,'Aethelios Live') on conflict(id) do nothing;
 if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id is null and archived_at is null) then
  raise exception 'Conversation unavailable' using errcode='42501'; end if;
 insert into public.ai_live_sessions(id,person_id,conversation_id,model) values(p_id,owner_id,p_conversation,p_model) returning expires_at into deadline;
 return deadline;
end $$;
create function public.ai_live_attach(p_id uuid,p_call text,p_tag text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if length(p_call) not between 1 and 200 or length(p_tag)<>64 then raise exception 'Invalid call' using errcode='22023'; end if;
 update public.ai_live_sessions set call_id=p_call,call_tag=p_tag
 where id=p_id and person_id in(select id from public.persons where auth_user_id=(select auth.uid()))
 and call_id is null and ended_at is null and expires_at>now();
 get diagnostics changed=row_count; return changed=1;
end $$;
create function public.ai_live_end(p_id uuid,p_reason text,p_input bigint default 0,p_output bigint default 0)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 update public.ai_live_sessions set ended_at=coalesce(ended_at,now()),reason=coalesce(reason,p_reason),input_tokens=greatest(input_tokens,p_input),output_tokens=greatest(output_tokens,p_output)
 where id=p_id and person_id in(select id from public.persons where auth_user_id=(select auth.uid()));
 get diagnostics changed=row_count; return changed=1;
end $$;
revoke all on function public.ai_live_reserve(uuid,uuid,text),public.ai_live_attach(uuid,text,text),public.ai_live_end(uuid,text,bigint,bigint) from public,anon;
grant execute on function public.ai_live_reserve(uuid,uuid,text),public.ai_live_attach(uuid,text,text),public.ai_live_end(uuid,text,bigint,bigint) to authenticated;

-- Reviewed, read-only background work. No raw model command performs a privileged action.
create table public.ai_live_jobs (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 session_id uuid not null,
 conversation_id uuid not null,
 call_id text not null check(length(call_id) between 1 and 200),
 task text not null check(length(task) between 1 and 2000),
 coworker text check(coworker in ('athena','prometheus','apollo','hermes','themis')),
 status text not null default 'approval' check(status in ('approval','approved','declined','complete','failed')),
 result text not null default '' check(length(result)<=32000),
 input_tokens integer not null default 0 check(input_tokens>=0),
 output_tokens integer not null default 0 check(output_tokens>=0),
 duration_ms integer check(duration_ms>=0),
 created_at timestamptz not null default now(),
 unique(session_id,call_id),
 foreign key(person_id,session_id) references public.ai_live_sessions(person_id,id) on delete cascade,
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete cascade
);
create index ai_live_jobs_owner_time on public.ai_live_jobs(person_id,created_at desc);
alter table public.ai_live_jobs enable row level security;
revoke all on public.ai_live_jobs from public,anon,authenticated;
grant select on public.ai_live_jobs to authenticated;
create policy ai_live_jobs_owner on public.ai_live_jobs for select to authenticated
 using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.ai_live_request_job(p_id uuid,p_session uuid,p_call text,p_task text,p_coworker text)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; thread uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select conversation_id into thread from public.ai_live_sessions where id=p_session and person_id=owner_id and ended_at is null and expires_at>now();
 if thread is null then raise exception 'Session unavailable' using errcode='42501'; end if;
 if (select count(*) from public.ai_live_jobs where session_id=p_session)>=2
 or (select count(*) from public.ai_live_jobs where person_id=owner_id and created_at>now()-interval '24 hours')>=20 then
  raise exception 'Background work limit reached' using errcode='P0001'; end if;
 insert into public.ai_live_jobs(id,person_id,session_id,conversation_id,call_id,task,coworker)
 values(p_id,owner_id,p_session,thread,p_call,p_task,p_coworker);
 return true;
end $$;
create function public.ai_live_review_job(p_id uuid,p_approve boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 update public.ai_live_jobs j set status=case when p_approve then 'approved' else 'declined' end
 where j.id=p_id and j.person_id in(select id from public.persons where auth_user_id=(select auth.uid())) and j.status='approval'
 and exists(select 1 from public.ai_live_sessions s where s.id=j.session_id and s.ended_at is null and s.expires_at>now());
 get diagnostics changed=row_count;return changed=1;
end $$;
create function public.ai_live_finish_job(p_id uuid,p_result text,p_input integer,p_output integer,p_duration integer,p_success boolean,p_model text)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.ai_live_jobs; changed integer;
begin
 select * into job from public.ai_live_jobs where id=p_id and person_id in(select id from public.persons where auth_user_id=(select auth.uid())) for update;
 if job.id is null or job.status<>'approved' then return false; end if;
 if p_success then
  if not exists(select 1 from public.ai_live_sessions where id=job.session_id and ended_at is null and expires_at>now()) then return false; end if;
  perform public.ai_begin_turn(job.conversation_id,job.id,'Approved voice background work: '||job.task,p_model,false,case when job.coworker is null then 'aethelios-live-background.1' else 'council.1.s.'||job.coworker end);
  perform public.ai_finish_turn(job.id,p_result,'complete',p_input,p_output);
 end if;
 update public.ai_live_jobs set result=case when p_success then p_result else '' end,status=case when p_success then 'complete' else 'failed' end,
 input_tokens=p_input,output_tokens=p_output,duration_ms=p_duration where id=job.id;
 get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.ai_live_request_job(uuid,uuid,text,text,text),public.ai_live_review_job(uuid,boolean),public.ai_live_finish_job(uuid,text,integer,integer,integer,boolean,text) from public,anon;
grant execute on function public.ai_live_request_job(uuid,uuid,text,text,text),public.ai_live_review_job(uuid,boolean),public.ai_live_finish_job(uuid,text,integer,integer,integer,boolean,text) to authenticated;
