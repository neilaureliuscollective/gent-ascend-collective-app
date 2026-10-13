-- Additive owner-bound Connections. Hosted application requires founder-approved migration.
-- Metadata is selectable by the owner. Credentials are never granted to authenticated clients.
create table public.service_connections (
  id uuid primary key,
  person_id uuid not null references public.persons(id) on delete cascade,
  provider text not null check (provider in ('github','vercel')),
  status text not null check (status in (
    'setup_required','disconnected','connecting','connected','degraded','expired','revoked','verification_failed'
  )),
  account_login text check (account_login is null or length(account_login) between 1 and 200),
  account_id text check (account_id is null or length(account_id) between 1 and 80),
  installation_id text check (installation_id is null or length(installation_id) between 1 and 80),
  selected_id text check (selected_id is null or length(selected_id) between 1 and 120),
  selected_name text check (selected_name is null or length(selected_name) between 1 and 201),
  capabilities jsonb not null default '{}'::jsonb check (octet_length(capabilities::text) <= 4000),
  last_verified_at timestamptz,
  last_error text check (last_error is null or length(last_error) between 1 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, provider)
);
create index service_connections_owner on public.service_connections(person_id, provider);
create index service_connections_install on public.service_connections(provider, installation_id);
create table public.service_connection_secrets (
  connection_id uuid primary key references public.service_connections(id) on delete cascade,
  ciphertext text not null check (length(ciphertext) between 32 and 20000),
  updated_at timestamptz not null default now()
);
create table public.service_connection_flows (
  id uuid primary key,
  person_id uuid not null references public.persons(id) on delete cascade,
  provider text not null check (provider in ('github','vercel')),
  state text not null unique check (length(state) between 20 and 80),
  nonce text not null check (length(nonce) between 20 and 80),
  verifier text not null check (length(verifier) between 20 and 120),
  claimed_installation_id text check (claimed_installation_id is null or length(claimed_installation_id) between 1 and 80),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index service_connection_flows_owner on public.service_connection_flows(person_id, created_at desc);
create table public.service_connection_events (
  provider text not null check (provider in ('github','vercel')),
  delivery_id text not null check (length(delivery_id) between 8 and 120),
  received_at timestamptz not null default now(),
  primary key (provider, delivery_id)
);
alter table public.service_connections enable row level security;
alter table public.service_connection_secrets enable row level security;
alter table public.service_connection_flows enable row level security;
alter table public.service_connection_events enable row level security;
create policy service_connections_owner on public.service_connections
  for select to authenticated
  using (person_id = (select id from public.persons where auth_user_id = (select auth.uid())));
revoke all on public.service_connections, public.service_connection_secrets,
  public.service_connection_flows, public.service_connection_events from public, anon, authenticated;
grant select on public.service_connections to authenticated;
create function public.service_connection_owner() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from public.persons p
  join public.founder_access f on f.person_id = p.id
  where p.auth_user_id = (select auth.uid())
$$;
revoke all on function public.service_connection_owner() from public, anon;
grant execute on function public.service_connection_owner() to authenticated;
create function public.service_connection_begin_flow(
  p_id uuid, p_provider text, p_state text, p_nonce text, p_verifier text, p_expires timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then
    if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
    raise exception 'Founder access required';
  end if;
  if p_id is null or p_provider not in ('github','vercel') or p_state is null or length(p_state) not between 20 and 80
     or p_nonce is null or p_verifier is null or p_expires is null or p_expires <= now() then
    raise exception 'Invalid connection flow';
  end if;
  insert into public.service_connection_flows(id, person_id, provider, state, nonce, verifier, expires_at)
  values (p_id, owner_id, p_provider, p_state, p_nonce, p_verifier, p_expires);
  return true;
end $$;
create function public.service_connection_read_flow(p_state text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; row public.service_connection_flows;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then
    if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
    raise exception 'Founder access required';
  end if;
  select * into row from public.service_connection_flows where state = p_state and person_id = owner_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', row.id, 'person_id', row.person_id, 'provider', row.provider, 'state', row.state,
    'nonce', row.nonce, 'verifier', row.verifier, 'claimed_installation_id', row.claimed_installation_id,
    'expires_at', row.expires_at, 'consumed_at', row.consumed_at
  );
end $$;
create function public.service_connection_claim_install(p_state text, p_installation text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then raise exception 'Founder access required'; end if;
  update public.service_connection_flows
     set claimed_installation_id = p_installation
   where state = p_state and person_id = owner_id and consumed_at is null and expires_at > now();
  return found;
end $$;
create function public.service_connection_consume_flow(p_state text, p_consumed timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then raise exception 'Founder access required'; end if;
  update public.service_connection_flows
     set consumed_at = p_consumed
   where state = p_state and person_id = owner_id and consumed_at is null and expires_at > now();
  return found;
end $$;
create function public.service_connection_read(p_provider text) returns jsonb
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
    'created_at', row.created_at, 'updated_at', row.updated_at
  );
end $$;
create function public.service_connection_list() returns jsonb
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
      'created_at', created_at, 'updated_at', updated_at
    ) order by provider)
    from public.service_connections where person_id = owner_id
  ), '[]'::jsonb);
end $$;
create function public.service_connection_upsert(
  p_id uuid, p_provider text, p_status text, p_account_login text, p_account_id text,
  p_installation text, p_selected_id text, p_selected_name text, p_capabilities jsonb,
  p_verified timestamptz, p_error text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then raise exception 'Founder access required'; end if;
  insert into public.service_connections(
    id, person_id, provider, status, account_login, account_id, installation_id,
    selected_id, selected_name, capabilities, last_verified_at, last_error
  ) values (
    p_id, owner_id, p_provider, p_status, p_account_login, p_account_id, p_installation,
    p_selected_id, p_selected_name, coalesce(p_capabilities, '{}'::jsonb), p_verified, p_error
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
    updated_at = now()
  where public.service_connections.person_id = owner_id;
  return true;
end $$;
create function public.service_connection_put_secret(p_id uuid, p_ciphertext text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then raise exception 'Founder access required'; end if;
  if not exists (select 1 from public.service_connections where id = p_id and person_id = owner_id) then
    raise exception 'Connection unavailable';
  end if;
  insert into public.service_connection_secrets(connection_id, ciphertext)
  values (p_id, p_ciphertext)
  on conflict (connection_id) do update set ciphertext = excluded.ciphertext, updated_at = now();
  return true;
end $$;
create function public.service_connection_take_secret(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; secret text;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then raise exception 'Founder access required'; end if;
  select s.ciphertext into secret
    from public.service_connection_secrets s
    join public.service_connections c on c.id = s.connection_id
   where s.connection_id = p_id and c.person_id = owner_id;
  return secret;
end $$;
create function public.service_connection_clear(p_provider text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := public.service_connection_owner();
  if owner_id is null then raise exception 'Founder access required'; end if;
  delete from public.service_connections where person_id = owner_id and provider = p_provider;
  return found;
end $$;
create function public.service_connection_record_event(p_provider text, p_delivery text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_provider not in ('github','vercel') or p_delivery is null or length(p_delivery) not between 8 and 120 then
    raise exception 'Invalid connection event';
  end if;
  insert into public.service_connection_events(provider, delivery_id) values (p_provider, p_delivery)
  on conflict do nothing;
  return found;
end $$;
create function public.service_connection_apply_status(
  p_provider text, p_installation text, p_status text, p_error text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_provider not in ('github','vercel') or p_installation is null
     or p_status not in ('degraded','expired','revoked','verification_failed') then
    raise exception 'Invalid connection status';
  end if;
  update public.service_connections
     set status = p_status, last_error = p_error, updated_at = now()
   where provider = p_provider and installation_id = p_installation;
  return found;
end $$;
revoke all on function
  public.service_connection_begin_flow(uuid,text,text,text,text,timestamptz),
  public.service_connection_read_flow(text),
  public.service_connection_claim_install(text,text),
  public.service_connection_consume_flow(text,timestamptz),
  public.service_connection_read(text),
  public.service_connection_list(),
  public.service_connection_upsert(uuid,text,text,text,text,text,text,text,jsonb,timestamptz,text),
  public.service_connection_put_secret(uuid,text),
  public.service_connection_take_secret(uuid),
  public.service_connection_clear(text)
from public, anon;
grant execute on function
  public.service_connection_begin_flow(uuid,text,text,text,text,timestamptz),
  public.service_connection_read_flow(text),
  public.service_connection_consume_flow(text,timestamptz),
  public.service_connection_read(text),
  public.service_connection_list(),
  public.service_connection_clear(text)
to authenticated;
revoke all on function
  public.service_connection_claim_install(text,text),
  public.service_connection_upsert(uuid,text,text,text,text,text,text,text,jsonb,timestamptz,text),
  public.service_connection_put_secret(uuid,text),
  public.service_connection_take_secret(uuid)
from public, anon, authenticated;
revoke all on function
  public.service_connection_record_event(text,text),
  public.service_connection_apply_status(text,text,text,text)
from public, anon, authenticated;
