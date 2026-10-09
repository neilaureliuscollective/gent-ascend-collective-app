create schema if not exists business_private;
revoke all on schema business_private from public,anon,authenticated;
create table public.business_connections (
 id uuid primary key,person_id uuid not null references public.persons(id) on delete cascade,
 company_id uuid not null, status text not null check(status in ('pending','active','refreshing','reconnect','disconnected')),
 remote_subject text,provider_id text,provider_name text,timezone text,grant_id text,grant_expires_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(person_id,id),foreign key(person_id,company_id) references public.companies(person_id,id) on delete cascade
);
alter table public.business_connections enable row level security;
revoke all on public.business_connections from public,anon,authenticated;
grant select on public.business_connections to authenticated;
create policy business_connections_owner on public.business_connections for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create table business_private.credentials (
 connection_id uuid primary key references public.business_connections(id) on delete cascade,
 ciphertext text, lease uuid,lease_until timestamptz
);
alter table business_private.credentials enable row level security;
revoke all on business_private.credentials from public,anon,authenticated;
create table public.professional_access_grants (
 person_id uuid primary key references public.persons(id) on delete cascade,
 starts_at timestamptz not null,expires_at timestamptz not null,revoked_at timestamptz,
 terms_reference text not null check(length(terms_reference) between 1 and 300),
 check(expires_at>starts_at)
);
alter table public.professional_access_grants enable row level security;
revoke all on public.professional_access_grants from public,anon,authenticated;
grant select on public.professional_access_grants to authenticated;
create policy professional_grant_owner on public.professional_access_grants for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create table public.business_turn_sources (
 request_id uuid primary key,person_id uuid not null,connection_id uuid not null,snapshot jsonb not null,
 foreign key(person_id,request_id) references public.ai_turns(person_id,id) on delete cascade,
 foreign key(person_id,connection_id) references public.business_connections(person_id,id),
 check(octet_length(snapshot::text)<=24000)
);
alter table public.business_turn_sources enable row level security;
revoke all on public.business_turn_sources from public,anon,authenticated;
grant select on public.business_turn_sources to authenticated;
create policy business_source_owner on public.business_turn_sources for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create function public.business_begin(p_id uuid,p_company uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null or not exists(select 1 from public.companies where id=p_company and person_id=owner_id) then raise exception 'Company unavailable' using errcode='42501';end if;
 if (select count(*) from public.business_connections where person_id=owner_id and status<>'disconnected')>=10 then raise exception 'Connection limit' using errcode='P0001';end if;
 insert into public.business_connections(id,person_id,company_id,status) values(p_id,owner_id,p_company,'pending');
 insert into business_private.credentials(connection_id) values(p_id);
 return p_id;
end $$;
revoke all on function public.business_begin(uuid,uuid) from public,anon;
grant execute on function public.business_begin(uuid,uuid) to authenticated;
-- Only the server broker can access ciphertext, settle refreshes or write source receipts.
create function public.business_control(p_command text,p_person uuid,p_id uuid,p_lease uuid,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.business_connections;s business_private.credentials;
begin
 select * into c from public.business_connections where id=p_id and person_id=p_person for update;
 if not found then raise exception 'Connection unavailable' using errcode='42501';end if;
 select * into s from business_private.credentials where connection_id=p_id for update;
 if p_command='disconnect' then
  update public.business_connections set status='disconnected',updated_at=now() where id=p_id;
  delete from business_private.credentials where connection_id=p_id;
  return jsonb_build_object('ciphertext',s.ciphertext);
 end if;
 if c.status='disconnected' then raise exception 'Disconnected' using errcode='42501';end if;
 if p_command in ('exchange','refresh') then
  if p_lease is null or (s.lease_until>now()) then raise exception 'Request in progress' using errcode='55P03';end if;
  if p_command='exchange' and (c.status<>'pending' or c.created_at<now()-interval '10 minutes') then raise exception 'Expired connection' using errcode='42501';end if;
  -- An expired refresh lease is uncertain: reconnect, never repeat a rotated refresh token.
  if p_command='refresh' and c.status<>'active' then raise exception 'Reconnect required' using errcode='42501';end if;
  update business_private.credentials set lease=p_lease,lease_until=now()+interval '2 minutes' where connection_id=p_id;
  if p_command='refresh' then update public.business_connections set status='refreshing' where id=p_id;end if;
  return jsonb_build_object('ciphertext',s.ciphertext);
 elsif p_command='read' then
  if c.status<>'active' then raise exception 'Reconnect required' using errcode='42501';end if;
  return jsonb_build_object('ciphertext',s.ciphertext);
 elsif p_command='finish' then
  if p_lease is null or s.lease is null or s.lease_until is null or s.lease is distinct from p_lease or s.lease_until<=now() or p_payload->>'ciphertext' is null or length(p_payload->>'ciphertext')>24000 then raise exception 'Lease changed' using errcode='42501';end if;
  update business_private.credentials set ciphertext=p_payload->>'ciphertext',lease=null,lease_until=null where connection_id=p_id;
  update public.business_connections set status='active',remote_subject=p_payload->>'subject',provider_id=p_payload->>'providerId',provider_name=p_payload->>'providerName',timezone=p_payload->>'timezone',grant_id=p_payload->>'grantId',grant_expires_at=(p_payload->>'expiresAt')::timestamptz,updated_at=now() where id=p_id;
  return '{}'::jsonb;
 elsif p_command='fail' then
  if s.lease is distinct from p_lease then raise exception 'Lease changed' using errcode='42501';end if;
  update business_private.credentials set ciphertext=null,lease=null,lease_until=null where connection_id=p_id;
  update public.business_connections set status='reconnect',updated_at=now() where id=p_id;
  return '{}'::jsonb;
 elsif p_command='source' then
  if c.status<>'active' or not exists(select 1 from public.ai_turns t join public.ai_conversations v on v.id=t.conversation_id where t.id=(p_payload->>'requestId')::uuid and t.person_id=p_person and v.company_id=c.company_id and t.status='pending') then raise exception 'Turn unavailable' using errcode='42501';end if;
  insert into public.business_turn_sources(request_id,person_id,connection_id,snapshot) values((p_payload->>'requestId')::uuid,p_person,p_id,p_payload->'snapshot');
  return '{}'::jsonb;
 end if;
 raise exception 'Unsupported control command' using errcode='22023';
end $$;
revoke all on function public.business_control(text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.business_control(text,uuid,uuid,uuid,jsonb) to service_role;
