-- Additive owner-only jobs and immutable deliverables. No client sharing.
alter table public.ai_conversations add constraint company_conversation_identity unique(person_id,company_id,id);
create table public.company_jobs (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 company_id uuid not null, conversation_id uuid not null unique,
 company_name text not null, company_brief text not null, brief_version integer not null,
 scope jsonb not null check(jsonb_typeof(scope)='object' and octet_length(scope::text)<=40000),
 revision integer not null default 0 check(revision>=0), created_at timestamptz not null default now(),
 unique(person_id,company_id,id),
 foreign key(person_id,company_id) references public.companies(person_id,id),
 foreign key(person_id,company_id,conversation_id) references public.ai_conversations(person_id,company_id,id)
);
create table public.company_work_versions (
 id uuid primary key, person_id uuid not null, company_id uuid not null, job_id uuid not null,
 revision integer not null check(revision>0), content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=60000),
 source text not null check(source in ('manual','model')), source_turn uuid,
 reviewed_at timestamptz, created_at timestamptz not null default now(),
 unique(job_id,revision),
 foreign key(person_id,company_id,job_id) references public.company_jobs(person_id,company_id,id),
 foreign key(person_id,source_turn) references public.ai_turns(person_id,id),
 check((source='model')=(source_turn is not null))
);
create index company_jobs_recent on public.company_jobs(person_id,company_id,created_at desc);
create index company_work_job_versions on public.company_work_versions(person_id,company_id,job_id,revision desc);
alter table public.company_jobs enable row level security;
alter table public.company_work_versions enable row level security;
revoke all on public.company_jobs,public.company_work_versions from public,anon,authenticated;
grant select on public.company_jobs,public.company_work_versions to authenticated;
create policy jobs_owner on public.company_jobs for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy work_versions_owner on public.company_work_versions for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

-- Definers are narrowly scoped atomic writes; no arbitrary person or status parameters.
create function public.company_create_job(p_id uuid,p_company uuid,p_conversation uuid,p_scope jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; c public.companies%rowtype; old_job public.company_jobs%rowtype;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 select * into c from public.companies where id=p_company and person_id=owner_id for share;
 if owner_id is null or c.id is null then raise exception 'Company not found' using errcode='42501'; end if;
 select * into old_job from public.company_jobs where id=p_id;
 if found then
  if old_job.person_id=owner_id and old_job.company_id=p_company and old_job.conversation_id=p_conversation and old_job.scope=p_scope then return p_id; end if;
  raise exception 'Job request changed' using errcode='22023';
 end if;
 if jsonb_typeof(p_scope) is distinct from 'object' or length(coalesce(p_scope->>'request','')) not between 1 and 3000 then raise exception 'Invalid scope' using errcode='22023'; end if;
 -- A job gets its own immutable company thread; global/existing conversations are not adopted.
 insert into public.ai_conversations(id,person_id,company_id,title) values(p_conversation,owner_id,p_company,left(p_scope->>'request',80));
 insert into public.company_jobs(id,person_id,company_id,conversation_id,company_name,company_brief,brief_version,scope)
 values(p_id,owner_id,p_company,p_conversation,c.name,c.brief,c.version,p_scope);
 return p_id;
end $$;
create function public.company_save_work(p_id uuid,p_company uuid,p_job uuid,p_expected integer,p_content jsonb,p_source_turn uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; j public.company_jobs%rowtype; existing public.company_work_versions%rowtype;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 select * into j from public.company_jobs where id=p_job and company_id=p_company and person_id=owner_id for update;
 if j.id is null then raise exception 'Job not found' using errcode='42501'; end if;
 select * into existing from public.company_work_versions where id=p_id;
 if found then
  if existing.person_id=owner_id and existing.company_id=p_company and existing.job_id=p_job and existing.revision=p_expected+1 and existing.content=p_content and existing.source_turn is not distinct from p_source_turn then return p_id; end if;
  raise exception 'Version request changed' using errcode='22023';
 end if;
 if j.revision<>p_expected then raise exception 'Work changed; reload' using errcode='40001'; end if;
 if p_source_turn is not null and not exists(select 1 from public.ai_turns t join public.company_turn_context c on c.request_id=t.id where t.id=p_source_turn and t.person_id=owner_id and t.conversation_id=j.conversation_id and t.status='complete' and t.user_text like '[Job work v' || p_expected::text || '] %' and c.company_id=p_company) then raise exception 'Completed job turn required' using errcode='42501'; end if;
 insert into public.company_work_versions(id,person_id,company_id,job_id,revision,content,source,source_turn)
 values(p_id,owner_id,p_company,p_job,p_expected+1,p_content,case when p_source_turn is null then 'manual' else 'model' end,p_source_turn);
 update public.company_jobs set revision=revision+1 where id=j.id;
 return p_id;
end $$;
create function public.company_review_work(p_company uuid,p_job uuid,p_version uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 update public.company_work_versions set reviewed_at=coalesce(reviewed_at,now()) where id=p_version and job_id=p_job and company_id=p_company and person_id=owner_id;
 if not found then raise exception 'Version not found' using errcode='42501'; end if;
 return p_version;
end $$;
revoke all on function public.company_create_job(uuid,uuid,uuid,jsonb),public.company_save_work(uuid,uuid,uuid,integer,jsonb,uuid),public.company_review_work(uuid,uuid,uuid) from public,anon;
grant execute on function public.company_create_job(uuid,uuid,uuid,jsonb),public.company_save_work(uuid,uuid,uuid,integer,jsonb,uuid),public.company_review_work(uuid,uuid,uuid) to authenticated;

-- Company-linked Studio is additive; old projects stay unassigned and cannot be adopted.
alter table public.ai_studio_projects add column company_id uuid, add column job_id uuid;
alter table public.ai_studio_projects add constraint studio_company_job foreign key(person_id,company_id,job_id) references public.company_jobs(person_id,company_id,id);
alter table public.ai_studio_projects add constraint studio_company_binding check((company_id is null)=(job_id is null));
create trigger studio_company_immutable before update on public.ai_studio_projects for each row execute function public.company_binding_immutable();
create function public.studio_job_binding_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if new.job_id is distinct from old.job_id then raise exception 'Studio job binding is immutable'; end if;
 return new;
end $$;
create trigger studio_job_immutable before update on public.ai_studio_projects for each row execute function public.studio_job_binding_immutable();
revoke all on function public.studio_job_binding_immutable() from public,anon,authenticated;
create unique index studio_one_project_per_job on public.ai_studio_projects(job_id) where job_id is not null;

create function public.company_begin_revision(p_company uuid,p_conversation uuid,p_source uuid,p_request uuid,p_text text,p_kind text,p_model text,p_prompt_version text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; t public.ai_turns%rowtype; latest_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null or not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id=p_company) then raise exception 'Conversation scope mismatch' using errcode='42501'; end if;
 select * into t from public.ai_turns where id=p_source and person_id=owner_id and conversation_id=p_conversation;
 select id into latest_id from public.ai_turns where conversation_id=p_conversation order by created_at desc,id desc limit 1;
 if t.id is null or latest_id is distinct from p_source or t.status='pending' then raise exception 'Only the latest saved reply can be revised' using errcode='P0001'; end if;
 if p_kind is null or p_kind not in ('retry','regenerate','edit') or (p_kind='retry' and t.status='complete') or (p_kind='regenerate' and t.status<>'complete') then raise exception 'Invalid revision' using errcode='22023'; end if;
 perform public.company_begin_turn(p_company,p_conversation,p_request,p_text,p_model,p_prompt_version);
 update public.ai_turns set parent_turn_id=p_source,revision_kind=p_kind where id=p_request and person_id=owner_id;
 return p_request;
end $$;
revoke all on function public.company_begin_revision(uuid,uuid,uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.company_begin_revision(uuid,uuid,uuid,uuid,text,text,text,text) to authenticated;
