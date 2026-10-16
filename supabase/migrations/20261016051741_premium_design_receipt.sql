-- Additive premium authority. No hosted application is authorized by this file.
-- Historical v1 byte derivation is retained verbatim under a private versioned name.
alter function public.ai_talk_derived_design_receipt(uuid,uuid,uuid,integer)
  rename to ai_talk_derived_design_receipt_v1;

-- Premium schemas have fixed ASCII object keys. Preserve array order and JSON string
-- escaping, sort object keys bytewise, and never hash jsonb's presentation whitespace.
create function public.ai_talk_premium_canonical(p_value jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare result text;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.ai_talk_premium_canonical(value), ',' order by key collate "C"), '') || '}'
        into result from jsonb_each(p_value);
    when 'array' then
      select '[' || coalesce(string_agg(public.ai_talk_premium_canonical(value), ',' order by ord), '') || ']'
        into result from jsonb_array_elements(p_value) with ordinality as item(value,ord);
    else result := p_value::text;
  end case;
  return result;
end $$;

create function public.ai_talk_premium_object(p_value jsonb, p_required text[], p_optional text[] default '{}') returns boolean
language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
  return p_value ?& p_required and not exists(
    select 1 from jsonb_object_keys(p_value) as item(key) where not key = any(p_required || p_optional)
  );
end $$;

-- Zod string bounds count UTF-16 units. Require the already-trimmed canonical
-- source saved by Talk; direct RPC input cannot smuggle a differently normalized snapshot.
create function public.ai_talk_premium_text(p_value jsonb, p_min integer, p_max integer) returns boolean
language plpgsql immutable set search_path='' as $$
declare value text; units integer;
begin
  if jsonb_typeof(p_value) is distinct from 'string' then return false; end if;
  value := p_value #>> '{}';
  if value <> btrim(value, E' \t\n\r\v\f' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') then return false; end if;
  if value = '' then return p_min=0; end if;
  select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0)::integer into units
    from regexp_split_to_table(value,'') as chars(ch);
  return units between p_min and p_max;
end $$;

create function public.ai_talk_premium_asset_valid(p_asset jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
  if not public.ai_talk_premium_object(p_asset,array['id','label','kind','provenance','referenced'],array['source','versionId']) then return false; end if;
  if not public.ai_talk_premium_text(p_asset->'id',1,32) or (p_asset->>'id') !~ '^[a-z][a-z0-9-]{0,31}$'
    or not public.ai_talk_premium_text(p_asset->'label',1,80)
    or not public.ai_talk_premium_text(p_asset->'provenance',1,80)
    or coalesce(p_asset->>'kind','') not in ('placeholder','referenced')
    or jsonb_typeof(p_asset->'referenced') is distinct from 'boolean' then return false; end if;
  if p_asset ? 'source' then
    if p_asset->>'kind' <> 'referenced' or p_asset->>'referenced' <> 'true' then return false; end if;
    if p_asset->>'source' = 'official-crest' then return not p_asset ? 'versionId'; end if;
    if p_asset->>'source' = 'studio-version' then
      return coalesce(jsonb_typeof(p_asset->'versionId') = 'string'
        and (p_asset->>'versionId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',false);
    end if;
    return false;
  end if;
  return not p_asset ? 'versionId';
end $$;

create function public.ai_talk_premium_direction_valid(p_direction jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare tokens jsonb; demo jsonb; copy jsonb; item jsonb;
begin
  if not public.ai_talk_premium_object(p_direction,array['id','name','tokens','demo','copy','assets']) then return false; end if;
  if not public.ai_talk_premium_text(p_direction->'id',1,32) or (p_direction->>'id') !~ '^[a-z][a-z0-9-]{0,31}$'
    or not public.ai_talk_premium_text(p_direction->'name',1,40)
    or jsonb_typeof(p_direction->'assets') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_direction->'assets') > 6 then return false; end if;
  tokens := p_direction->'tokens'; demo := p_direction->'demo'; copy := p_direction->'copy';
  if not public.ai_talk_premium_object(tokens,array['colors','typography','spacing','shape','material'])
    or not public.ai_talk_premium_object(tokens->'typography',array['display','body','scale'])
    or not public.ai_talk_premium_object(demo,array['kind','headline','supporting','cta','productLabel','image'])
    or not public.ai_talk_premium_object(copy,array['headline','subhead','proof','disclaimer']) then return false; end if;
  if coalesce(tokens->>'spacing','') not in ('compact','balanced','generous')
    or coalesce(tokens->>'shape','') not in ('sharp','soft','pill')
    or coalesce(tokens->>'material','') not in ('obsidian','carbon','emerald-glass','stone','charcoal-glass','brushed-metal')
    or coalesce(tokens#>>'{typography,scale}','') not in ('tight','measured','open')
    or not public.ai_talk_premium_text(tokens#>'{typography,display}',1,40)
    or not public.ai_talk_premium_text(tokens#>'{typography,body}',1,40)
    or jsonb_typeof(tokens->'colors') is distinct from 'array' then return false; end if;
  if jsonb_array_length(tokens->'colors') not between 4 and 8 then return false; end if;
  for item in select value from jsonb_array_elements(tokens->'colors') loop
    if not public.ai_talk_premium_object(item,array['role','name','hex'])
      or coalesce(item->>'role','') not in ('background','surface','text','accent','highlight','muted','border')
      or not public.ai_talk_premium_text(item->'name',1,40)
      or jsonb_typeof(item->'hex') is distinct from 'string'
      or coalesce(item->>'hex','') !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
  end loop;
  if coalesce(demo->>'kind','') not in ('hero-product','editorial','split-campaign','statement')
    or not public.ai_talk_premium_text(demo->'headline',1,80)
    or not public.ai_talk_premium_text(demo->'supporting',0,200)
    or not public.ai_talk_premium_text(demo->'cta',1,40)
    or not public.ai_talk_premium_text(demo->'productLabel',1,80)
    or not public.ai_talk_premium_asset_valid(demo->'image')
    or not public.ai_talk_premium_text(copy->'headline',1,80)
    or not public.ai_talk_premium_text(copy->'subhead',0,200)
    or not public.ai_talk_premium_text(copy->'proof',1,200)
    or not public.ai_talk_premium_text(copy->'disclaimer',1,160) then return false; end if;
  for item in select value from jsonb_array_elements(p_direction->'assets') loop
    if not public.ai_talk_premium_asset_valid(item) then return false; end if;
  end loop;
  return true;
end $$;

create function public.ai_talk_derived_design_receipt(p_owner uuid,p_conversation uuid,p_board uuid,p_version integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare board public.ai_talk_creations; item jsonb; direction jsonb; derived jsonb; content jsonb; ids text[] := '{}';
begin
  select * into board from public.ai_talk_creations where id=p_board and person_id=p_owner
    and conversation_id=p_conversation and version=p_version and kind='board' and not candidate;
  if not found then return null; end if;
  if board.content->>'rendererVersion' is distinct from 'premium/v2' then
    -- A removed renderer marker must not downgrade premium-only data into a v1 receipt.
    if board.content ? 'rendererVersion' or exists (
      select 1 from jsonb_array_elements(board.content->'directions') as d
      where coalesce(d#>>'{demo,kind}','') <> 'hero-product'
        or d#>>'{tokens,material}' in ('charcoal-glass','brushed-metal')
        or d#>'{demo,image}' ?| array['source','versionId']
        or exists(select 1 from jsonb_array_elements(coalesce(d->'assets','[]')) as a where a ?| array['source','versionId'])
    ) then return null; end if;
    return public.ai_talk_derived_design_receipt_v1(p_owner,p_conversation,p_board,p_version);
  end if;
  if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=p_owner
      and company_id is null and archived_at is null) then return null; end if;
  if not public.ai_talk_premium_object(board.content,array['schema','rendererVersion','title','product','notes','selectedDirectionId','directions'])
    or board.content->>'schema' is distinct from 'talk-design-board/v1'
    or not public.ai_talk_premium_text(board.content->'title',1,80)
    or not public.ai_talk_premium_text(board.content->'product',1,80)
    or not public.ai_talk_premium_text(board.content->'notes',0,400)
    or jsonb_typeof(board.content->'directions') is distinct from 'array' then return null; end if;
  if jsonb_array_length(board.content->'directions') not between 2 and 4 then return null; end if;
  for item in select value from jsonb_array_elements(board.content->'directions') loop
    if not public.ai_talk_premium_direction_valid(item) or item->>'id'=any(ids) then return null; end if;
    ids := ids || (item->>'id');
    if item->>'id' = board.content->>'selectedDirectionId' then direction := item; end if;
  end loop;
  if direction is null then return null; end if;
  for item in select value from jsonb_array_elements(direction->'assets')
    union all select direction#>'{demo,image}' loop
    if item->>'source' = 'studio-version' then
      if not exists(select 1 from public.ai_studio_versions v join public.ai_studio_projects p
        on p.id=v.project_id and p.person_id=v.person_id where v.id=(item->>'versionId')::uuid
        and v.person_id=p_owner and p.company_id is null and v.status='complete' and v.storage_key is not null)
        then return null; end if;
    end if;
  end loop;
  derived := public.ai_talk_derived_design_receipt_v1(p_owner,p_conversation,p_board,p_version);
  content := derived->'content' || jsonb_build_object(
    'demo',jsonb_build_object('kind','none','labelled',true,'note','Exact creative retained in designSnapshot. This receipt does not commission a build.'),
    'designSnapshot',jsonb_build_object('rendererVersion','premium/v2','product',board.content->'product','direction',direction)
  );
  return derived || jsonb_build_object('content',content,'digest',encode(extensions.digest(convert_to(
    public.ai_talk_premium_canonical(jsonb_build_object('content',content,'sourceRecords',derived->'sourceRecords')),'UTF8'),'sha256'),'hex'));
end $$;

create index if not exists architect_design_directions_owner_project
  on public.architect_design_directions(person_id,project_id);

-- An authenticated read, not a client capability flag. Recomputed on review,
-- receive, retained read and generation; absent RPC means premium remains gated.
create function public.ai_talk_review_premium_direction(p_conversation uuid,p_board uuid,p_version integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid; derived jsonb;
begin
  select id into owner_id from public.persons where auth_user_id=(select auth.uid());
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  derived := public.ai_talk_derived_design_receipt(owner_id,p_conversation,p_board,p_version);
  if derived is null or derived#>>'{content,designSnapshot,rendererVersion}' is distinct from 'premium/v2'
    then raise exception 'Premium design source unavailable' using errcode='42501'; end if;
  return jsonb_build_object('capability','talk-premium-receipt/v1','receipt',derived || jsonb_build_object('schema','talk-architect-direction/v1'));
end $$;

revoke all on function public.ai_talk_derived_design_receipt_v1(uuid,uuid,uuid,integer),
  public.ai_talk_derived_design_receipt(uuid,uuid,uuid,integer),
  public.ai_talk_premium_canonical(jsonb), public.ai_talk_premium_object(jsonb,text[],text[]),
  public.ai_talk_premium_text(jsonb,integer,integer), public.ai_talk_premium_asset_valid(jsonb),
  public.ai_talk_premium_direction_valid(jsonb) from public,anon,authenticated;
revoke all on function public.ai_talk_review_premium_direction(uuid,uuid,integer) from public,anon;
grant execute on function public.ai_talk_review_premium_direction(uuid,uuid,integer) to authenticated;

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
  if p_receipt#>'{content,designSnapshot}' is not null then
    if not stored_verified or p_receipt->>'schema' is distinct from 'talk-architect-direction/v1'
      or not public.ai_talk_premium_object(p_receipt,array['schema','identity','content','digest','sourceRecords'])
      then raise exception 'Premium design authority unavailable' using errcode='42501'; end if;
    -- Keep the server-derived receipt, never caller-only metadata or verification flags.
    p_receipt := derived || jsonb_build_object('schema','talk-architect-direction/v1');
  end if;
  if p_receipt#>'{content,designSnapshot}' is not null and exists(
    select 1 from public.architect_design_directions where person_id=owner_id and project_id=p_project and request_id<>p_request
  ) then
    raise exception 'Premium project already retained. Review the saved source before retrying.';
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

-- Preserve the historical recorder for genuine v1. Premium acknowledgments also
-- rederive exact content/identity at commit time, including revoked source checks.
alter function public.ai_talk_record_direction_transfer(uuid,uuid,uuid,integer,text,uuid,uuid,text,jsonb)
  rename to ai_talk_record_direction_transfer_v1;
create function public.ai_talk_record_direction_transfer(
  p_id uuid,p_conversation uuid,p_board uuid,p_version integer,p_direction text,
  p_direction_uuid uuid,p_project uuid,p_digest text,p_receipt jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; premium boolean; derived jsonb;
begin
  select id into owner_id from public.persons where auth_user_id=(select auth.uid());
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select content->>'rendererVersion'='premium/v2' into premium from public.ai_talk_creations
    where id=p_board and person_id=owner_id and conversation_id=p_conversation;
  derived := public.ai_talk_derived_design_receipt(owner_id,p_conversation,p_board,p_version);
  if derived is null then raise exception 'Design source unavailable' using errcode='42501'; end if;
  if premium or p_receipt#>'{content,designSnapshot}' is not null then
    if derived is null or derived->>'digest' is distinct from p_digest
      or derived#>>'{identity,directionId}' is distinct from p_direction_uuid::text
      or p_receipt is distinct from (derived || jsonb_build_object('schema','talk-architect-direction/v1'))
      then raise exception 'Premium design authority unavailable' using errcode='42501'; end if;
  end if;
  return public.ai_talk_record_direction_transfer_v1(p_id,p_conversation,p_board,p_version,p_direction,p_direction_uuid,p_project,p_digest,p_receipt);
end $$;
revoke all on function public.ai_talk_record_direction_transfer_v1(uuid,uuid,uuid,integer,text,uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.ai_talk_record_direction_transfer(uuid,uuid,uuid,integer,text,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.ai_talk_record_direction_transfer(uuid,uuid,uuid,integer,text,uuid,uuid,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
