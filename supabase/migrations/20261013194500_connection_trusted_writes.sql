-- Trusted broker for verification-authoritative connection writes.
-- Authenticated founders keep owner reads, flow start/consume, disconnect and
-- selection intent. They cannot mint connected status, installation identity,
-- capabilities or last_verified_at through PostgREST.
alter table public.service_connections
  add column if not exists user_authorization text
  check (user_authorization is null or user_authorization in ('active','revoked'));

create function public.service_connection_require_broker() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') is distinct from 'service_role' then
    raise exception 'Trusted connection broker required';
  end if;
end $$;
revoke all on function public.service_connection_require_broker() from public, anon, authenticated;

revoke all on function
  public.service_connection_upsert(uuid,text,text,text,text,text,text,text,jsonb,timestamptz,text),
  public.service_connection_put_secret(uuid,text),
  public.service_connection_take_secret(uuid),
  public.service_connection_claim_install(text,text)
from public, anon, authenticated, service_role;

drop function public.service_connection_upsert(uuid,text,text,text,text,text,text,text,jsonb,timestamptz,text);
drop function public.service_connection_put_secret(uuid,text);
drop function public.service_connection_take_secret(uuid);
drop function public.service_connection_claim_install(text,text);

create or replace function public.service_connection_read(p_provider text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; row public.service_connections;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then
    if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
    raise exception 'Founder access required';
  end if;
  select * into row from public.service_connections where person_id = owner_id and provider = p_provider;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', row.id, 'person_id', row.person_id, 'provider', row.provider, 'status', row.status,
    'account_login', row.account_login, 'account_id', row.account_id, 'installation_id', row.installation_id,
    'selected_id', row.selected_id, 'selected_name', row.selected_name, 'capabilities', row.capabilities,
    'last_verified_at', row.last_verified_at, 'last_error', row.last_error,
    'user_authorization', row.user_authorization,
    'created_at', row.created_at, 'updated_at', row.updated_at
  );
end $$;

create or replace function public.service_connection_list() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then
    if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
    raise exception 'Founder access required';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'person_id', person_id, 'provider', provider, 'status', status,
      'account_login', account_login, 'account_id', account_id, 'installation_id', installation_id,
      'selected_id', selected_id, 'selected_name', selected_name, 'capabilities', capabilities,
      'last_verified_at', last_verified_at, 'last_error', last_error,
      'user_authorization', user_authorization,
      'created_at', created_at, 'updated_at', updated_at
    ) order by provider)
    from public.service_connections where person_id = owner_id
  ), '[]'::jsonb);
end $$;

create function public.service_connection_upsert(
  p_person uuid, p_id uuid, p_provider text, p_status text, p_account_login text, p_account_id text,
  p_installation text, p_selected_id text, p_selected_name text, p_capabilities jsonb,
  p_verified timestamptz, p_error text, p_user_authorization text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.service_connection_require_broker();
  if p_person is null or not exists (
    select 1 from public.founder_access where person_id = p_person
  ) then
    raise exception 'Founder access required';
  end if;
  if p_provider not in ('github','vercel')
     or p_status not in (
       'setup_required','disconnected','connecting','connected','degraded','expired','revoked','verification_failed'
     )
     or (p_user_authorization is not null and p_user_authorization not in ('active','revoked')) then
    raise exception 'Invalid connection record';
  end if;
  insert into public.service_connections(
    id, person_id, provider, status, account_login, account_id, installation_id,
    selected_id, selected_name, capabilities, last_verified_at, last_error, user_authorization
  ) values (
    p_id, p_person, p_provider, p_status, p_account_login, p_account_id, p_installation,
    p_selected_id, p_selected_name, coalesce(p_capabilities, '{}'::jsonb), p_verified, p_error,
    p_user_authorization
  )
  on conflict (person_id, provider) do update set
    status = excluded.status,
    account_login = excluded.account_login,
    account_id = excluded.account_id,
    installation_id = excluded.installation_id,
    selected_id = excluded.selected_id,
    selected_name = excluded.selected_name,
    capabilities = excluded.capabilities,
    last_verified_at = excluded.last_verified_at,
    last_error = excluded.last_error,
    user_authorization = excluded.user_authorization,
    updated_at = now()
  where public.service_connections.person_id = p_person;
  return true;
end $$;

create function public.service_connection_put_secret(p_person uuid, p_id uuid, p_ciphertext text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.service_connection_require_broker();
  if not exists (
    select 1 from public.service_connections where id = p_id and person_id = p_person
  ) then
    raise exception 'Connection unavailable';
  end if;
  insert into public.service_connection_secrets(connection_id, ciphertext)
  values (p_id, p_ciphertext)
  on conflict (connection_id) do update set ciphertext = excluded.ciphertext, updated_at = now();
  return true;
end $$;

create function public.service_connection_take_secret(p_person uuid, p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare secret text;
begin
  perform public.service_connection_require_broker();
  select s.ciphertext into secret
    from public.service_connection_secrets s
    join public.service_connections c on c.id = s.connection_id
   where s.connection_id = p_id and c.person_id = p_person;
  return secret;
end $$;

create function public.service_connection_claim_install(p_person uuid, p_state text, p_installation text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.service_connection_require_broker();
  if p_person is null or not exists (
    select 1 from public.founder_access where person_id = p_person
  ) then
    raise exception 'Founder access required';
  end if;
  update public.service_connection_flows
     set claimed_installation_id = p_installation
   where state = p_state and person_id = p_person and consumed_at is null and expires_at > now();
  return found;
end $$;

create function public.service_connection_set_selection(
  p_provider text, p_selected_id text, p_selected_name text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then raise exception 'Founder access required'; end if;
  if p_provider not in ('github','vercel')
     or p_selected_id is null or length(p_selected_id) not between 1 and 120
     or p_selected_name is null or length(p_selected_name) not between 1 and 201 then
    raise exception 'Invalid connection selection';
  end if;
  update public.service_connections
     set selected_id = p_selected_id,
         selected_name = p_selected_name,
         status = 'connecting',
         last_verified_at = null,
         last_error = 'Selection is stored as intent until the server verifies provider access.',
         updated_at = now()
   where person_id = owner_id
     and provider = p_provider
     and status in ('connecting','connected','degraded','verification_failed')
     and coalesce(user_authorization, 'active') is distinct from 'revoked';
  return found;
end $$;

create or replace function public.service_connection_record_event(p_provider text, p_delivery text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.service_connection_require_broker();
  if p_provider not in ('github','vercel') or p_delivery is null or length(p_delivery) not between 8 and 120 then
    raise exception 'Invalid connection event';
  end if;
  insert into public.service_connection_events(provider, delivery_id) values (p_provider, p_delivery)
  on conflict do nothing;
  return found;
end $$;

create or replace function public.service_connection_apply_status(
  p_provider text, p_installation text, p_status text, p_error text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed boolean;
begin
  perform public.service_connection_require_broker();
  if p_provider not in ('github','vercel') or p_installation is null
     or p_status not in ('degraded','expired','revoked','verification_failed') then
    raise exception 'Invalid connection status';
  end if;
  update public.service_connections
     set status = p_status, last_error = p_error, updated_at = now()
   where provider = p_provider and installation_id = p_installation;
  changed := found;
  if p_status in ('revoked','expired') then
    delete from public.service_connection_secrets s
    using public.service_connections c
    where s.connection_id = c.id
      and c.provider = p_provider
      and c.installation_id = p_installation;
  end if;
  return changed;
end $$;

create function public.service_connection_apply_account(
  p_provider text, p_account text, p_status text, p_error text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed boolean;
begin
  perform public.service_connection_require_broker();
  if p_provider <> 'github' or p_account is null or length(p_account) not between 1 and 80 then
    raise exception 'Invalid account revocation';
  end if;
  if p_status <> 'expired' then
    raise exception 'User authorization revocation cannot mark an installation deleted';
  end if;
  update public.service_connections
     set status = 'expired',
         user_authorization = 'revoked',
         last_error = p_error,
         updated_at = now()
   where provider = p_provider and account_id = p_account;
  changed := found;
  delete from public.service_connection_secrets s
  using public.service_connections c
  where s.connection_id = c.id
    and c.provider = p_provider
    and c.account_id = p_account;
  return changed;
end $$;

revoke all on function
  public.service_connection_upsert(uuid,uuid,text,text,text,text,text,text,text,jsonb,timestamptz,text,text),
  public.service_connection_put_secret(uuid,uuid,text),
  public.service_connection_take_secret(uuid,uuid),
  public.service_connection_claim_install(uuid,text,text),
  public.service_connection_apply_status(text,text,text,text),
  public.service_connection_apply_account(text,text,text,text),
  public.service_connection_record_event(text,text)
from public, anon, authenticated;
grant execute on function
  public.service_connection_upsert(uuid,uuid,text,text,text,text,text,text,text,jsonb,timestamptz,text,text),
  public.service_connection_put_secret(uuid,uuid,text),
  public.service_connection_take_secret(uuid,uuid),
  public.service_connection_claim_install(uuid,text,text),
  public.service_connection_apply_status(text,text,text,text),
  public.service_connection_apply_account(text,text,text,text),
  public.service_connection_record_event(text,text)
to service_role;
revoke all on function public.service_connection_set_selection(text,text,text) from public, anon;
grant execute on function public.service_connection_set_selection(text,text,text) to authenticated;
