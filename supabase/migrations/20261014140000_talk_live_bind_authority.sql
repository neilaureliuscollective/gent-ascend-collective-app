-- Additive: authenticated callers cannot observe an item and then bind it.
-- Binding is one server-owned RPC that requires a completed durable turn on the
-- owner session/conversation. Hosted apply still requires founder authorization.
revoke all on function public.ai_live_observe_item(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.ai_live_bind_turn(uuid, uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.ai_live_bind_finished_turn(
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
    where id = p_turn
      and person_id = owner_id
      and conversation_id = p_conversation
      and status = 'complete'
      and finished_at is not null
  ) then
    raise exception 'unavailable';
  end if;
  insert into public.ai_live_observed_items (
    person_id, session_id, conversation_id, provider_item_id, provider_response_id
  ) values (owner_id, p_session, p_conversation, btrim(p_item), nullif(btrim(p_response), ''))
  on conflict (person_id, session_id, provider_item_id) do nothing;
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

revoke all on function public.ai_live_bind_finished_turn(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.ai_live_bind_finished_turn(uuid, uuid, text, text, uuid) to authenticated;
