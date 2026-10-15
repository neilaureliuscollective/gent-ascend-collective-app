-- Additive owner-scoped Architect tools. Hosted application requires founder-approved migration.
create function public.architect_origin_tool_valid(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; keys int;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32768
 or not p ?& array['kind','currency','rounding','waste_percent','markup_percent','assumptions','items']
 or (select count(*) from jsonb_object_keys(p))<>7
 or p->>'kind'<>'quantity-cost-estimator'
 or p->>'currency' not in ('USD','EUR','GBP','JPY')
 or p->>'rounding'<>'half-up-minor'
 or jsonb_typeof(p->'assumptions')<>'string' or length(p->>'assumptions')>1000
 or jsonb_typeof(p->'items')<>'array' or jsonb_array_length(p->'items')<1 or jsonb_array_length(p->'items')>24
 then return false; end if;
 if p->'waste_percent' is not null and jsonb_typeof(p->'waste_percent')<>'null' then
  if jsonb_typeof(p->'waste_percent')<>'string' or (p->>'waste_percent') !~ '^\d+(\.\d{1,2})?$' then return false; end if;
 end if;
 if p->'markup_percent' is not null and jsonb_typeof(p->'markup_percent')<>'null' then
  if jsonb_typeof(p->'markup_percent')<>'string' or (p->>'markup_percent') !~ '^\d+(\.\d{1,2})?$' then return false; end if;
 end if;
 for item in select value from jsonb_array_elements(p->'items') loop
  if jsonb_typeof(item)<>'object'
   or not item ?& array['id','name','quantity','unit','unit_cost']
   or (select count(*) from jsonb_object_keys(item))<>5
   or jsonb_typeof(item->'id')<>'string' or (item->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or jsonb_typeof(item->'name')<>'string' or length(trim(item->>'name')) not between 1 and 80
   or jsonb_typeof(item->'unit')<>'string' or length(trim(item->>'unit')) not between 1 and 24
   or jsonb_typeof(item->'quantity')<>'string' or (item->>'quantity') !~ '^\d+(\.\d{1,4})?$'
   or jsonb_typeof(item->'unit_cost')<>'string' or (item->>'unit_cost') !~ '^\d+(\.\d{1,4})?$'
  then return false; end if;
 end loop;
 select count(distinct value->>'id') into keys from jsonb_array_elements(p->'items');
 return keys=jsonb_array_length(p->'items');
exception when others then return false;
end $$;
revoke all on function public.architect_origin_tool_valid(jsonb) from public,anon;
grant execute on function public.architect_origin_tool_valid(jsonb) to authenticated;

create table public.architect_origin_tools (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 project_id uuid not null,
 kind text not null check(kind='quantity-cost-estimator'),
 name text not null check(length(trim(name)) between 1 and 100),
 revision integer not null check(revision between 1 and 100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,person_id),
 foreign key(project_id,person_id) references public.architect_origin_projects(id,person_id) on delete cascade
);
create index architect_origin_tools_project on public.architect_origin_tools(person_id,project_id,updated_at desc);

create table public.architect_origin_tool_versions (
 id uuid primary key,
 tool_id uuid not null,
 person_id uuid not null,
 project_id uuid not null,
 revision integer not null check(revision between 1 and 100),
 name text not null check(length(trim(name)) between 1 and 100),
 configuration jsonb not null check(public.architect_origin_tool_valid(configuration)),
 note text not null check(length(trim(note)) between 1 and 300),
 created_at timestamptz not null default now(),
 unique(tool_id,revision),
 foreign key(tool_id,person_id) references public.architect_origin_tools(id,person_id) on delete cascade,
 foreign key(project_id,person_id) references public.architect_origin_projects(id,person_id) on delete cascade
);

create table public.architect_origin_tool_invocations (
 id uuid primary key,
 tool_id uuid not null,
 person_id uuid not null,
 project_id uuid not null,
 tool_revision integer not null check(tool_revision between 1 and 100),
 inputs jsonb not null check(octet_length(inputs::text)<=8000),
 result jsonb not null check(octet_length(result::text)<=32000),
 source text not null check(source in ('architect','agent-fixture')),
 created_at timestamptz not null default now(),
 foreign key(tool_id,person_id) references public.architect_origin_tools(id,person_id) on delete cascade
);
create index architect_origin_tool_invocations_owner on public.architect_origin_tool_invocations(person_id,created_at desc);

alter table public.architect_origin_tools enable row level security;
alter table public.architect_origin_tool_versions enable row level security;
alter table public.architect_origin_tool_invocations enable row level security;
create policy architect_origin_tools_owner on public.architect_origin_tools for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_origin_tool_versions_owner on public.architect_origin_tool_versions for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
create policy architect_origin_tool_invocations_owner on public.architect_origin_tool_invocations for select to authenticated using(person_id=(select id from public.persons where auth_user_id=(select auth.uid())));
revoke all on public.architect_origin_tools,public.architect_origin_tool_versions,public.architect_origin_tool_invocations from public,anon,authenticated;
grant select on public.architect_origin_tools,public.architect_origin_tool_versions,public.architect_origin_tool_invocations to authenticated;

create function public.architect_origin_tool_save(
 p_tool uuid,p_project uuid,p_request uuid,p_expected integer,p_name text,p_config jsonb,p_note text
) returns integer
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; current_row public.architect_origin_tools; receipt public.architect_origin_tool_versions;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required'; end if;
 if p_tool is null or p_project is null or p_request is null or p_expected is null or p_expected<0 or p_expected>=100
  or p_name is null or length(trim(p_name)) not between 1 and 100
  or not public.architect_origin_tool_valid(p_config)
  or p_note is null or length(trim(p_note)) not between 1 and 300
 then raise exception 'Invalid tool'; end if;
 if not exists(select 1 from public.architect_origin_projects where id=p_project and person_id=owner_id) then
  raise exception 'Project unavailable';
 end if;
 select * into receipt from public.architect_origin_tool_versions where id=p_request;
 if found then
  if receipt.person_id<>owner_id or receipt.tool_id<>p_tool or receipt.project_id<>p_project
   or receipt.revision<>p_expected+1 or receipt.configuration<>p_config or receipt.note<>p_note or receipt.name<>p_name
  then raise exception 'Replay mismatch'; end if;
  return receipt.revision;
 end if;
 select * into current_row from public.architect_origin_tools where id=p_tool for update;
 if found then
  if current_row.person_id<>owner_id or current_row.project_id<>p_project then raise exception 'Tool unavailable'; end if;
  if current_row.revision<>p_expected then raise exception 'Tool changed'; end if;
  update public.architect_origin_tools set name=trim(p_name),revision=revision+1,updated_at=now() where id=p_tool;
 else
  if p_expected<>0 then raise exception 'Tool unavailable'; end if;
  if (select count(*) from public.architect_origin_tools where person_id=owner_id and project_id=p_project)>=20 then
   raise exception 'Tool limit';
  end if;
  insert into public.architect_origin_tools(id,person_id,project_id,kind,name,revision)
  values(p_tool,owner_id,p_project,'quantity-cost-estimator',trim(p_name),1);
 end if;
 insert into public.architect_origin_tool_versions(id,tool_id,person_id,project_id,revision,name,configuration,note)
 values(p_request,p_tool,owner_id,p_project,p_expected+1,trim(p_name),p_config,p_note);
 return p_expected+1;
end $$;

create function public.architect_origin_tool_record_invocation(
 p_id uuid,p_tool uuid,p_revision integer,p_inputs jsonb,p_result jsonb,p_source text
) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; tool public.architect_origin_tools; version public.architect_origin_tool_versions;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required'; end if;
 if p_id is null or p_tool is null or p_revision is null or p_revision<1 or p_source not in ('architect','agent-fixture')
  or p_inputs is null or octet_length(p_inputs::text)>8000
  or p_result is null or octet_length(p_result::text)>32000
 then raise exception 'Invalid invocation'; end if;
 select * into tool from public.architect_origin_tools where id=p_tool and person_id=owner_id;
 if not found then raise exception 'Tool unavailable'; end if;
 select * into version from public.architect_origin_tool_versions
  where tool_id=p_tool and person_id=owner_id and revision=p_revision;
 if not found then raise exception 'Revision unavailable'; end if;
 if exists(select 1 from public.architect_origin_tool_invocations where id=p_id) then
  if exists(select 1 from public.architect_origin_tool_invocations
   where id=p_id and person_id=owner_id and tool_id=p_tool and tool_revision=p_revision
    and inputs=p_inputs and result=p_result and source=p_source)
  then return true; end if;
  raise exception 'Replay mismatch';
 end if;
 if (select count(*) from public.architect_origin_tool_invocations where person_id=owner_id and created_at>now()-interval '24 hours')>=40 then
  raise exception 'Invocation limit';
 end if;
 insert into public.architect_origin_tool_invocations(id,tool_id,person_id,project_id,tool_revision,inputs,result,source)
 values(p_id,p_tool,owner_id,tool.project_id,p_revision,p_inputs,p_result,p_source);
 return true;
end $$;

revoke all on function public.architect_origin_tool_save(uuid,uuid,uuid,integer,text,jsonb,text),
 public.architect_origin_tool_record_invocation(uuid,uuid,integer,jsonb,jsonb,text) from public,anon;
grant execute on function public.architect_origin_tool_save(uuid,uuid,uuid,integer,text,jsonb,text),
 public.architect_origin_tool_record_invocation(uuid,uuid,integer,jsonb,jsonb,text) to authenticated;
