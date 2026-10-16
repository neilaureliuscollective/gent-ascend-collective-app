-- Compact JSON text the way JSON.stringify does: no whitespace outside strings.
create or replace function public.ai_talk_json_compact(p_json text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  i integer;
  ch text;
  result text := '';
  in_string boolean := false;
  escaped boolean := false;
begin
  if p_json is null then return null; end if;
  for i in 1..length(p_json) loop
    ch := substr(p_json, i, 1);
    if in_string then
      result := result || ch;
      if escaped then
        escaped := false;
      elsif ch = '\' then
        escaped := true;
      elsif ch = '"' then
        in_string := false;
      end if;
    elsif ch = '"' then
      in_string := true;
      result := result || ch;
    elsif ch in (' ', E'\n', E'\t', E'\r') then
      continue;
    else
      result := result || ch;
    end if;
  end loop;
  return result;
end $$;
revoke all on function public.ai_talk_json_compact(text) from public, anon, authenticated;

-- Additive: verified Talk provenance is derived from the immutable board.
-- Existence of an owned board/version is not enough. Direction identity,
-- mapped content and canonical digest must match the selected direction.
-- Caller p_verified / p_source_kind still cannot manufacture verification.
-- Hosted apply still requires founder authorization. Signature unchanged.
create or replace function public.ai_talk_derived_design_receipt(
  p_owner uuid,
  p_conversation uuid,
  p_board uuid,
  p_version integer
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  board public.ai_talk_creations;
  selected_slug text;
  direction jsonb;
  direction_uuid uuid;
  identity_json json;
  colors_json json;
  approved_json json;
  assets_json json;
  layout_token text;
  emerald_hex text;
  used_emerald boolean := false;
  content_json json;
  sources_json json;
  digest_hex text;
begin
  if to_regclass('public.ai_talk_creations') is null then
    return null;
  end if;
  select * into board
    from public.ai_talk_creations
   where id = p_board
     and person_id = p_owner
     and conversation_id = p_conversation
     and version = p_version
     and kind = 'board'
     and not candidate;
  if not found then
    return null;
  end if;
  selected_slug := board.content->>'selectedDirectionId';
  if selected_slug is null or selected_slug = '' then
    return null;
  end if;
  select item
    into direction
    from jsonb_array_elements(board.content->'directions') as item
   where item->>'id' = selected_slug
   limit 1;
  if direction is null then
    return null;
  end if;
  direction_uuid := public.ai_talk_scoped_identity('talk-direction:' || p_board::text || ':' || selected_slug);
  identity_json := json_build_object(
    'conversationId', p_conversation::text,
    'boardId', p_board::text,
    'boardVersion', p_version,
    'directionId', direction_uuid::text
  );
  select coalesce(
    json_agg(json_build_object('role', mapped.role, 'value', mapped.value) order by mapped.swatch_ord),
    '[]'::json
  )
    into colors_json
    from (
      select mapped.role, mapped.value, mapped.swatch_ord
        from (
          select
            case (swatch::jsonb)->>'role'
              when 'background' then 'canvas'
              when 'text' then 'ink'
              when 'muted' then 'muted'
              when 'accent' then 'accent'
              when 'highlight' then 'reserve'
            end as role,
            upper((swatch::jsonb)->>'hex') as value,
            swatch_ord,
            row_number() over (
              partition by
                case (swatch::jsonb)->>'role'
                  when 'background' then 'canvas'
                  when 'text' then 'ink'
                  when 'muted' then 'muted'
                  when 'accent' then 'accent'
                  when 'highlight' then 'reserve'
                end
              order by swatch_ord
            ) as rn
          from jsonb_array_elements(coalesce(direction->'tokens'->'colors', '[]'::jsonb)) with ordinality as swatch_row(swatch, swatch_ord)
        ) mapped
       where mapped.role is not null
         and mapped.rn = 1
    ) mapped;
  select exists(
    select 1
      from jsonb_array_elements(coalesce(colors_json, '[]'::json)::jsonb) as color
     where color->>'role' = 'emerald'
  ) into used_emerald;
  select upper(color->>'hex')
    into emerald_hex
    from jsonb_array_elements(coalesce(direction->'tokens'->'colors', '[]'::jsonb)) as color
   where upper(color->>'hex') = '#0B3B32' or color->>'name' ~* 'green'
   limit 1;
  if emerald_hex is not null and not used_emerald then
    select coalesce(json_agg(elem order by n), '[]'::json)
      into colors_json
      from (
        select elem, ordinality as n
          from json_array_elements(coalesce(colors_json, '[]'::json)) with ordinality as extra(elem, ordinality)
        union all
        select json_build_object('role', 'emerald', 'value', emerald_hex), 2147483647
      ) extra;
  end if;
  layout_token := case coalesce(direction->'tokens'->>'spacing', '')
    when 'compact' then 'stack'
    when 'generous' then 'gallery'
    else 'split'
  end;
  select coalesce(json_agg(trimmed), '[]'::json)
    into approved_json
    from (
      select btrim(val) as trimmed
        from unnest(array[
          coalesce(direction->'copy'->>'subhead', ''),
          coalesce(direction->'copy'->>'proof', '')
        ]) as val
       where length(btrim(val)) > 0
       limit 16
    ) copy_rows;
  select coalesce(
    json_agg(
      json_build_object(
        'id', public.ai_talk_scoped_identity('talk-asset:' || p_board::text || ':' || ((asset::jsonb)->>'id'))::text,
        'kind', 'image',
        'provenance', 'talk',
        'note', left(
          coalesce((asset::jsonb)->>'label', '') || ' · ' || coalesce((asset::jsonb)->>'kind', '') || ' · ' || coalesce((asset::jsonb)->>'provenance', ''),
          400
        )
      ) order by asset_ord
    ),
    '[]'::json
  )
    into assets_json
    from jsonb_array_elements(coalesce(direction->'assets', '[]'::jsonb)) with ordinality as asset_row(asset, asset_ord);
  content_json := json_build_object(
    'schema', 'talk-architect-direction/v1',
    'identity', identity_json,
    'name', left(coalesce(direction->>'name', ''), 100),
    'summary', left(coalesce(board.content->>'product', '') || ': ' || coalesce(direction->'demo'->>'headline', ''), 2000),
    'colors', colors_json,
    'typography', json_build_array('display', 'body'),
    'layout', json_build_array(layout_token, 'board'),
    'demo', json_build_object(
      'kind', 'none',
      'labelled', true,
      'note', 'Talk hero-product demonstration stays in Talk. Architect v1 accepts tracker or none only.'
    ),
    'copy', json_build_object(
      'title', left(coalesce(direction->'copy'->>'headline', ''), 120),
      'approved', approved_json
    ),
    'assets', assets_json
  );
  sources_json := json_build_array(
    json_build_object('kind', 'conversation', 'id', p_conversation::text),
    json_build_object('kind', 'board', 'id', p_board::text, 'revision', p_version),
    json_build_object('kind', 'direction', 'id', direction_uuid::text, 'revision', p_version)
  );
  digest_hex := encode(
    digest(
      convert_to(
        public.ai_talk_json_compact(
          json_build_object('content', content_json, 'sourceRecords', sources_json)::text
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  return jsonb_build_object(
    'identity', identity_json,
    'content', content_json,
    'digest', digest_hex,
    'sourceRecords', sources_json
  );
end $$;

revoke all on function public.ai_talk_derived_design_receipt(uuid, uuid, uuid, integer) from public, anon, authenticated;

create or replace function public.architect_apps_retain_design(
  p_request uuid,
  p_project uuid,
  p_digest text,
  p_receipt jsonb,
  p_source_kind text,
  p_verified boolean
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_design_directions;
  talk_board_id uuid;
  talk_conversation uuid;
  talk_version integer;
  derived jsonb;
  stored_kind text;
  stored_verified boolean;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid design receipt'; end if;
  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then raise exception 'Invalid design receipt'; end if;
  if not exists(select 1 from public.architect_origin_projects where id = p_project and person_id = owner_id) then
    raise exception 'Project unavailable';
  end if;
  stored_kind := case when p_source_kind = 'text-import' then 'text-import' else 'pending' end;
  stored_verified := false;
  if to_regclass('public.ai_talk_creations') is not null
    and (p_receipt #>> '{identity,conversationId}') ~ '^[0-9a-f-]{36}$'
    and (p_receipt #>> '{identity,boardId}') ~ '^[0-9a-f-]{36}$'
    and (p_receipt #>> '{identity,boardVersion}') ~ '^[0-9]+$' then
    talk_conversation := (p_receipt #>> '{identity,conversationId}')::uuid;
    talk_board_id := (p_receipt #>> '{identity,boardId}')::uuid;
    talk_version := (p_receipt #>> '{identity,boardVersion}')::integer;
    derived := public.ai_talk_derived_design_receipt(
      owner_id, talk_conversation, talk_board_id, talk_version
    );
    if derived is not null
      and p_digest = derived->>'digest'
      and coalesce(p_receipt->>'digest', '') = derived->>'digest'
      and p_receipt->'identity' = derived->'identity'
      and p_receipt->'content' = derived->'content'
      and p_receipt->'sourceRecords' = derived->'sourceRecords' then
      stored_kind := 'talk-authorized';
      stored_verified := true;
    end if;
  end if;
  select * into existing from public.architect_design_directions where request_id = p_request;
  if found then
    if existing.person_id <> owner_id or existing.project_id <> p_project or existing.digest <> p_digest then
      raise exception 'Request already reserved with a different project or design receipt';
    end if;
    if existing.verified is distinct from stored_verified or existing.source_kind is distinct from stored_kind then
      raise exception 'Request already reserved with a different project or design receipt';
    end if;
    return existing.request_id;
  end if;
  insert into public.architect_design_directions(
    request_id, person_id, project_id, revision, digest, receipt, started, source_kind, verified
  ) values (
    p_request, owner_id, p_project, 1, p_digest, p_receipt, false, stored_kind, stored_verified
  );
  return p_request;
end $$;

revoke all on function public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean) from public, anon;
grant execute on function public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean) to authenticated;
