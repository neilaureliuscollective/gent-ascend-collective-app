-- Small immutable raster snapshots. Original Studio deletion does not delete website history.
create table public.technology_images(
 id uuid primary key,person_id uuid not null,project_id uuid not null,source_id uuid not null,
 source_kind text not null check(source_kind in('reference','version')),
 status text not null check(status in('running','failed','ready')),
 lease uuid,lease_until timestamptz,attempts integer not null check(attempts between 1 and 3),
 data_url text,sha256 text,created_at timestamptz not null default now(),
 foreign key(person_id,project_id) references public.technology_projects(person_id,id) on delete cascade,
 unique(person_id,project_id,id),unique(project_id,source_kind,source_id),
 check((status='ready' and data_url is not null and length(data_url)<=133359 and data_url ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]*={0,2}$' and sha256 ~ '^[a-f0-9]{64}$' and sha256 is not null and lease is null and lease_until is null)
 or(status='running' and data_url is null and sha256 is null and lease is not null and lease_until is not null)
 or(status='failed' and data_url is null and sha256 is null and lease is null and lease_until is null))
);
create index technology_images_owner on public.technology_images(person_id,project_id);
alter table public.technology_images enable row level security;
revoke all on public.technology_images from public,anon,authenticated;
grant select on public.technology_images to authenticated;
create policy technology_images_owner_read on public.technology_images for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.technology_image_begin(p_id uuid,p_project uuid,p_expected integer,p_source uuid,p_kind text,p_lease uuid) returns text
language plpgsql security definer set search_path='' as $$
declare owner uuid:=public.technology_owner(); r public.technology_images; key text;
begin
 perform 1 from public.persons where id=owner for update;
 if not exists(select 1 from public.technology_projects where id=p_project and person_id=owner and revision=p_expected) then raise exception 'Website changed';end if;
 select * into r from public.technology_images where id=p_id for update;
 if found then
  if r.person_id<>owner or r.project_id<>p_project or r.source_id<>p_source or r.source_kind<>p_kind then raise exception 'Image request changed';end if;
  if r.status='ready' then return null;end if;
  if r.attempts>=3 or r.lease_until>now() then raise exception 'Image active or attempts exhausted';end if;
 else
  if (select count(*) from public.technology_images where person_id=owner)>=20 or (select count(*) from public.technology_images where project_id=p_project)>=4 then raise exception 'Image allowance reached';end if;
 end if;
 if exists(select 1 from public.technology_images where person_id=owner and status='running' and lease_until>now()) then raise exception 'Image already active';end if;
 if p_kind='reference' then
  select v.storage_key into key from public.ai_studio_references v join public.ai_studio_projects p on p.id=v.project_id and p.person_id=v.person_id where v.id=p_source and v.person_id=owner and p.company_id is null;
 elsif p_kind='version' then
  select v.storage_key into key from public.ai_studio_versions v join public.ai_studio_projects p on p.id=v.project_id and p.person_id=v.person_id where v.id=p_source and v.person_id=owner and p.company_id is null and v.status='complete';
 end if;
 if key is null or key not like auth.uid()::text||'/%' then raise exception 'Personal Studio image unavailable';end if;
 if r.id is null then
  insert into public.technology_images(id,person_id,project_id,source_id,source_kind,status,lease,lease_until,attempts) values(p_id,owner,p_project,p_source,p_kind,'running',p_lease,now()+interval '30 seconds',1);
 else
  update public.technology_images set status='running',lease=p_lease,lease_until=now()+interval '30 seconds',attempts=attempts+1 where id=p_id;
 end if;
 return key;
end $$;
create function public.technology_image_finish(p_id uuid,p_owner uuid,p_lease uuid,p_data text,p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.technology_images set status=case when p_data is null then 'failed' else 'ready' end,data_url=p_data,sha256=p_hash,lease=null,lease_until=null
 where id=p_id and person_id=p_owner and status='running' and lease=p_lease and lease_until>now();
 return found;
end $$;
revoke all on function public.technology_image_begin(uuid,uuid,integer,uuid,text,uuid) from public,anon;
grant execute on function public.technology_image_begin(uuid,uuid,integer,uuid,text,uuid) to authenticated;
revoke all on function public.technology_image_finish(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.technology_image_finish(uuid,uuid,uuid,text,text) to service_role;
-- Extend the strict brief while retaining all prior validators and legacy records.
alter function public.technology_validate_brief(jsonb) rename to technology_validate_pages_brief;
create function public.technology_validate_brief(b jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare i jsonb;
begin
 if not public.technology_validate_pages_brief(b-'image') then return false;end if;
 if not(b?'image') then return true;end if;
 i:=b->'image';if jsonb_typeof(i) is distinct from 'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(i))<>2 or not(i ?& array['assetId','alt']) then return false;end if;
 return jsonb_typeof(i->'assetId')='string' and i->>'assetId' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and jsonb_typeof(i->'alt')='string' and length(trim(i->>'alt')) between 3 and 160 and i->>'alt' !~ '[[:cntrl:]]';
end $$;
alter table public.technology_site_versions drop constraint technology_valid_brief;
alter table public.technology_site_versions add constraint technology_valid_brief check(public.technology_validate_brief(brief));
alter table public.technology_site_versions add column image_asset_id uuid generated always as ((brief->'image'->>'assetId')::uuid) stored;
alter table public.technology_site_versions add constraint technology_image_owner foreign key(person_id,project_id,image_asset_id) references public.technology_images(person_id,project_id,id);
-- Generated columns are computed AFTER BEFORE triggers: inspect the validated JSON directly.
create function public.technology_require_ready_image() returns trigger language plpgsql set search_path='' as $$
begin
 if new.brief?'image' and not exists(select 1 from public.technology_images where id=(new.brief->'image'->>'assetId')::uuid and person_id=new.person_id and project_id=new.project_id and status='ready') then raise exception 'Image not ready';end if;
 return new;
end $$;
create trigger technology_image_ready before insert on public.technology_site_versions for each row execute function public.technology_require_ready_image();
revoke all on function public.technology_validate_brief(jsonb),public.technology_require_ready_image() from public,anon,authenticated;

-- Image-bearing exports embed one bounded JPEG; keep all ready/queued shape guards.
alter table public.technology_builds drop constraint technology_builds_check;
alter table public.technology_builds add constraint technology_build_payload check((status='ready' and html is not null and octet_length(html)<=250000 and sha256 is not null and sha256 ~ '^[a-f0-9]{64}$' and checks is not null and finished_at is not null) or (status<>'ready' and html is null and sha256 is null and checks is null and finished_at is null));
