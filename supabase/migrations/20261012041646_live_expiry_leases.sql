-- Independent cleanup control plane; no ordinary user receives worker authority.
create schema if not exists live_private;
revoke all on schema live_private from public, anon, authenticated;
create table live_private.expiry_leases (
  session_id uuid primary key references public.ai_live_sessions(id) on delete cascade,
  token uuid not null,
  leased_until timestamptz not null,
  attempts integer not null default 1,
  confirmed_at timestamptz
);
alter table live_private.expiry_leases enable row level security;
revoke all on live_private.expiry_leases from public, anon, authenticated, service_role;
create index ai_live_expiry_pending on public.ai_live_sessions(expires_at,id)
where call_id is not null;

create function public.ai_live_claim_expired()
returns table(id uuid,person_id uuid,call_id text,call_tag text,expires_at timestamptz,lease_token uuid)
language plpgsql security definer set search_path='' as $$
begin
  return query
  with candidates as (
    select s.id from public.ai_live_sessions s
    left join live_private.expiry_leases l on l.session_id=s.id
    -- User-callable ai_live_end is not evidence of provider termination.
    where s.expires_at<=now() and s.call_id is not null and l.confirmed_at is null
    and (l.session_id is null or l.leased_until<=now())
    order by coalesce(l.attempts,0),s.expires_at,s.id limit 5 for update of s skip locked
  ), claimed as (
    insert into live_private.expiry_leases as existing(session_id,token,leased_until)
    select c.id,gen_random_uuid(),now()+interval '2 minutes' from candidates c
    on conflict(session_id) do update set token=excluded.token,
      leased_until=excluded.leased_until,attempts=existing.attempts+1
    returning session_id,token
  )
  select s.id,s.person_id,s.call_id,s.call_tag,s.expires_at,c.token
  from claimed c join public.ai_live_sessions s on s.id=c.session_id;
end $$;

create function public.ai_live_confirm_expired(p_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  -- Serialize with admission/end and require the current lease, never caller ownership.
  perform 1 from public.ai_live_sessions where id=p_id for update;
  update public.ai_live_sessions s set ended_at=coalesce(s.ended_at,now()),
    reason=coalesce(s.reason,'expired')
  where s.id=p_id and s.expires_at<=now() and exists(
    select 1 from live_private.expiry_leases l
    where l.session_id=s.id and l.token=p_token and l.leased_until>now());
  get diagnostics affected=row_count;
  if affected=1 then
    update live_private.expiry_leases set confirmed_at=coalesce(confirmed_at,now())
    where session_id=p_id and token=p_token;
  end if;
  return affected=1;
end $$;
revoke all on function public.ai_live_claim_expired(),public.ai_live_confirm_expired(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.ai_live_claim_expired(),public.ai_live_confirm_expired(uuid,uuid)
to service_role;
