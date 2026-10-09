-- Additive Public Aethelios-only spend reservations. No grants, prices or allowances
-- are invented here. Reviewed administrative configuration is required to enable.
create schema if not exists aethelios_budget;
revoke all on schema aethelios_budget from public,anon,authenticated;
create table aethelios_budget.policy (
 id boolean primary key default true check(id), enabled boolean not null default false,
 daily_project_microusd bigint check(daily_project_microusd>0),
 daily_person_microusd bigint check(daily_person_microusd>0)
);
insert into aethelios_budget.policy(id) values(true);
create table aethelios_budget.ceilings (
 model text not null, family text not null check(family in ('text','research','vision','image')),
 microusd bigint not null check(microusd>0),
 max_input_bytes integer not null check(max_input_bytes between 1 and 16777216),
 max_output_tokens integer not null check(max_output_tokens between 1 and 16384),
 max_tool_calls integer not null check(max_tool_calls between 0 and 8),
 primary key(model,family)
);
create table public.ai_provider_reservations (
 id uuid primary key, person_id uuid not null references public.persons(id) on delete cascade,
 created_at timestamptz not null default now(), model text not null,
 family text not null, reserved_microusd bigint not null check(reserved_microusd>0),
 http_status integer check(http_status between 100 and 599)
);
create index ai_provider_reservations_time on public.ai_provider_reservations(created_at);
create index ai_provider_reservations_owner_time on public.ai_provider_reservations(person_id,created_at);
alter table public.ai_provider_reservations enable row level security;
revoke all on public.ai_provider_reservations from public,anon,authenticated;
grant select on public.ai_provider_reservations to authenticated;
create policy ai_provider_reservations_owner on public.ai_provider_reservations
 for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.ai_budget_reserve(p_id uuid,p_model text,p_family text,p_input_bytes integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; config aethelios_budget.policy; ceiling aethelios_budget.ceilings;
 day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid());
 if owner_id is null or not exists(
  select 1 from public.membership_accounts m where m.person_id=owner_id and (
   m.beta_access or exists(select 1 from public.founder_access f where f.person_id=owner_id) or
   (m.tier<>'free' and ((m.billing_state in ('active','canceled') and m.access_until>now()) or
    (m.billing_state='trialing' and m.trial_ends_at>now())))
  )) then raise exception 'Intelligence access required' using errcode='42501'; end if;
 if p_id is null or p_model is null or p_family is null or p_input_bytes is null or p_input_bytes<1 then
  raise exception 'Invalid reservation' using errcode='22023'; end if;
 -- Serialize all reservations against the same project allowance, including retries.
 perform pg_advisory_xact_lock(hashtextextended('public-aethelios-provider-budget',0));
 select * into config from aethelios_budget.policy where id=true;
 select * into ceiling from aethelios_budget.ceilings where model=p_model and family=p_family;
 if not coalesce(config.enabled,false) or config.daily_project_microusd is null or config.daily_person_microusd is null
 or ceiling.microusd is null then raise exception 'Provider budget is not configured' using errcode='P0001'; end if;
 if p_input_bytes>ceiling.max_input_bytes then raise exception 'Provider input limit' using errcode='22023'; end if;
 if (select coalesce(sum(reserved_microusd),0) from public.ai_provider_reservations where created_at>=day_start)+ceiling.microusd>config.daily_project_microusd
 or (select coalesce(sum(reserved_microusd),0) from public.ai_provider_reservations where created_at>=day_start and person_id=owner_id)+ceiling.microusd>config.daily_person_microusd then
  raise exception 'Provider allowance reached' using errcode='P0001'; end if;
 insert into public.ai_provider_reservations(id,person_id,model,family,reserved_microusd)
 values(p_id,owner_id,p_model,p_family,ceiling.microusd);
 return jsonb_build_object('maxOutputTokens',ceiling.max_output_tokens,'maxToolCalls',ceiling.max_tool_calls);
end $$;
create function public.ai_budget_receipt(p_id uuid,p_status integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 update public.ai_provider_reservations set http_status=p_status where id=p_id and http_status is null
 and person_id in(select id from public.persons where auth_user_id=(select auth.uid()));
 get diagnostics changed=row_count; return changed=1;
end $$;
revoke all on function public.ai_budget_reserve(uuid,text,text,integer),public.ai_budget_receipt(uuid,integer) from public,anon;
grant execute on function public.ai_budget_reserve(uuid,text,text,integer),public.ai_budget_receipt(uuid,integer) to authenticated;
-- HTTP acceptance is not completion or actual billed spend. Full ceilings remain
-- charged against the allowance on failures/unknown outcomes. No automatic refunds.
