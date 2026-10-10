-- Preserve the original nine-field validator and immutable legacy briefs.
alter function public.technology_validate_brief(jsonb) rename to technology_validate_core_brief;
create function public.technology_validate_brief(b jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare d jsonb; k text;
begin
 if not public.technology_validate_core_brief(b - 'design') then return false; end if;
 if not (b ? 'design') then return true; end if;
 d:=b->'design';
 if jsonb_typeof(d) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(d))<>9 or not(d ?& array['palette','hero','typography','spacing','audience','goal','rationale','cta','request']) then return false; end if;
 for k in select jsonb_object_keys(d) loop if jsonb_typeof(d->k) is distinct from 'string' then return false; end if; end loop;
 if d->>'palette' not in ('petrol','ivory','slate') or d->>'hero' not in ('editorial','centered','split') or d->>'typography' not in ('serif','sans') or d->>'spacing' not in ('spacious','compact') then return false; end if;
 return length(d->>'audience')<=200 and length(d->>'goal')<=200 and length(d->>'rationale')<=500 and length(trim(d->>'cta')) between 2 and 60 and length(d->>'request')<=1000;
end $$;
-- The existing constraint follows the renamed function OID. Rebind explicitly.
alter table public.technology_site_versions drop constraint technology_valid_brief;
alter table public.technology_site_versions add constraint technology_valid_brief check(public.technology_validate_brief(brief));
revoke all on function public.technology_validate_brief(jsonb) from public,anon,authenticated;
