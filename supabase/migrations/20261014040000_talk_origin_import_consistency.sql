-- Additive Talk → Origin review-to-save consistency. Hosted apply requires founder authorization.
-- Does not rewrite 20261014030000 or earlier applied Origin/Talk files.
-- Replaces the mapper and import function so UTF-16 bounds, one-per-kind selection
-- and derived provenance flags match TypeScript review. mapping_version stays talk-origin-import/v1.
drop function if exists public.ai_talk_origin_mapped_project(jsonb,jsonb,jsonb,jsonb,jsonb);
drop function if exists public.ai_talk_import_origin(uuid,uuid,uuid);
drop function if exists public.talk_utf16_length(text);
drop function if exists public.talk_bound_text(text,integer);

create function public.talk_utf16_length(p_value text)
returns integer
language sql immutable parallel safe set search_path='' as $$
  select coalesce((
    select sum(case when ascii(substr(p_value, i, 1)) > 65535 then 2 else 1 end)::int
    from generate_series(1, coalesce(length(p_value), 0)) as i
  ), 0);
$$;
revoke all on function public.talk_utf16_length(text) from public,anon,authenticated;

create function public.talk_bound_text(p_value text, p_max integer)
returns text
language plpgsql immutable parallel safe set search_path='' as $$
declare
  result text := '';
  units integer := 0;
  add integer;
  i integer;
  ch text;
begin
  if p_value is null or p_max is null or p_max <= 0 then return ''; end if;
  if public.talk_utf16_length(p_value) <= p_max then return p_value; end if;
  for i in 1..length(p_value) loop
    ch := substr(p_value, i, 1);
    add := case when ascii(ch) > 65535 then 2 else 1 end;
    exit when units + add > p_max;
    result := result || ch;
    units := units + add;
  end loop;
  return result;
end $$;
revoke all on function public.talk_bound_text(text,integer) from public,anon,authenticated;

create function public.ai_talk_origin_mapped_project(
 p_handoff jsonb,p_brief jsonb,p_plan jsonb,p_palette jsonb,p_images jsonb
) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
 idea text; discipline text; description_source text; description_from text;
 requirements_source text; risks_source text; audience_source text;
 plan_solution text; plan_milestones text; palette_deliverables text;
 next_source text; name_source text; name_value text;
 copied text := ''; referenced text := '';
 copied_fields jsonb := '[]'::jsonb; content jsonb; provenance jsonb;
begin
 if p_handoff is null or jsonb_typeof(p_handoff)<>'object' then
  raise exception 'Package unavailable' using errcode='42501';
 end if;
 idea := coalesce(p_handoff->>'idea','');
 discipline := coalesce(p_handoff->>'discipline','custom');
 if p_brief is not null then
  name_source := coalesce(p_brief->>'title','');
  name_value := public.talk_bound_text(name_source, 100);
  description_source := case
   when coalesce(p_handoff->>'description','') <> '' then p_handoff->>'description'
   else coalesce(p_brief->>'purpose','')
  end;
  description_from := case
   when coalesce(p_handoff->>'description','') <> '' then 'handoff.description'
   else 'brief.purpose'
  end;
  audience_source := coalesce(p_brief->>'audience','');
  requirements_source := concat_ws(E'\n',
   nullif(p_brief->>'purpose',''),
   nullif(p_brief->>'visualDirection',''),
   (select string_agg(value, E'\n' order by ordinality)
    from jsonb_array_elements_text(coalesce(p_brief->'requirements','[]'::jsonb)) with ordinality as req(value, ordinality))
  );
  risks_source := coalesce(
   (select string_agg(value, E'\n' order by ordinality)
    from jsonb_array_elements_text(coalesce(p_brief->'unresolved','[]'::jsonb)) with ordinality as risk(value, ordinality)),
   ''
  );
  next_source := case
   when jsonb_typeof(p_brief->'unresolved')='array' and jsonb_array_length(p_brief->'unresolved')>0
    then p_brief->'unresolved'->>0
   else 'Review the imported brief in Architect before any model build.'
  end;
 else
  name_source := idea;
  name_value := coalesce(nullif(trim(public.talk_bound_text(name_source, 100)), ''), 'Untitled project');
  description_source := case
   when coalesce(p_handoff->>'description','') <> '' then p_handoff->>'description'
   else idea
  end;
  description_from := case
   when coalesce(p_handoff->>'description','') <> '' then 'handoff.description'
   else 'handoff.idea'
  end;
  next_source := 'Review the imported brief in Architect before any model build.';
 end if;
 if p_plan is not null then
  plan_solution := concat_ws(E'\n', coalesce(p_plan->>'summary',''),
   (select string_agg(format('%s: %s', e->>'title', e->>'detail'), E'\n' order by ordinality)
    from jsonb_array_elements(coalesce(p_plan->'steps','[]'::jsonb)) with ordinality as step(e, ordinality)));
  plan_milestones := coalesce(
   (select string_agg(e->>'title', E'\n' order by ordinality)
    from jsonb_array_elements(coalesce(p_plan->'steps','[]'::jsonb)) with ordinality as step(e, ordinality)),
   ''
  );
 end if;
 if p_palette is not null then
  palette_deliverables := format('Palette %s: %s', coalesce(p_palette->>'title',''),
   coalesce((select string_agg(format('%s %s', e->>'name', e->>'hex'), ', ' order by ordinality)
    from jsonb_array_elements(coalesce(p_palette->'swatches','[]'::jsonb)) with ordinality as swatch(e, ordinality)),''));
 end if;

 if p_brief is not null then
  copied_fields := copied_fields || jsonb_build_array(
   jsonb_build_object('into','name','from','brief.title','truncated', public.talk_utf16_length(name_source)>100),
   jsonb_build_object('into','description','from',description_from,'truncated', public.talk_utf16_length(description_source)>2000),
   jsonb_build_object('into','blueprint.audience','from','brief.audience','truncated', public.talk_utf16_length(audience_source)>3000),
   jsonb_build_object('into','blueprint.requirements','from','brief.purpose, brief.visualDirection, brief.requirements','truncated', public.talk_utf16_length(coalesce(requirements_source,''))>3000),
   jsonb_build_object('into','blueprint.risks','from','brief.unresolved','truncated', public.talk_utf16_length(coalesce(risks_source,''))>3000)
  );
  copied := format('name from brief.title%s; description from %s%s; blueprint.audience from brief.audience%s; blueprint.requirements from brief.purpose, brief.visualDirection, brief.requirements%s; blueprint.risks from brief.unresolved%s',
   case when public.talk_utf16_length(name_source)>100 then ' (truncated)' else '' end,
   description_from,
   case when public.talk_utf16_length(description_source)>2000 then ' (truncated)' else '' end,
   case when public.talk_utf16_length(coalesce(audience_source,''))>3000 then ' (truncated)' else '' end,
   case when public.talk_utf16_length(coalesce(requirements_source,''))>3000 then ' (truncated)' else '' end,
   case when public.talk_utf16_length(coalesce(risks_source,''))>3000 then ' (truncated)' else '' end
  );
 else
  copied_fields := copied_fields || jsonb_build_array(
   jsonb_build_object('into','description','from',description_from,'truncated', public.talk_utf16_length(description_source)>2000)
  );
  copied := format('description from %s%s',
   description_from,
   case when public.talk_utf16_length(description_source)>2000 then ' (truncated)' else '' end
  );
 end if;
 if p_plan is not null then
  copied_fields := copied_fields || jsonb_build_array(
   jsonb_build_object('into','blueprint.solution','from','plan.summary and plan.steps title/detail','truncated', public.talk_utf16_length(coalesce(plan_solution,''))>3000),
   jsonb_build_object('into','blueprint.milestones','from','plan.steps.title','truncated', public.talk_utf16_length(coalesce(plan_milestones,''))>3000)
  );
  copied := copied || format('; blueprint.solution from plan.summary and plan.steps title/detail%s; blueprint.milestones from plan.steps.title%s',
   case when public.talk_utf16_length(coalesce(plan_solution,''))>3000 then ' (truncated)' else '' end,
   case when public.talk_utf16_length(coalesce(plan_milestones,''))>3000 then ' (truncated)' else '' end
  );
 end if;
 copied_fields := copied_fields || jsonb_build_array(
  jsonb_build_object('into','blueprint.vision','from','handoff.idea','truncated', public.talk_utf16_length(idea)>3000),
  jsonb_build_object('into','blueprint.decisions','from','handoff.decisions','truncated', public.talk_utf16_length(coalesce(p_handoff->>'decisions',''))>3000)
 );
 copied := copied || format('; blueprint.vision from handoff.idea%s; blueprint.decisions from handoff.decisions%s',
  case when public.talk_utf16_length(idea)>3000 then ' (truncated)' else '' end,
  case when public.talk_utf16_length(coalesce(p_handoff->>'decisions',''))>3000 then ' (truncated)' else '' end
 );
 if p_palette is not null then
  copied_fields := copied_fields || jsonb_build_array(
   jsonb_build_object('into','blueprint.deliverables','from','palette.title and swatch name+hex (roles and contrast not copied)','truncated', public.talk_utf16_length(coalesce(palette_deliverables,''))>3000)
  );
  copied := copied || format('; blueprint.deliverables from palette.title and swatch name+hex (roles and contrast not copied)%s',
   case when public.talk_utf16_length(coalesce(palette_deliverables,''))>3000 then ' (truncated)' else '' end
  );
 end if;
 referenced := coalesce((
  select string_agg(label, '; ' order by grp, ord)
  from (
   select 0 as grp, ordinality as ord,
    format('%s %s v%s', e->>'kind', e->>'versionId', e->>'version') as label
   from jsonb_array_elements(coalesce(p_handoff->'selections','[]'::jsonb)) with ordinality as elem(e, ordinality)
   union all
   select 1, ordinality,
    format('image artifact %s version %s studio project %s', e->>'artifactId', e->>'versionId', e->>'projectId')
   from jsonb_array_elements(coalesce(p_images,'[]'::jsonb)) with ordinality as img(e, ordinality)
  ) refs
 ), '');
 content := jsonb_build_object(
  'name', name_value,
  'description', public.talk_bound_text(description_source, 2000),
  'discipline', discipline,
  'status', 'active',
  'sources', '[]'::jsonb,
  'documents', '[]'::jsonb,
  'blueprint', jsonb_build_object(
   'vision', public.talk_bound_text(idea, 3000),
   'opportunity', '',
   'audience', public.talk_bound_text(coalesce(audience_source,''), 3000),
   'requirements', public.talk_bound_text(coalesce(requirements_source,''), 3000),
   'research', '',
   'solution', public.talk_bound_text(coalesce(plan_solution,''), 3000),
   'architecture', '',
   'decisions', public.talk_bound_text(coalesce(p_handoff->>'decisions',''), 3000),
   'risks', public.talk_bound_text(coalesce(risks_source,''), 3000),
   'milestones', public.talk_bound_text(coalesce(plan_milestones,''), 3000),
   'deliverables', public.talk_bound_text(coalesce(palette_deliverables,''), 3000),
   'state', public.talk_bound_text(format(
     'Imported from Talk conversation %s. Package prepared %s. Copied into this Origin project as text only: %s. Palette roles, contrast pairs and image pixels were not copied. Referenced and retained in Talk only: %s. Requirements and feasibility remain to be confirmed.',
     p_handoff->>'conversationId',
     p_handoff->>'preparedAt',
     coalesce(nullif(copied,''),'none'),
     coalesce(nullif(referenced,''),'none')
   ), 3000),
   'next', public.talk_bound_text(coalesce(next_source,'Review the imported brief in Architect before any model build.'), 3000)
  )
 );
 if not public.architect_origin_valid(content) then
  raise exception 'Invalid import' using errcode='P0001';
 end if;
 provenance := jsonb_build_object(
  'mappingVersion', 'talk-origin-import/v1',
  'imagesCopied', false,
  'paletteRolesCopied', false,
  'contrastCopied', false,
  'copied', copied_fields,
  'referenced', coalesce((
    select jsonb_agg(item order by grp, ord)
    from (
     select 0 as grp, ordinality as ord, jsonb_build_object(
      'kind', e->>'kind',
      'title', e->>'title',
      'lineageId', e->>'lineageId',
      'versionId', e->>'versionId',
      'version', (e->>'version')::int,
      'retainedInTalk', true,
      'copiedIntoProject', false
     ) as item
     from jsonb_array_elements(coalesce(p_handoff->'selections','[]'::jsonb)) with ordinality as elem(e, ordinality)
     union all
     select 1, ordinality, jsonb_build_object(
      'kind', 'image',
      'versionId', e->>'versionId',
      'artifactId', e->>'artifactId',
      'projectId', e->>'projectId',
      'retainedInTalk', true,
      'copiedIntoProject', false
     )
     from jsonb_array_elements(coalesce(p_images,'[]'::jsonb)) with ordinality as img(e, ordinality)
    ) assets
  ), '[]'::jsonb)
 );
 return jsonb_build_object(
  'mappingVersion', 'talk-origin-import/v1',
  'content', content,
  'provenance', provenance
 );
end $$;
revoke all on function public.ai_talk_origin_mapped_project(jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;

create function public.ai_talk_import_origin(p_id uuid,p_handoff uuid,p_conversation uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 owner_id uuid; package public.ai_talk_creations; creation public.ai_talk_creations;
 receipt public.ai_talk_origin_imports; version_row public.architect_origin_versions;
 selection jsonb; image jsonb; brief jsonb; plan jsonb; palette jsonb; images jsonb := '[]'::jsonb;
 mapped jsonb; content jsonb; provenance jsonb; project_id uuid; save_id uuid;
 artifact_ok boolean;
begin
 select id into owner_id from public.persons where auth_user_id=auth.uid() for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_id is null or p_handoff is null or p_conversation is null then
  raise exception 'Invalid import' using errcode='P0001';
 end if;
 select * into receipt from public.ai_talk_origin_imports where id=p_id;
 if found then
  if receipt.person_id<>owner_id or receipt.handoff_id<>p_handoff or receipt.conversation_id<>p_conversation then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object(
   'id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,
   'saveId',receipt.save_id,'mappingVersion',receipt.mapping_version,'recovered',true
  );
 end if;
 select * into receipt from public.ai_talk_origin_imports where person_id=owner_id and handoff_id=p_handoff;
 if found then
  if receipt.conversation_id<>p_conversation then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object(
   'id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,
   'saveId',receipt.save_id,'mappingVersion',receipt.mapping_version,'recovered',true
  );
 end if;
 select * into package from public.ai_talk_creations
  where id=p_handoff and person_id=owner_id and conversation_id=p_conversation and kind='handoff' for update;
 if not found then raise exception 'Package unavailable' using errcode='42501'; end if;
 if package.content->>'schema' is distinct from 'talk-architect-handoff/v1'
    or package.content->>'conversationId' is distinct from p_conversation::text then
  raise exception 'Package unavailable' using errcode='42501';
 end if;
 for selection in select value from jsonb_array_elements(coalesce(package.content->'selections','[]'::jsonb))
 loop
  select * into creation from public.ai_talk_creations
   where id=(selection->>'versionId')::uuid
     and person_id=owner_id
     and conversation_id=p_conversation
     and kind=selection->>'kind'
     and lineage_id=(selection->>'lineageId')::uuid
     and version=(selection->>'version')::int
     and coalesce(candidate,false)=false;
  if not found then raise exception 'Package unavailable' using errcode='42501'; end if;
  if creation.kind='brief' then
   if brief is not null then
    raise exception 'Choose one current brief, plan or palette of each kind.' using errcode='23514';
   end if;
   brief := creation.content;
  elsif creation.kind='plan' then
   if plan is not null then
    raise exception 'Choose one current brief, plan or palette of each kind.' using errcode='23514';
   end if;
   plan := creation.content;
  elsif creation.kind='palette' then
   if palette is not null then
    raise exception 'Choose one current brief, plan or palette of each kind.' using errcode='23514';
   end if;
   palette := creation.content;
  end if;
 end loop;
 for image in select value from jsonb_array_elements(coalesce(package.content->'images','[]'::jsonb))
 loop
  if to_regclass('public.ai_conversation_artifacts') is null then
   raise exception 'Package unavailable' using errcode='42501';
  end if;
  execute
   'select exists(select 1 from public.ai_conversation_artifacts where id=$1 and person_id=$2 and conversation_id=$3 and version_id=$4 and project_id=$5 and status=''complete'')'
   into artifact_ok
   using (image->>'artifactId')::uuid, owner_id, p_conversation, (image->>'versionId')::uuid, (image->>'projectId')::uuid;
  if not coalesce(artifact_ok,false) then
   raise exception 'Package unavailable' using errcode='42501';
  end if;
  images := images || jsonb_build_array(image);
 end loop;
 mapped := public.ai_talk_origin_mapped_project(package.content, brief, plan, palette, images);
 content := mapped->'content';
 provenance := mapped->'provenance';
 project_id := public.ai_talk_scoped_identity('talk-origin-project:'||owner_id::text||':'||p_handoff::text);
 save_id := public.ai_talk_scoped_identity('talk-origin-save:'||owner_id::text||':'||p_handoff::text);
 select * into version_row from public.architect_origin_versions where id=save_id;
 if found then
  if version_row.person_id<>owner_id or version_row.project_id<>project_id
     or version_row.note is distinct from 'Imported from Talk'
     or version_row.content is distinct from content then
   raise exception 'Project unavailable' using errcode='P0001';
  end if;
 else
  perform public.architect_origin_save(project_id, save_id, 0, content, 'Imported from Talk');
 end if;
 begin
  insert into public.ai_talk_origin_imports(
   id,person_id,handoff_id,conversation_id,project_id,save_id,prepared_at,provenance,mapping_version
  ) values(
   p_id,owner_id,p_handoff,p_conversation,project_id,save_id,
   package.content->>'preparedAt',provenance,'talk-origin-import/v1'
  );
 exception when unique_violation then
  select * into receipt from public.ai_talk_origin_imports
   where person_id=owner_id and (id=p_id or handoff_id=p_handoff or save_id=save_id or project_id=project_id);
  if not found then raise exception 'Import receipt unavailable' using errcode='P0001'; end if;
  if receipt.handoff_id<>p_handoff or receipt.conversation_id<>p_conversation
     or receipt.project_id<>project_id or receipt.save_id<>save_id then
   raise exception 'Import request reused with different inputs' using errcode='23514';
  end if;
  return jsonb_build_object(
   'id',receipt.id,'handoffId',receipt.handoff_id,'projectId',receipt.project_id,
   'saveId',receipt.save_id,'mappingVersion',receipt.mapping_version,'recovered',true
  );
 end;
 return jsonb_build_object(
  'id',p_id,'handoffId',p_handoff,'projectId',project_id,
  'saveId',save_id,'mappingVersion','talk-origin-import/v1','recovered',false
 );
end $$;
revoke all on function public.ai_talk_import_origin(uuid,uuid,uuid) from public,anon;
grant execute on function public.ai_talk_import_origin(uuid,uuid,uuid) to authenticated;
