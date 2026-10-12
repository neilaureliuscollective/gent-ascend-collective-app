-- Additive Origin contracts. Hosted application requires founder-approved migration.
create function public.architect_origin_valid(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; d jsonb; s jsonb;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>100000
 or not p ?& array['name','description','discipline','status','blueprint','sources','documents']
 or (select count(*) from jsonb_object_keys(p))<>7
 or jsonb_typeof(p->'name')<>'string' or length(trim(p->>'name')) not between 1 and 100
 or jsonb_typeof(p->'description')<>'string' or length(p->>'description')>2000
 or jsonb_typeof(p->'discipline')<>'string' or p->>'discipline' not in ('business','application','product','custom')
 or jsonb_typeof(p->'status')<>'string' or p->>'status' not in ('active','paused','archived')
 or jsonb_typeof(p->'blueprint')<>'object'
 or jsonb_typeof(p->'sources')<>'array' or jsonb_array_length(p->'sources')>30
 or jsonb_typeof(p->'documents')<>'array' or jsonb_array_length(p->'documents')>20 then return false; end if;
 if (select count(*) from jsonb_object_keys(p->'blueprint'))<>13 then return false; end if;
 foreach k in array array['vision','opportunity','audience','requirements','research','solution','architecture','decisions','risks','milestones','deliverables','state','next'] loop
  if not (p->'blueprint') ? k or jsonb_typeof(p->'blueprint'->k)<>'string' or length(p->'blueprint'->>k)>3000 then return false; end if;
 end loop;
 for d in select value from jsonb_array_elements(p->'documents') loop
  if jsonb_typeof(d)<>'object' or not d ?& array['id','title','kind','content','status','basis'] or (select count(*) from jsonb_object_keys(d))<>6
  or jsonb_typeof(d->'title')<>'string' or length(trim(d->>'title')) not between 1 and 120
  or jsonb_typeof(d->'content')<>'string' or length(d->>'content') not between 1 and 24000
  or jsonb_typeof(d->'id')<>'string' or jsonb_typeof(d->'kind')<>'string' or d->>'kind' not in ('Business plan','Research dossier','Product requirements','Product development brief','Technical architecture','Project roadmap','Strategic plan')
  or jsonb_typeof(d->'status')<>'string' or d->>'status' not in ('draft','approved') or jsonb_typeof(d->'basis')<>'number' or (d->>'basis') !~ '^[0-9]+$'
  or (d->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p->'documents'))<>jsonb_array_length(p->'documents') then return false; end if;
 for s in select value from jsonb_array_elements(p->'sources') loop
  if jsonb_typeof(s)<>'object' or not s ?& array['url','title','provenance'] or (select count(*) from jsonb_object_keys(s))<>3
  or jsonb_typeof(s->'url')<>'string' or length(s->>'url')>2048 or s->>'url' !~ '^https?://[^/@[:space:]]+([/:?#]|$)'
  or (s->>'url') ~ '[[:space:]]' or substring(s->>'url' from '^https?://([^/]+)') ~ '@'
  or jsonb_typeof(s->'title')<>'string' or length(s->>'title')>160 or jsonb_typeof(s->'provenance')<>'string' or s->>'provenance' not in ('provider','user') then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.architect_origin_valid(jsonb) from public,anon;
grant execute on function public.architect_origin_valid(jsonb) to authenticated;
create table public.architect_origin_projects (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 revision integer not null check(revision between 1 and 500), content jsonb not null check(public.architect_origin_valid(content)),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,person_id)
);
create index architect_origin_owner_updated on public.architect_origin_projects(person_id,updated_at desc);
create table public.architect_origin_versions (
 id uuid primary key, project_id uuid not null, person_id uuid not null, revision integer not null,
 content jsonb not null check(public.architect_origin_valid(content)), note text not null check(length(note) between 1 and 300),
 created_at timestamptz not null default now(), unique(project_id,revision),
 foreign key(project_id,person_id) references public.architect_origin_projects(id,person_id) on delete cascade
);
create table public.architect_origin_runs (
 id uuid primary key, project_id uuid not null, person_id uuid not null, revision integer not null,
 kind text not null check(kind in ('conversation','blueprint','research','document')), instruction text not null check(length(instruction) between 1 and 3000),
 payload jsonb not null check(octet_length(payload::text)<=8000), status text not null default 'running' check(status in ('running','complete','failed')),
 output jsonb check(output is null or octet_length(output::text)<=50000), created_at timestamptz not null default now(),
 foreign key(project_id,person_id) references public.architect_origin_projects(id,person_id) on delete cascade
);
create index architect_origin_runs_owner_time on public.architect_origin_runs(person_id,created_at desc);
create index architect_origin_runs_project_time on public.architect_origin_runs(project_id,created_at desc);
alter table public.architect_origin_projects enable row level security;
alter table public.architect_origin_versions enable row level security;
alter table public.architect_origin_runs enable row level security;
create policy architect_origin_projects_owner on public.architect_origin_projects for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_origin_versions_owner on public.architect_origin_versions for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_origin_runs_owner on public.architect_origin_runs for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
revoke all on public.architect_origin_projects,public.architect_origin_versions,public.architect_origin_runs from public,anon,authenticated;
grant select on public.architect_origin_projects,public.architect_origin_versions,public.architect_origin_runs to authenticated;
create function public.architect_origin_save(p_project uuid,p_request uuid,p_expected integer,p_content jsonb,p_note text) returns integer
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; current_row public.architect_origin_projects; receipt public.architect_origin_versions;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required'; end if;
 if p_project is null or p_request is null or p_expected is null or p_expected<0 or p_expected>=500 or not public.architect_origin_valid(p_content) or p_note is null or length(trim(p_note)) not between 1 and 300 then raise exception 'Invalid project'; end if;
 select * into receipt from public.architect_origin_versions where id=p_request;
 if found then
  if receipt.person_id<>owner_id or receipt.project_id<>p_project or receipt.revision<>p_expected+1 or receipt.content<>p_content or receipt.note<>p_note then raise exception 'Replay mismatch'; end if;
  return receipt.revision;
 end if;
 select * into current_row from public.architect_origin_projects where id=p_project for update;
 if found then
  if current_row.person_id<>owner_id then raise exception 'Project unavailable'; end if;
  if current_row.revision<>p_expected then raise exception 'Project changed'; end if;
  update public.architect_origin_projects set content=p_content,revision=revision+1,updated_at=now() where id=p_project;
 else
  if p_expected<>0 then raise exception 'Project unavailable'; end if;
  if (select count(*) from public.architect_origin_projects where person_id=owner_id)>=50 then raise exception 'Project limit'; end if;
  if (select count(*) from public.ai_conversations where person_id=owner_id)>=100 then raise exception 'Conversation limit'; end if;
  -- A native owned Talk conversation, not a second chat identity or privileged context.
  insert into public.ai_conversations(id,person_id,title) values(p_project,owner_id,p_content->>'name');
  insert into public.architect_origin_projects(id,person_id,revision,content) values(p_project,owner_id,1,p_content);
 end if;
 insert into public.architect_origin_versions(id,project_id,person_id,revision,content,note) values(p_request,p_project,owner_id,p_expected+1,p_content,p_note);
 return p_expected+1;
end $$;
create function public.architect_origin_begin(p_project uuid,p_request uuid,p_expected integer,p_kind text,p_instruction text,p_payload jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; project public.architect_origin_projects;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required'; end if;
 select * into project from public.architect_origin_projects where id=p_project and person_id=owner_id for update;
 if not found then raise exception 'Project unavailable'; end if;
 if project.revision<>p_expected or project.content->>'status'='archived' then raise exception 'Project changed or archived'; end if;
 if p_request is null or p_expected is null or p_kind is null or p_kind not in ('conversation','blueprint','research','document') or p_instruction is null or length(trim(p_instruction)) not between 1 and 3000 or p_payload is null or octet_length(p_payload::text)>8000 then raise exception 'Invalid request'; end if;
 if exists(select 1 from public.architect_origin_runs where id=p_request) then raise exception 'Request already reserved; reload'; end if;
 if exists(select 1 from public.architect_origin_runs where person_id=owner_id and created_at>now()-interval '2 minutes') or (select count(*) from public.architect_origin_runs where person_id=owner_id and created_at>now()-interval '24 hours')>=3 then raise exception 'Origin request limit; try later'; end if;
 insert into public.architect_origin_runs(id,project_id,person_id,revision,kind,instruction,payload) values(p_request,p_project,owner_id,p_expected,p_kind,p_instruction,p_payload);
 return true;
end $$;
create function public.architect_origin_finish(p_request uuid,p_output jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_output is not null then
  if jsonb_typeof(p_output)<>'object' or octet_length(p_output::text)>50000
  or not p_output ?& array['reply','changes','document','sources','kind','model','researchAvailable']
  or jsonb_typeof(p_output->'reply')<>'string' or length(p_output->>'reply') not between 1 and 6000
  or jsonb_typeof(p_output->'changes')<>'array' or jsonb_array_length(p_output->'changes')>5
  or jsonb_typeof(p_output->'sources')<>'array' or jsonb_array_length(p_output->'sources')>12
  or jsonb_typeof(p_output->'researchAvailable')<>'boolean'
  or jsonb_typeof(p_output->'kind')<>'string' or length(p_output->>'kind')>120
  or jsonb_typeof(p_output->'model')<>'string' or length(p_output->>'model')>100 then raise exception 'Invalid output'; end if;
  if exists(select 1 from jsonb_array_elements(p_output->'changes') c where jsonb_typeof(c)<>'object' or not c ?& array['section','content','reason']
   or jsonb_typeof(c->'section')<>'string' or c->>'section' not in ('vision','opportunity','audience','requirements','research','solution','architecture','decisions','risks','milestones','deliverables','state','next')
   or jsonb_typeof(c->'content')<>'string' or length(c->>'content')>3000 or jsonb_typeof(c->'reason')<>'string' or length(c->>'reason')>500) then raise exception 'Invalid output'; end if;
  if (select count(distinct c->>'section') from jsonb_array_elements(p_output->'changes') c)<>jsonb_array_length(p_output->'changes') then raise exception 'Duplicate section'; end if;
  if jsonb_typeof(p_output->'document')<>'null' and (jsonb_typeof(p_output->'document')<>'object' or not (p_output->'document') ?& array['title','content']
   or jsonb_typeof(p_output->'document'->'title')<>'string' or length(p_output->'document'->>'title') not between 1 and 120
   or jsonb_typeof(p_output->'document'->'content')<>'string' or length(p_output->'document'->>'content') not between 1 and 24000) then raise exception 'Invalid document'; end if;
  if exists(select 1 from jsonb_array_elements(p_output->'sources') s where jsonb_typeof(s)<>'object' or not s ?& array['url','title','provenance']
   or jsonb_typeof(s->'url')<>'string' or length(s->>'url')>2048 or s->>'url' !~ '^https?://' or (s->>'url') ~ '[[:space:]]' or substring(s->>'url' from '^https?://([^/]+)') ~ '@'
   or jsonb_typeof(s->'title')<>'string' or length(s->>'title')>160 or jsonb_typeof(s->'provenance')<>'string' or s->>'provenance' <> 'provider') then raise exception 'Invalid sources'; end if;
 end if;
 update public.architect_origin_runs set output=p_output,status=case when p_output is null then 'failed' else 'complete' end
 where id=p_request and status='running' and person_id=(select id from public.persons where auth_user_id=auth.uid());
 return found;
end $$;
revoke all on function public.architect_origin_save(uuid,uuid,integer,jsonb,text),public.architect_origin_begin(uuid,uuid,integer,text,text,jsonb),public.architect_origin_finish(uuid,jsonb) from public,anon;
grant execute on function public.architect_origin_save(uuid,uuid,integer,jsonb,text),public.architect_origin_begin(uuid,uuid,integer,text,text,jsonb),public.architect_origin_finish(uuid,jsonb) to authenticated;
