-- Billing provider control is service-only. Account reads remain session-bound and owner-scoped.
alter table public.membership_accounts drop constraint membership_accounts_tier_check;
alter table public.membership_accounts add constraint membership_accounts_tier_check
 check(tier in ('free','aurelius','health','essential','signature','reserve'));

create table public.billing_profiles (
 person_id uuid primary key references public.persons(id) on delete cascade,
 customer_id text unique,
 subscription_id text unique,
 paid_tier text check(paid_tier in ('essential','signature','reserve')),
 provider_status text not null default 'none',
 billing_state text not null default 'none' check(billing_state in ('none','trialing','active','past_due','canceled','unpaid','incomplete','paused')),
 access_until timestamptz,
 cancel_at_period_end boolean not null default false,
 synchronized_at timestamptz,
 payment_hold boolean not null default false
);
create table public.billing_controls (
 person_id uuid primary key references public.billing_profiles(person_id) on delete cascade,
 lease_token uuid,
 lease_until timestamptz,
 attempt jsonb,
 holds jsonb not null default '{}'
);
create table public.billing_event_receipts (
 event_id text primary key,
 person_id uuid not null references public.billing_profiles(person_id) on delete cascade,
 processed_at timestamptz not null default now()
);
create table public.billing_enrollment_receipts (
 attempt_id uuid primary key,
 person_id uuid not null references public.billing_profiles(person_id) on delete cascade,
 tier text not null check(tier in ('essential','signature','reserve')),
 price_id text not null,
 terms_version text not null,
 terms_text text not null,
 accepted_at timestamptz not null
);
create index billing_events_person_time on public.billing_event_receipts(person_id,processed_at desc);
create index billing_enrollments_person_time on public.billing_enrollment_receipts(person_id,accepted_at desc);
alter table public.billing_enrollment_receipts enable row level security;
revoke all on public.billing_enrollment_receipts from public,anon,authenticated;
grant all on public.billing_enrollment_receipts to service_role;
alter table public.billing_profiles enable row level security;
alter table public.billing_controls enable row level security;
alter table public.billing_event_receipts enable row level security;
revoke all on public.billing_profiles,public.billing_controls,public.billing_event_receipts from public,anon,authenticated;
grant select on public.billing_profiles to authenticated;
grant all on public.billing_profiles,public.billing_controls,public.billing_event_receipts to service_role;
create policy billing_owner_read on public.billing_profiles for select to authenticated
 using(exists(select 1 from public.persons where id=person_id and auth_user_id=(select auth.uid())));

-- One narrow command surface; no general service-role private-data reader.
create function public.billing_control(p_command text,p_person uuid default null,p_token uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare profile public.billing_profiles; control public.billing_controls; inserted text; current_hold boolean;
begin
 if p_command='lookup' then
  select * into profile from public.billing_profiles where customer_id=p_payload->>'customer';
  if not found then return null; end if;
  return jsonb_build_object('person',profile.person_id);
 end if;
 if p_command='acquire' then
  if p_token is null then raise exception 'Billing token required'; end if;
  insert into public.billing_profiles(person_id) values(p_person) on conflict do nothing;
  insert into public.billing_controls(person_id) values(p_person) on conflict do nothing;
  select * into control from public.billing_controls where person_id=p_person for update;
  if control.lease_until>now() then raise exception 'Billing busy' using errcode='55P03'; end if;
  update public.billing_controls set lease_token=p_token,lease_until=now()+interval '2 minutes' where person_id=p_person;
  select * into profile from public.billing_profiles where person_id=p_person;
  return jsonb_build_object('profile',to_jsonb(profile),'attempt',control.attempt,'holds',control.holds);
 end if;
 select * into control from public.billing_controls where person_id=p_person for update;
 if not found or p_token is null or control.lease_token is null or control.lease_until is null or control.lease_token is distinct from p_token or control.lease_until<=now() then
  raise exception 'Billing lease expired' using errcode='55P03';
 end if;
 if p_command='release' then
  update public.billing_controls set lease_token=null,lease_until=null where person_id=p_person;
 elsif p_command='bind' then
  if (p_payload->>'customer') !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid customer'; end if;
  update public.billing_profiles set customer_id=p_payload->>'customer' where person_id=p_person and (customer_id is null or customer_id=p_payload->>'customer');
  if not found then raise exception 'Customer already bound'; end if;
 elsif p_command='reserve' then
  insert into public.billing_enrollment_receipts(attempt_id,person_id,tier,price_id,terms_version,terms_text,accepted_at)
   values((p_payload->>'id')::uuid,p_person,p_payload->>'tier',p_payload->>'price',p_payload->>'terms',p_payload->>'termsText',to_timestamp((p_payload->>'created')::double precision)) on conflict do nothing;
  update public.billing_controls set attempt=p_payload where person_id=p_person;
 elsif p_command='sync' then
  if p_payload->>'event' is not null then
   insert into public.billing_event_receipts(event_id,person_id) values(p_payload->>'event',p_person) on conflict do nothing returning event_id into inserted;
   if inserted is null then return jsonb_build_object('duplicate',true); end if;
  end if;
  if p_payload->>'holdKey' is not null then
   update public.billing_controls set holds=jsonb_set(holds,array[p_payload->>'holdKey'],to_jsonb((p_payload->>'holdValue')::boolean),true) where person_id=p_person;
  end if;
  select exists(select 1 from jsonb_each((select holds from public.billing_controls where person_id=p_person)) where value='true'::jsonb) into current_hold;
  if current_hold is distinct from (p_payload->>'hold')::boolean then raise exception 'Billing hold mismatch'; end if;
  update public.billing_profiles set
   subscription_id=p_payload->>'subscription',paid_tier=p_payload->>'tier',
   provider_status=p_payload->>'status',billing_state=p_payload->>'billing',
   access_until=(p_payload->>'until')::timestamptz,cancel_at_period_end=(p_payload->>'cancel')::boolean,
   payment_hold=current_hold,synchronized_at=now() where person_id=p_person;
  update public.membership_accounts set tier=coalesce(p_payload->>'tier','free'),billing_state=p_payload->>'billing',
   access_until=(p_payload->>'until')::timestamptz,trial_ends_at=null,updated_at=now() where person_id=p_person;
  -- beta_access and person-bound founder grants are deliberately untouched.
 else raise exception 'Unknown billing command'; end if;
 return '{}'::jsonb;
end;
$$;
revoke all on function public.billing_control(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.billing_control(text,uuid,uuid,jsonb) to service_role;
