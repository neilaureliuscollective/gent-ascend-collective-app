-- One prepared statement for Supabase CLI db query. CI-only, --local exclusively.
-- The inner subtransaction always rolls back synthetic writes on success.
do $$ declare claimed record; begin
  if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000001'
    and email='founder@aurelius.test') then raise exception 'Synthetic local founder required'; end if;
  begin
    insert into public.ai_live_sessions(id,person_id,model,call_id,call_tag,expires_at,ended_at,reason,input_tokens)
    select 'f1000000-0000-4000-8000-000000000001',id,'synthetic-no-provider',
      'rtc_synthetic_expiry',repeat('a',64),now()-interval '1 minute',now(),'ended',17
    from public.persons where auth_user_id='00000000-0000-4000-8000-000000000001';
    execute 'set local role service_role';
    select * into strict claimed from public.ai_live_claim_expired()
      where id='f1000000-0000-4000-8000-000000000001';
    if exists(select 1 from public.ai_live_claim_expired() where id=claimed.id)
      then raise exception 'Duplicate lease'; end if;
    if public.ai_live_confirm_expired(claimed.id,'f3000000-0000-4000-8000-000000000001')
      then raise exception 'Invalid lease accepted'; end if;
    if not public.ai_live_confirm_expired(claimed.id,claimed.lease_token)
      then raise exception 'Valid lease rejected'; end if;
    execute 'reset role';
    if not exists(select 1 from public.ai_live_sessions where id=claimed.id
      and input_tokens=17 and reason='ended') then raise exception 'Usage/reason overwritten'; end if;
    if not exists(select 1 from live_private.expiry_leases where session_id=claimed.id
      and confirmed_at is not null) then raise exception 'Missing private receipt'; end if;
    raise exception using errcode='ZX001', message='Synthetic expiry rollback';
  exception when sqlstate 'ZX001' then
    -- Only the success sentinel is caught. Assertion/database errors still fail CI.
    null;
  end;
  if exists(select 1 from public.ai_live_sessions where id='f1000000-0000-4000-8000-000000000001')
    or exists(select 1 from live_private.expiry_leases where session_id='f1000000-0000-4000-8000-000000000001')
    then raise exception 'Synthetic expiry data was not rolled back'; end if;
end $$;
