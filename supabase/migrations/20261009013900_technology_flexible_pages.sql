-- Extend the strict brief without rewriting saved versions or changing ownership/RPCs.
-- Keep the previous validator as an explicit compatibility boundary.
alter function public.technology_validate_brief(jsonb) rename to technology_validate_design_brief;
create function public.technology_validate_brief(b jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare p jsonb; s jsonb; k text; slugs text[]:=array[]::text[];
begin
 if not public.technology_validate_design_brief(b - 'pages') then return false; end if;
 if not (b ? 'pages') then return true; end if;
 if jsonb_typeof(b->'pages') is distinct from 'array' then return false; end if;
 if jsonb_array_length(b->'pages')>3 then return false; end if;
 for p in select jsonb_array_elements(b->'pages') loop
  if jsonb_typeof(p) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p))<>4 or not(p ?& array['slug','title','layout','sections']) then return false; end if;
  for k in select unnest(array['slug','title','layout']) loop if jsonb_typeof(p->k) is distinct from 'string' then return false; end if; end loop;
  if length(p->>'slug') not between 2 and 48 or p->>'slug' !~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' or p->>'slug' in ('home','services','about','contact') or p->>'slug'=any(slugs) then return false; end if;
  slugs:=array_append(slugs,p->>'slug');
  if length(trim(p->>'title')) not between 2 and 60 or p->>'layout' not in ('stacked','cards') then return false; end if;
  if jsonb_typeof(p->'sections') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p->'sections') not between 1 and 3 then return false; end if;
  for s in select jsonb_array_elements(p->'sections') loop
   if jsonb_typeof(s) is distinct from 'object' then return false; end if;
   if (select count(*) from jsonb_object_keys(s))<>2 or not(s ?& array['heading','body']) then return false; end if;
   if jsonb_typeof(s->'heading') is distinct from 'string' or jsonb_typeof(s->'body') is distinct from 'string' then return false; end if;
   if length(trim(s->>'heading')) not between 2 and 80 or length(trim(s->>'body')) not between 3 and 600 then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
-- Rebind the constraint: ALTER FUNCTION RENAME preserves the previous OID.
alter table public.technology_site_versions drop constraint technology_valid_brief;
alter table public.technology_site_versions add constraint technology_valid_brief check(public.technology_validate_brief(brief));
revoke all on function public.technology_validate_brief(jsonb) from public,anon,authenticated;
