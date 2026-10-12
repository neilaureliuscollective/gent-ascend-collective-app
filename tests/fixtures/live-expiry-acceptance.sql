-- CI-only synthetic transaction, invoked exclusively with supabase db query --local.
begin;
do $$ begin
  if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000001'
    and email='founder@aurelius.test') then raise exception 'Synthetic local founder required'; end if;
end $$;
insert into public.ai_live_sessions(id,person_id,model,call_id,call_tag,expires_at,ended_at,reason,input_tokens)
select 'f1000000-0000-4000-8000-000000000001',id,'synthetic-no-provider',
 'rtc_synthetic_expiry',repeat('a',64),now()-interval '1 minute',now(),'ended',17
from public.persons where auth_user_id='00000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ declare claimed record; begin
 select * into strict claimed from public.ai_live_claim_expired()
 where id='f1000000-0000-4000-8000-000000000001';
 if exists(select 1 from public.ai_live_claim_expired()
   where id=claimed.id) then raise exception 'Duplicate lease'; end if;
 if public.ai_live_confirm_expired(claimed.id,'f3000000-0000-4000-8000-000000000001')
   then raise exception 'Invalid lease accepted'; end if;
 if not public.ai_live_confirm_expired(claimed.id,claimed.lease_token)
   then raise exception 'Valid lease rejected'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.ai_live_sessions where id='f1000000-0000-4000-8000-000000000001'
   and input_tokens=17 and reason='ended') then raise exception 'Usage/reason overwritten'; end if;
 if not exists(select 1 from live_private.expiry_leases where session_id='f1000000-0000-4000-8000-000000000001'
   and confirmed_at is not null) then raise exception 'Missing private receipt'; end if;
end $$;
rollback;
