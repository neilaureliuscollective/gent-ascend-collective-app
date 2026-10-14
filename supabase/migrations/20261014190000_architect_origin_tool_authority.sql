-- Additive authority for estimator save validation and invocation receipts.
-- Does not rewrite 20261014080000. Hosted application requires founder-approved migration.

create or replace function public.architect_origin_tool_valid(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; keys int; money_scale int; qty numeric; cost numeric; waste numeric; markup numeric;
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
 money_scale := case when p->>'currency'='JPY' then 0 else 2 end;
 if p->'waste_percent' is not null and jsonb_typeof(p->'waste_percent')<>'null' then
  if jsonb_typeof(p->'waste_percent')<>'string' or (p->>'waste_percent') !~ '^\d+(\.\d{1,2})?$' then return false; end if;
  waste := (p->>'waste_percent')::numeric;
  if waste > 100 then return false; end if;
 end if;
 if p->'markup_percent' is not null and jsonb_typeof(p->'markup_percent')<>'null' then
  if jsonb_typeof(p->'markup_percent')<>'string' or (p->>'markup_percent') !~ '^\d+(\.\d{1,2})?$' then return false; end if;
  markup := (p->>'markup_percent')::numeric;
  if markup > 1000 then return false; end if;
 end if;
 for item in select value from jsonb_array_elements(p->'items') loop
  if jsonb_typeof(item)<>'object'
   or not item ?& array['id','name','quantity','unit','unit_cost']
   or (select count(*) from jsonb_object_keys(item))<>5
   or jsonb_typeof(item->'id')<>'string' or (item->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or jsonb_typeof(item->'name')<>'string' or length(trim(item->>'name')) not between 1 and 80
   or jsonb_typeof(item->'unit')<>'string' or length(trim(item->>'unit')) not between 1 and 24
   or jsonb_typeof(item->'quantity')<>'string' or (item->>'quantity') !~ '^\d+(\.\d{1,4})?$'
   or jsonb_typeof(item->'unit_cost')<>'string'
  then return false; end if;
  if money_scale=0 then
   if (item->>'unit_cost') !~ '^\d+$' then return false; end if;
  elsif (item->>'unit_cost') !~ '^\d+(\.\d{1,2})?$' then return false; end if;
  qty := (item->>'quantity')::numeric;
  cost := (item->>'unit_cost')::numeric;
  if qty <= 0 or qty > 1000000000 or cost < 0 or cost > 1000000000 then return false; end if;
 end loop;
 select count(distinct value->>'id') into keys from jsonb_array_elements(p->'items');
 return keys=jsonb_array_length(p->'items');
exception when others then return false;
end $$;
revoke all on function public.architect_origin_tool_valid(jsonb) from public,anon;
grant execute on function public.architect_origin_tool_valid(jsonb) to authenticated;

create or replace function public.architect_origin_tool_decimal(p_value numeric, p_scale integer)
returns text
language sql immutable set search_path='' as $$
 select case
  when p_scale=0 then trunc(p_value)::text
  else to_char(round(p_value, p_scale), 'FM999999999999990.' || repeat('0', p_scale))
 end
$$;
revoke all on function public.architect_origin_tool_decimal(numeric,integer) from public,anon,authenticated;

create or replace function public.architect_origin_tool_calculate(p jsonb, p_quantities jsonb)
returns jsonb
language plpgsql immutable set search_path='' as $$
declare
 item jsonb; money_scale int; qty numeric; cost numeric; waste_pct numeric; markup_pct numeric;
 effective numeric; extension numeric; waste_amt numeric; line_total numeric;
 subtotal numeric := 0; waste_total numeric := 0; markup_amt numeric := 0; implied numeric;
 lines jsonb := '[]'::jsonb; qty_text text; assumptions jsonb; override jsonb;
begin
 if not public.architect_origin_tool_valid(p) then raise exception 'Invalid tool'; end if;
 if p_quantities is null then p_quantities := '{}'::jsonb; end if;
 if jsonb_typeof(p_quantities)<>'object' then raise exception 'Invalid invocation'; end if;
 money_scale := case when p->>'currency'='JPY' then 0 else 2 end;
 waste_pct := case when p->'waste_percent' is null or jsonb_typeof(p->'waste_percent')='null' then null else (p->>'waste_percent')::numeric end;
 markup_pct := case when p->'markup_percent' is null or jsonb_typeof(p->'markup_percent')='null' then null else (p->>'markup_percent')::numeric end;
 for item in select value from jsonb_array_elements(p->'items') loop
  override := p_quantities -> (item->>'id');
  if override is not null and jsonb_typeof(override)<>'null' then
   if jsonb_typeof(override)<>'string' or (override #>> '{}') !~ '^\d+(\.\d{1,4})?$' then raise exception 'Invalid invocation'; end if;
   qty_text := override #>> '{}';
  else
   qty_text := item->>'quantity';
  end if;
  qty := qty_text::numeric;
  if qty <= 0 then raise exception 'Invalid invocation'; end if;
  cost := (item->>'unit_cost')::numeric;
  effective := case when waste_pct is null then qty else qty + round(qty * waste_pct / 100, 4) end;
  extension := round(qty * cost, money_scale);
  line_total := round(effective * cost, money_scale);
  waste_amt := line_total - extension;
  subtotal := subtotal + extension;
  waste_total := waste_total + waste_amt;
  lines := lines || jsonb_build_array(jsonb_build_object(
   'id', item->>'id',
   'name', trim(item->>'name'),
   'quantity', public.architect_origin_tool_decimal(qty, 4),
   'effective_quantity', public.architect_origin_tool_decimal(effective, 4),
   'unit', trim(item->>'unit'),
   'unit_cost', public.architect_origin_tool_decimal(cost, money_scale),
   'extension', public.architect_origin_tool_decimal(extension, money_scale),
   'waste', public.architect_origin_tool_decimal(waste_amt, money_scale),
   'line_total', public.architect_origin_tool_decimal(line_total, money_scale)
  ));
 end loop;
 for qty_text in select jsonb_object_keys(p_quantities) loop
  if not exists (select 1 from jsonb_array_elements(p->'items') item where item.value->>'id'=qty_text) then
   raise exception 'Invalid invocation';
  end if;
 end loop;
 markup_amt := case when markup_pct is null then 0 else round((subtotal + waste_total) * markup_pct / 100, money_scale) end;
 implied := case when markup_pct is null then null else round(markup_pct * 100 / (100 + markup_pct), 2) end;
 assumptions := jsonb_build_array(
  (p->>'currency') || ' amounts use half-up rounding to ' || money_scale || ' minor unit' || case when money_scale=1 then '' else 's' end || '.',
  case when waste_pct is null then 'No waste factor is applied.'
   else 'Waste adds ' || (p->>'waste_percent') || '% to each item quantity before monetary rounding. Line totals use effective quantity × unit cost, then half-up to currency minor units. Waste is not a price increase.' end,
  case when markup_pct is null then 'No markup is applied. Markup is not margin.'
   else 'Markup adds ' || (p->>'markup_percent') || '% to the wasted-cost subtotal. Markup is not margin. Implied margin is ' || public.architect_origin_tool_decimal(implied, 2) || '% of the selling total.' end,
  'Units are labels only. No unit conversion or supplier catalogue is applied.',
  'Missing prices are not invented. Empty fields refuse the calculation.',
  case when length(trim(p->>'assumptions'))=0 then 'No additional owner assumptions were recorded.' else trim(p->>'assumptions') end
 );
 return jsonb_build_object(
  'currency', p->>'currency',
  'rounding', 'half-up-minor',
  'lines', lines,
  'subtotal', public.architect_origin_tool_decimal(subtotal, money_scale),
  'waste_total', public.architect_origin_tool_decimal(waste_total, money_scale),
  'markup_amount', public.architect_origin_tool_decimal(markup_amt, money_scale),
  'total', public.architect_origin_tool_decimal(subtotal + waste_total + markup_amt, money_scale),
  'implied_margin_percent', case when implied is null then null else public.architect_origin_tool_decimal(implied, 2) end,
  'assumptions', assumptions
 );
end $$;
revoke all on function public.architect_origin_tool_calculate(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.architect_origin_tool_invoke(
 p_id uuid,p_project uuid,p_tool uuid,p_revision integer,p_inputs jsonb,p_source text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 owner_id uuid; tool public.architect_origin_tools; version public.architect_origin_tool_versions;
 receipt public.architect_origin_tool_invocations; quantities jsonb; computed jsonb; normalized jsonb;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required'; end if;
 if p_id is null or p_project is null or p_tool is null or p_revision is null or p_revision<1
  or p_source not in ('architect','agent-fixture')
  or p_inputs is null or octet_length(p_inputs::text)>8000 or jsonb_typeof(p_inputs)<>'object'
 then raise exception 'Invalid invocation'; end if;
 if (select count(*) from jsonb_object_keys(p_inputs))>1
  or (p_inputs ? 'quantities' is false and (select count(*) from jsonb_object_keys(p_inputs))<>0)
 then raise exception 'Invalid invocation'; end if;
 quantities := coalesce(p_inputs->'quantities', '{}'::jsonb);
 if jsonb_typeof(quantities)<>'object' then raise exception 'Invalid invocation'; end if;
 normalized := jsonb_build_object('quantities', quantities);
 select * into tool from public.architect_origin_tools where id=p_tool and person_id=owner_id and project_id=p_project;
 if not found then raise exception 'Tool unavailable'; end if;
 select * into version from public.architect_origin_tool_versions
  where tool_id=p_tool and person_id=owner_id and project_id=p_project and revision=p_revision;
 if not found then raise exception 'Revision unavailable'; end if;
 computed := public.architect_origin_tool_calculate(version.configuration, quantities);
 select * into receipt from public.architect_origin_tool_invocations where id=p_id;
 if found then
  if receipt.person_id<>owner_id or receipt.tool_id<>p_tool or receipt.project_id<>p_project
   or receipt.tool_revision<>p_revision or receipt.inputs<>normalized or receipt.source<>p_source
   or receipt.result<>computed
  then raise exception 'Replay mismatch'; end if;
  return computed;
 end if;
 if (select count(*) from public.architect_origin_tool_invocations where person_id=owner_id and created_at>now()-interval '24 hours')>=40 then
  raise exception 'Invocation limit';
 end if;
 insert into public.architect_origin_tool_invocations(id,tool_id,person_id,project_id,tool_revision,inputs,result,source)
 values(p_id,p_tool,owner_id,tool.project_id,p_revision,normalized,computed,p_source);
 return computed;
end $$;

create or replace function public.architect_origin_tool_record_invocation(
 p_id uuid,p_tool uuid,p_revision integer,p_inputs jsonb,p_result jsonb,p_source text
) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Invocation recording is server-authoritative';
end $$;
revoke all on function public.architect_origin_tool_record_invocation(uuid,uuid,integer,jsonb,jsonb,text)
 from public,anon,authenticated;
revoke all on function public.architect_origin_tool_invoke(uuid,uuid,uuid,integer,jsonb,text) from public,anon;
grant execute on function public.architect_origin_tool_invoke(uuid,uuid,uuid,integer,jsonb,text) to authenticated;
revoke all on function public.architect_origin_tool_save(uuid,uuid,uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.architect_origin_tool_save(uuid,uuid,uuid,integer,text,jsonb,text) to authenticated;
