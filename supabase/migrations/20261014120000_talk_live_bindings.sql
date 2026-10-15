-- Session-scoped provider-item to durable-turn mapping. Hosted apply requires founder authorization.
-- Authenticated INSERT is revoked; only the relationship-checked RPCs write bindings.
create table public.ai_live_observed_items (
  person_id uuid not null,
  session_id uuid not null,
  conversation_id uuid not null,
  provider_item_id text not null,
  provider_response_id text,
  created_at timestamptz not null default now(),
  primary key (person_id, session_id, provider_item_id)
);
create table public.ai_live_turn_bindings (
  person_id uuid not null,
  conversation_id uuid not null,
  session_id uuid not null,
  provider_item_id text not null,
  provider_response_id text,
  turn_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (person_id, session_id, provider_item_id)
);
create index ai_live_turn_bindings_conversation on public.ai_live_turn_bindings (person_id, conversation_id, session_id);
alter table public.ai_live_observed_items enable row level security;
alter table public.ai_live_turn_bindings enable row level security;
create policy ai_live_observed_items_owner on public.ai_live_observed_items
  for select using (person_id = (select id from public.persons where auth_user_id = auth.uid()));
create policy ai_live_turn_bindings_owner on public.ai_live_turn_bindings
  for select using (person_id = (select id from public.persons where auth_user_id = auth.uid()));
revoke all on public.ai_live_observed_items from public, anon, authenticated;
revoke all on public.ai_live_turn_bindings from public, anon, authenticated;
grant select on public.ai_live_observed_items to authenticated;
grant select on public.ai_live_turn_bindings to authenticated;

create or replace function public.ai_live_observe_item(
  p_session uuid,
  p_conversation uuid,
  p_item text,
  p_response text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'unavailable'; end if;
  if p_session is null or p_conversation is null
    or p_item is null or length(btrim(p_item)) not between 1 and 80
    or p_item !~ '^[a-zA-Z0-9_.-]+$' then
    raise exception 'invalid voice binding';
  end if;
  if p_response is not null and (length(btrim(p_response)) > 80 or p_response !~ '^[a-zA-Z0-9_.-]+$') then
    raise exception 'invalid voice binding';
  end if;
  if not exists (
    select 1 from public.ai_live_sessions
    where id = p_session and person_id = owner_id and conversation_id = p_conversation
  ) then
    raise exception 'unavailable';
  end if;
  insert into public.ai_live_observed_items (
    person_id, session_id, conversation_id, provider_item_id, provider_response_id
  ) values (owner_id, p_session, p_conversation, btrim(p_item), nullif(btrim(p_response), ''))
  on conflict (person_id, session_id, provider_item_id) do nothing;
  return jsonb_build_object('providerItemId', btrim(p_item), 'observed', true);
end;
$$;

create or replace function public.ai_live_bind_turn(
  p_session uuid,
  p_conversation uuid,
  p_item text,
  p_response text,
  p_turn uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  existing public.ai_live_turn_bindings%rowtype;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'unavailable'; end if;
  if p_session is null or p_conversation is null or p_turn is null
    or p_item is null or length(btrim(p_item)) not between 1 and 80
    or p_item !~ '^[a-zA-Z0-9_.-]+$' then
    raise exception 'invalid voice binding';
  end if;
  if p_response is not null and (length(btrim(p_response)) > 80 or p_response !~ '^[a-zA-Z0-9_.-]+$') then
    raise exception 'invalid voice binding';
  end if;
  if not exists (
    select 1 from public.ai_live_sessions
    where id = p_session and person_id = owner_id and conversation_id = p_conversation
  ) then
    raise exception 'unavailable';
  end if;
  if not exists (
    select 1 from public.ai_turns
    where id = p_turn and person_id = owner_id and conversation_id = p_conversation
  ) then
    raise exception 'unavailable';
  end if;
  if not exists (
    select 1 from public.ai_live_observed_items
    where person_id = owner_id and session_id = p_session
      and conversation_id = p_conversation and provider_item_id = btrim(p_item)
  ) then
    raise exception 'unavailable';
  end if;
  select * into existing
  from public.ai_live_turn_bindings
  where person_id = owner_id and session_id = p_session and provider_item_id = btrim(p_item);
  if found then
    if existing.conversation_id <> p_conversation or existing.turn_id <> p_turn then
      raise exception 'Binding request reused with different inputs';
    end if;
    return jsonb_build_object(
      'providerItemId', existing.provider_item_id,
      'providerResponseId', existing.provider_response_id,
      'turnId', existing.turn_id,
      'recovered', true
    );
  end if;
  insert into public.ai_live_turn_bindings (
    person_id, conversation_id, session_id, provider_item_id, provider_response_id, turn_id
  ) values (owner_id, p_conversation, p_session, btrim(p_item), nullif(btrim(p_response), ''), p_turn);
  return jsonb_build_object(
    'providerItemId', btrim(p_item),
    'providerResponseId', nullif(btrim(p_response), ''),
    'turnId', p_turn,
    'recovered', false
  );
end;
$$;

create or replace function public.ai_live_read_bindings(p_session uuid, p_conversation uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  owner_id uuid;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'unavailable'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'providerItemId', provider_item_id,
      'providerResponseId', provider_response_id,
      'turnId', turn_id
    ) order by created_at)
    from public.ai_live_turn_bindings
    where person_id = owner_id and session_id = p_session and conversation_id = p_conversation
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.ai_live_observe_item(uuid, uuid, text, text) from public, anon;
revoke all on function public.ai_live_bind_turn(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.ai_live_read_bindings(uuid, uuid) from public, anon;
grant execute on function public.ai_live_observe_item(uuid, uuid, text, text) to authenticated;
grant execute on function public.ai_live_bind_turn(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.ai_live_read_bindings(uuid, uuid) to authenticated;
