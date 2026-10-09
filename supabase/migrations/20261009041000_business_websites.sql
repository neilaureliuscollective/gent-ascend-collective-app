ALTER TABLE public.business_connections ADD COLUMN permissions text[] NOT NULL DEFAULT ARRAY['bookings.read']::text[] CHECK(permissions <@ ARRAY['bookings.read','website.read','website.propose']::text[]);
create or replace function public.business_control(p_command text,p_person uuid,p_id uuid,p_lease uuid,p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  update public.business_connections set status='active',permissions=ARRAY(select jsonb_array_elements_text(p_payload->'permissions')),remote_subject=p_payload->>'subject',provider_id=p_payload->>'providerId',provider_name=p_payload->>'providerName',timezone=p_payload->>'timezone',grant_id=p_payload->>'grantId',grant_expires_at=(p_payload->>'expiresAt')::timestamptz,updated_at=now() where id=p_id;
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
