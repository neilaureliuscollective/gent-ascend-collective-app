-- Generated with supabase migration new, ordered after existing Studio 20261019 migrations.
-- User-supplied profiles are not supplier approval. Once saved, provenance and required layers are immutable.
create function public.ai_studio_label_protect() returns trigger
language plpgsql security invoker set search_path='' as $$
declare region jsonb; prior_layer jsonb; next_layer jsonb;
begin
 if old.document ? 'label' then
  if new.document->'label' is distinct from old.document->'label' or new.document->'page' is distinct from old.document->'page' then
   raise exception 'LABEL_PROFILE_IMMUTABLE';
  end if;
  for region in select value from jsonb_array_elements(old.document->'label'->'profile'->'protected') loop
   select value into prior_layer from jsonb_array_elements(old.document->'layers') where value->>'id'=region->>'id';
   select value into next_layer from jsonb_array_elements(new.document->'layers') where value->>'id'=region->>'id';
   if next_layer is null or next_layer is distinct from prior_layer then raise exception 'LABEL_COPY_PROTECTED'; end if;
  end loop;
 elsif new.document ? 'label' then
  raise exception 'LABEL_REQUIRES_NEW_DESIGN';
 end if;
 return new;
end $$;
revoke all on function public.ai_studio_label_protect() from public,anon,authenticated;
create trigger ai_studio_label_protect before update on public.ai_studio_designs
for each row execute function public.ai_studio_label_protect();
