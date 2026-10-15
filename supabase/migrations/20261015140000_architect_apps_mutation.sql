-- Additive mutation identity: replay is bound to the committed payload.
-- A changed payload with the same idempotency key is a conflict, not a silent retry.
-- Concurrent edits use an integer version.

alter table public.architect_app_records
  add column if not exists version integer not null default 1;

-- Replace the six-argument writer. Replay of a different payload must not succeed.
drop function if exists public.architect_apps_write_record(uuid, uuid, text, jsonb, text, uuid);

create or replace function public.architect_apps_write_record(
  p_project uuid,
  p_app uuid,
  p_collection text,
  p_payload jsonb,
  p_key text,
  p_id uuid,
  p_expected integer default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid;
  existing public.architect_app_records;
  replay public.architect_app_records;
  n integer;
  saved uuid;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid() for update;
  if owner_id is null then raise exception 'Sign in required'; end if;
  if p_collection is null or length(trim(p_collection)) not between 1 and 40 then raise exception 'Invalid record'; end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8000 then raise exception 'Invalid record'; end if;
  if not exists(select 1 from public.architect_apps where id = p_app and person_id = owner_id and project_id = p_project) then
    raise exception 'Application unavailable';
  end if;
  if p_key is not null then
    select * into replay from public.architect_app_records
      where app_id = p_app and collection = p_collection and idempotency_key = p_key;
    if found then
      if replay.person_id <> owner_id then raise exception 'Record unavailable'; end if;
      if replay.payload is distinct from p_payload then
        raise exception 'This operation identity already saved a different record. Request a new mutation identity.';
      end if;
      return replay.id;
    end if;
  end if;
  if p_id is not null then
    select * into existing from public.architect_app_records where id = p_id for update;
    if found then
      if existing.person_id <> owner_id or existing.app_id <> p_app or existing.collection <> p_collection then
        raise exception 'Record unavailable';
      end if;
      if p_expected is not null and existing.version is distinct from p_expected then
        raise exception 'Record changed. Reload before saving this edit.';
      end if;
      update public.architect_app_records
        set payload = p_payload,
            updated_at = now(),
            idempotency_key = coalesce(p_key, existing.idempotency_key),
            version = existing.version + 1
        where id = p_id;
      return p_id;
    end if;
  end if;
  select count(*)::int into n from public.architect_app_records where person_id = owner_id and app_id = p_app and collection = p_collection;
  if n >= 200 then raise exception 'Collection quota exceeded'; end if;
  insert into public.architect_app_records(id, person_id, project_id, app_id, collection, payload, idempotency_key, version)
    values(coalesce(p_id, gen_random_uuid()), owner_id, p_project, p_app, p_collection, p_payload, p_key, 1)
    returning id into saved;
  return saved;
end $$;

revoke all on function public.architect_apps_write_record(uuid,uuid,text,jsonb,text,uuid,integer) from public, anon;
grant execute on function public.architect_apps_write_record(uuid,uuid,text,jsonb,text,uuid,integer) to authenticated;
