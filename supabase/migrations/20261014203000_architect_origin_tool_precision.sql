-- Additive correction: JSON-null validation, override bounds, full-precision money, wide decimal format.
-- Does not rewrite earlier tool migrations. Hosted application requires founder-approved migration.

create or replace function public.architect_origin_tool_valid(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; keys int; money_scale int; qty numeric; cost numeric; waste numeric; markup numeric;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32768
 or not p ?& array['kind','currency','rounding','waste_percent','markup_percent','assumptions','items']
 or (select count(*) from jsonb_object_keys(p))<>7
 or jsonb_typeof(p->'kind')<>'string' or p->>'kind'<>'quantity-cost-estimator'
 or jsonb_typeof(p->'currency')<>'string' or p->>'currency' not in ('USD','EUR','GBP','JPY')
 or jsonb_typeof(p->'rounding')<>'string' or p->>'rounding'<>'half-up-minor'
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
language plpgsql immutable set search_path='' as $$
declare scaled numeric; whole numeric; frac numeric; sign text;
begin
 if p_scale < 0 then raise exception 'Invalid scale'; end if;
 scaled := round(p_value, p_scale);
 sign := case when scaled < 0 then '-' else '' end;
 scaled := abs(scaled);
 whole := trunc(scaled);
 if p_scale = 0 then return sign || whole::text; end if;
 frac := round((scaled - whole) * (10 ^ p_scale));
 return sign || whole::text || '.' || lpad(frac::bigint::text, p_scale, '0');
end $$;
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
 if p_quantities is null or jsonb_typeof(p_quantities)<>'object' then raise exception 'Invalid invocation'; end if;
 money_scale := case when p->>'currency'='JPY' then 0 else 2 end;
 waste_pct := case when p->'waste_percent' is null or jsonb_typeof(p->'waste_percent')='null' then null else (p->>'waste_percent')::numeric end;
 markup_pct := case when p->'markup_percent' is null or jsonb_typeof(p->'markup_percent')='null' then null else (p->>'markup_percent')::numeric end;
 for item in select value from jsonb_array_elements(p->'items') loop
  override := p_quantities -> (item->>'id');
  if override is not null then
   if jsonb_typeof(override)<>'string' or (override #>> '{}') !~ '^\d+(\.\d{1,4})?$' then raise exception 'Invalid invocation'; end if;
   qty_text := override #>> '{}';
  else
   qty_text := item->>'quantity';
  end if;
  qty := qty_text::numeric;
  if qty <= 0 or qty > 1000000000 then raise exception 'Invalid invocation'; end if;
  cost := (item->>'unit_cost')::numeric;
  effective := case when waste_pct is null then qty else qty * (1 + waste_pct / 100) end;
  extension := round(qty * cost, money_scale);
  line_total := round(qty * (1 + coalesce(waste_pct, 0) / 100) * cost, money_scale);
  waste_amt := line_total - extension;
  subtotal := subtotal + extension;
  waste_total := waste_total + waste_amt;
  lines := lines || jsonb_build_array(jsonb_build_object(
   'id', item->>'id',
   'name', trim(item->>'name'),
   'quantity', public.architect_origin_tool_decimal(qty, 4),
   'effective_quantity', public.architect_origin_tool_decimal(round(effective, 4), 4),
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
   else 'Waste adds ' || (p->>'waste_percent') || '% to each item quantity. Money uses full precision of quantity × (1 + waste) × unit cost, then half-up to currency minor units. Displayed quantity is rounded separately. Waste is not a price increase.' end,
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
