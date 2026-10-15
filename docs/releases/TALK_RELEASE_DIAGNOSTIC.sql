-- Read-only Talk release diagnostic for Gent Ascend App (volpzkfsnmtztrovexcw).
-- Inspects schema, function signatures/definitions, ACLs, policies and constraints.
-- Does not read conversations, turns, creations or any user content.
-- Does not write. Missing functions must not abort: resolve OIDs first.
-- Object existence is not migration equivalence. Replacing migrations can leave
-- an older function under the same name.

with
roles(name) as (
  values ('anon'), ('authenticated'), ('service_role')
),
role_ok as (
  select coalesce(
    (select bool_and(exists (select 1 from pg_roles r where r.rolname = roles.name)) from roles),
    false
  ) as ok
),
fn(sig) as (
  values
    ('public.ai_talk_save_creation(uuid,uuid,uuid,text,uuid,jsonb)'),
    ('public.ai_talk_select_creation(uuid,uuid)'),
    ('public.ai_talk_save_candidate(uuid,uuid,uuid,text,uuid,jsonb)'),
    ('public.ai_talk_import_origin(uuid,uuid,uuid)'),
    ('public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,text)'),
    ('public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,uuid,text,jsonb)'),
    ('public.ai_talk_scoped_identity(text)'),
    ('public.ai_live_observe_item(uuid,uuid,text,text)'),
    ('public.ai_live_bind_turn(uuid,uuid,text,text,uuid)'),
    ('public.ai_live_observe_trusted_item(uuid,uuid,text,text)'),
    ('public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)'),
    ('public.ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)'),
    ('public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean)'),
    ('public.ai_talk_derived_design_receipt(uuid,uuid,uuid,integer)'),
    ('public.architect_origin_save(uuid,uuid,integer,jsonb,text)'),
    ('public.architect_origin_valid(jsonb)')
),
fn_probe as (
  select
    f.sig,
    p.oid,
    p.pronargs,
    p.prosecdef,
    p.prosrc,
    coalesce('search_path=""'=any(p.proconfig) or 'search_path='=any(p.proconfig), false) as empty_search_path,
    case
      when p.oid is null or not (select ok from role_ok) then null
      else has_function_privilege('anon', p.oid, 'EXECUTE')
    end as anon_execute,
    case
      when p.oid is null or not (select ok from role_ok) then null
      else has_function_privilege('authenticated', p.oid, 'EXECUTE')
    end as authenticated_execute,
    case
      when p.oid is null or not (select ok from role_ok) then null
      else has_function_privilege('service_role', p.oid, 'EXECUTE')
    end as service_role_execute
  from fn f
  left join pg_proc p on p.oid = to_regprocedure(f.sig)
),
tbl(name) as (
  values
    ('public.ai_talk_creations'),
    ('public.ai_talk_selection'),
    ('public.ai_talk_origin_imports'),
    ('public.ai_talk_direction_transfers'),
    ('public.ai_live_observed_items'),
    ('public.ai_live_turn_bindings'),
    ('public.architect_origin_projects'),
    ('health_private.workspaces')
),
tbl_probe as (
  select
    t.name,
    c.oid,
    c.relrowsecurity as rls,
    case
      when c.oid is null or not (select ok from role_ok) then null
      else has_table_privilege('anon', c.oid, 'SELECT')
    end as anon_select,
    case
      when c.oid is null or not (select ok from role_ok) then null
      else has_table_privilege('authenticated', c.oid, 'SELECT')
    end as authenticated_select
  from tbl t
  left join pg_class c on c.oid = to_regclass(t.name)
),
col as (
  select table_schema, table_name, column_name
  from information_schema.columns
  where (table_schema, table_name, column_name) in (
    ('public', 'ai_talk_creations', 'candidate'),
    ('public', 'ai_talk_origin_imports', 'save_id'),
    ('public', 'ai_talk_origin_imports', 'mapping_version'),
    ('public', 'ai_live_observed_items', 'intended_turn_id')
  )
),
observe4 as (
  select * from fn_probe where sig = 'public.ai_live_observe_trusted_item(uuid,uuid,text,text)'
),
observe5 as (
  select * from fn_probe where sig = 'public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)'
),
bind as (
  select * from fn_probe where sig = 'public.ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)'
),
import as (
  select * from fn_probe where sig = 'public.ai_talk_import_origin(uuid,uuid,uuid)'
),
ack5 as (
  select * from fn_probe where sig = 'public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,text)'
),
ack7 as (
  select * from fn_probe where sig = 'public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,uuid,text,jsonb)'
),
retain as (
  select * from fn_probe where sig = 'public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean)'
),
derived as (
  select * from fn_probe where sig = 'public.ai_talk_derived_design_receipt(uuid,uuid,uuid,integer)'
)
select jsonb_build_object(
  'readsUserContent', false,
  'rolesPresent', (select ok from role_ok),
  'tables', (
    select coalesce(jsonb_object_agg(name, jsonb_build_object(
      'present', oid is not null,
      'rls', rls,
      'anonSelect', anon_select,
      'authenticatedSelect', authenticated_select
    )), '{}'::jsonb)
    from tbl_probe
  ),
  'columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', table_schema || '.' || table_name,
      'column', column_name
    ) order by table_name, column_name), '[]'::jsonb)
    from col
  ),
  'functions', (
    select coalesce(jsonb_object_agg(sig, jsonb_build_object(
      'present', oid is not null,
      'nargs', pronargs,
      'securityDefiner', prosecdef,
      'emptySearchPath', empty_search_path,
      'anonExecute', anon_execute,
      'authenticatedExecute', authenticated_execute,
      'serviceRoleExecute', service_role_execute,
      'hasIntendedTurnAuthority', coalesce(prosrc like '%intended_turn_id%', false),
      'hasDerivedReceipt', coalesce(prosrc like '%ai_talk_derived_design_receipt%', false)
    )), '{}'::jsonb)
    from fn_probe
  ),
  'contracts', jsonb_build_object(
    'intendedTurn', case
      when (select oid from observe5) is null
        and (select oid from observe4) is null
        and not exists (select 1 from tbl_probe where name = 'public.ai_live_observed_items' and oid is not null)
        then 'missing'
      when (select authenticated_execute from observe5) is true
        or ((select oid from observe4) is not null and (select oid from observe5) is not null)
        then 'conflict'
      when (select oid from observe5) is not null
        and (select oid from observe4) is null
        and exists (select 1 from col where table_name = 'ai_live_observed_items' and column_name = 'intended_turn_id')
        and coalesce((select prosrc from observe5), '') like '%intended_turn_id%'
        and coalesce((select prosrc from bind), '') like '%intended_turn_id%'
        and (select service_role_execute from observe5) is true
        and (select authenticated_execute from observe5) is false
        and (select authenticated_execute from bind) is true
        then 'equivalent-candidate'
      when (select oid from observe4) is not null and (select oid from observe5) is null
        then 'older'
      when exists (select 1 from tbl_probe where name = 'public.ai_live_observed_items' and oid is not null)
        then 'partial'
      else 'unverified'
    end,
    'originImport', case
      when (select oid from import) is null
        and (select oid from ack5) is null
        and (select oid from ack7) is null
        and not exists (select 1 from tbl_probe where name = 'public.ai_talk_origin_imports' and oid is not null)
        then 'missing'
      when (select anon_execute from import) is true
        then 'conflict'
      when (select oid from import) is not null
        and (select oid from ack5) is null
        and (select oid from ack7) is null
        and exists (select 1 from col where table_name = 'ai_talk_origin_imports' and column_name = 'save_id')
        and exists (select 1 from col where table_name = 'ai_talk_origin_imports' and column_name = 'mapping_version')
        and (select authenticated_execute from import) is true
        then 'equivalent-candidate'
      when (select oid from import) is null
        and ((select oid from ack5) is not null or (select oid from ack7) is not null)
        then 'older'
      when exists (select 1 from tbl_probe where name = 'public.ai_talk_origin_imports' and oid is not null)
        then 'partial'
      else 'unverified'
    end,
    'retainProvenance', case
      when (select oid from retain) is null and (select oid from derived) is null
        then 'missing'
      when (select oid from retain) is not null
        and (select oid from derived) is not null
        and coalesce((select prosrc from retain), '') like '%ai_talk_derived_design_receipt%'
        and (select authenticated_execute from retain) is true
        and (select authenticated_execute from derived) is false
        then 'equivalent-candidate'
      when (select oid from retain) is not null
        and (select oid from derived) is null
        then 'older'
      when (select oid from retain) is not null or (select oid from derived) is not null
        then 'partial'
      else 'unverified'
    end
  )
) as talk_release_diagnostic;
