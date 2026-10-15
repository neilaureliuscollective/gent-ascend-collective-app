-- Talk-owned durable receipts for Architect design-direction transfer. Hosted apply requires founder authorization.
-- Authenticated INSERT is revoked. imported=true requires a matching Architect destination acknowledgment.
create table public.ai_talk_direction_transfers (
  id uuid primary key,
  person_id uuid not null,
  conversation_id uuid not null,
  board_id uuid not null,
  board_version integer not null,
  direction_id text not null,
  direction_uuid uuid not null,
  project_id uuid not null,
  digest text not null,
  receipt jsonb not null,
  imported boolean not null default false,
  created_at timestamptz not null default now(),
  unique (person_id, id)
);
create index ai_talk_direction_transfers_board on public.ai_talk_direction_transfers (person_id, conversation_id, board_id);
alter table public.ai_talk_direction_transfers enable row level security;
create policy ai_talk_direction_transfers_owner on public.ai_talk_direction_transfers
  for select using (person_id = (select id from public.persons where auth_user_id = auth.uid()));
revoke all on public.ai_talk_direction_transfers from public, anon, authenticated;
grant select on public.ai_talk_direction_transfers to authenticated;

create or replace function public.ai_talk_record_direction_transfer(
  p_id uuid,
  p_conversation uuid,
  p_board uuid,
  p_version integer,
  p_direction text,
  p_direction_uuid uuid,
  p_project uuid,
  p_digest text,
  p_receipt jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  existing public.ai_talk_direction_transfers%rowtype;
  board public.ai_talk_creations%rowtype;
  acknowledged boolean := false;
begin
  select id into owner_id from public.persons where auth_user_id = auth.uid();
  if owner_id is null then raise exception 'unavailable'; end if;
  if p_id is null or p_conversation is null or p_board is null or p_project is null
    or p_version is null or p_version < 1 or p_version > 500
    or p_direction is null or p_direction !~ '^[a-z][a-z0-9-]{0,31}$'
    or p_direction_uuid is null
    or p_digest is null or p_digest !~ '^[0-9a-f]{64}$'
    or p_receipt is null then
    raise exception 'invalid direction transfer';
  end if;
  if not exists (
    select 1 from public.ai_conversations
    where id = p_conversation and person_id = owner_id and company_id is null
  ) then
    raise exception 'unavailable';
  end if;
  select * into board from public.ai_talk_creations
  where id = p_board and person_id = owner_id and conversation_id = p_conversation
    and kind = 'board' and version = p_version and not candidate;
  if not found then raise exception 'unavailable'; end if;
  if coalesce(board.content->>'selectedDirectionId', '') <> p_direction then
    raise exception 'unavailable';
  end if;
  if to_regclass('public.architect_design_directions') is not null then
    execute
      'select exists(
        select 1 from public.architect_design_directions
        where request_id = $1 and person_id = $2 and project_id = $3
          and digest = $4 and verified = true
      )'
      into acknowledged
      using p_id, owner_id, p_project, p_digest;
  end if;
  if acknowledged is not true then raise exception 'Architect acknowledgment missing'; end if;
  select * into existing from public.ai_talk_direction_transfers
  where id = p_id and person_id = owner_id;
  if found then
    if existing.conversation_id <> p_conversation
      or existing.board_id <> p_board
      or existing.board_version <> p_version
      or existing.direction_id <> p_direction
      or existing.project_id <> p_project
      or existing.digest <> p_digest then
      raise exception 'Transfer request reused with different inputs';
    end if;
    return jsonb_build_object(
      'id', existing.id,
      'projectId', existing.project_id,
      'digest', existing.digest,
      'imported', existing.imported,
      'recovered', true
    );
  end if;
  insert into public.ai_talk_direction_transfers (
    id, person_id, conversation_id, board_id, board_version, direction_id,
    direction_uuid, project_id, digest, receipt, imported
  ) values (
    p_id, owner_id, p_conversation, p_board, p_version, p_direction,
    p_direction_uuid, p_project, p_digest, p_receipt, true
  );
  return jsonb_build_object(
    'id', p_id,
    'projectId', p_project,
    'digest', p_digest,
    'imported', true,
    'recovered', false
  );
end;
$$;

revoke all on function public.ai_talk_record_direction_transfer(uuid, uuid, uuid, integer, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.ai_talk_record_direction_transfer(uuid, uuid, uuid, integer, text, uuid, uuid, text, jsonb) to authenticated;
