-- Additive Health foundation. Private schema; no hosted activation implied.
create schema health_private;
revoke all on schema health_private from public,anon,service_role;
grant usage on schema health_private to authenticated;
create table health_private.activation (id boolean primary key default true check(id), ingestion boolean not null default false, ai boolean not null default false);
insert into health_private.activation(id) values(true);
alter table health_private.activation enable row level security;
revoke all on health_private.activation from public,anon,authenticated,service_role;
create table health_private.consents (
 person_id uuid not null references public.persons(id), purpose text not null check(purpose in ('wellness','records','ai')),
 granted boolean not null, adult boolean not null default false, version integer not null default 1,
 policy_version text not null default 'health-2026-10-v1', updated_at timestamptz not null default now(), primary key(person_id,purpose)
);
create table health_private.records (
 id uuid primary key, person_id uuid not null references public.persons(id), title text not null check(length(title) between 1 and 120),
 path text not null unique, mime text not null check(mime in ('application/pdf','image/jpeg','image/png','text/csv','application/json')),
 size integer not null check(size between 1 and 8388608), hash text,
 status text not null default 'reserved' check(status in ('reserved','review_required','confirmed','unsupported','failed','deleting')),
 version integer not null default 1, candidates jsonb not null default '[]', created_at timestamptz not null default now(),
 unique(person_id,id), check(jsonb_typeof(candidates)='array' and jsonb_array_length(candidates)<=100)
);
create unique index health_content_duplicate on health_private.records(person_id,hash) where hash is not null and status<>'deleting';
create index health_records_owner_date on health_private.records(person_id,created_at desc);
create table health_private.observations (
 id uuid primary key, person_id uuid not null, record_id uuid not null,
 data jsonb not null, status text not null default 'active' check(status in ('active','excluded')),
 version integer not null default 1, confirmed_at timestamptz not null default now(),
 foreign key(person_id,record_id) references health_private.records(person_id,id) on delete cascade,
 unique(person_id,id)
);
create index health_observations_owner_record on health_private.observations(person_id,record_id);
create table health_private.revisions (
 id bigint generated always as identity primary key, person_id uuid not null, observation_id uuid not null,
 data jsonb not null, version integer not null, reason text not null, amended_at timestamptz not null default now(),
 foreign key(person_id,observation_id) references health_private.observations(person_id,id) on delete cascade
);
create index health_revisions_owner on health_private.revisions(person_id,observation_id);
create table health_private.tombstones (
 person_id uuid not null references public.persons(id),record_id uuid not null,deleted_at timestamptz not null default now(),primary key(person_id,record_id)
);
create table health_private.jobs (
 id uuid primary key, person_id uuid not null references public.persons(id), kind text not null check(kind in ('delete','export')),
 record_id uuid, status text not null default 'pending' check(status in ('pending','running','complete','failed')),
 lease uuid, lease_until timestamptz, created_at timestamptz not null default now()
);
create index health_jobs_owner on health_private.jobs(person_id,created_at desc);
create table health_private.turns (
 id uuid primary key, person_id uuid not null references public.persons(id), question text not null,
 answer text not null default '', status text not null default 'pending' check(status in ('pending','complete','failed')),
 evidence jsonb not null, snapshot jsonb not null, consent_version integer not null,
 created_at timestamptz not null default now()
);
create index health_turns_owner on health_private.turns(person_id,created_at desc);
-- Scalar quota reservations contain no questions, measurements or record IDs.
create table health_private.usage (
 person_id uuid not null references public.persons(id),request uuid not null,created_at timestamptz not null default now(),primary key(person_id,request)
);
create index health_usage_owner_date on health_private.usage(person_id,created_at desc);
create table health_private.receipts (
 person_id uuid not null references public.persons(id), request uuid not null, kind text not null,
 payload jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(person_id,request)
);
-- All direct writes denied. Invoker reads remain protected by RLS.
do $$ declare t text; begin
 foreach t in array array['consents','records','observations','revisions','jobs','turns','receipts','tombstones','usage'] loop
 execute format('alter table health_private.%I enable row level security',t);
 execute format('revoke all on health_private.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on health_private.%I to authenticated',t);
 execute format('create policy health_owner on health_private.%I for select to authenticated using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())))',t);
 end loop; end $$;
revoke all on all sequences in schema health_private from public,anon,authenticated,service_role;
create function health_private.owner() returns uuid language sql stable security invoker set search_path='' as $$
 select id from public.persons where auth_user_id=(select auth.uid())
$$;
create function health_private.validate_observation(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
 declare k text; begin
 if jsonb_typeof(d)<>'object' or not(d ?& array['id','name','value','unit','date','code','specimen','method','range','flag']) then return false; end if;
 for k in select jsonb_object_keys(d) loop
 if not(k=any(array['id','name','value','unit','date','code','specimen','method','range','flag'])) or jsonb_typeof(d->k)<>'string' then return false; end if;
 end loop;
 perform (d->>'id')::uuid;
 if (d->>'date') !~ '^\d{4}-\d{2}-\d{2}$' or (d->>'date')::date > current_date+1 then return false; end if;
 return length(d->>'name') between 1 and 120 and length(d->>'value') between 1 and 100 and length(d->>'unit')<=30
 and length(d->>'code')<=40 and length(d->>'specimen')<=80 and length(d->>'method')<=100 and length(d->>'range')<=100 and length(d->>'flag')<=40;
 exception when others then return false; end $$;
create function health_private.release_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ingestion',ingestion and eligible,'ai',ai and eligible)
 from health_private.activation cross join lateral (
 select exists(select 1 from public.persons p where p.auth_user_id=auth.uid() and
 (exists(select 1 from public.founder_access f where f.person_id=p.id) or exists(select 1 from public.membership_accounts m where m.person_id=p.id and m.beta_access))) as eligible
 ) permission where id and auth.uid() is not null
$$;
create function public.health_export_history() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revisions',coalesce((select jsonb_agg(to_jsonb(r)-'person_id') from health_private.revisions r),'[]'),
 'deletionTombstones',coalesce((select jsonb_agg(to_jsonb(d)-'person_id') from health_private.tombstones d),'[]'),
 'conversations',coalesce((select jsonb_agg(to_jsonb(t)-'person_id'-'snapshot') from health_private.turns t),'[]'),
 'quotaReservations',coalesce((select jsonb_agg(to_jsonb(u)-'person_id') from health_private.usage u),'[]'),
 'processing',coalesce((select jsonb_agg(jsonb_build_object('request',request,'kind',kind,'created_at',created_at)) from health_private.receipts),'[]')) where auth.uid() is not null
$$;
revoke all on function public.health_export_history() from public,anon,service_role;
grant execute on function public.health_export_history() to authenticated;
create function public.health_read() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'activation',health_private.release_status(),
 'consents',coalesce((select jsonb_agg(to_jsonb(c)-'person_id') from health_private.consents c),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(to_jsonb(r)-'person_id' order by created_at desc) from health_private.records r),'[]'::jsonb),
 'observations',coalesce((select jsonb_agg(o.data || jsonb_build_object('record_id',o.record_id,'version',o.version,'status',o.status,'confirmed_at',o.confirmed_at)) from health_private.observations o join health_private.records source_record on source_record.id=o.record_id where source_record.status<>'deleting'),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(to_jsonb(j)-'person_id'-'lease'-'lease_until') from health_private.jobs j),'[]'::jsonb),
 'turns',coalesce((select jsonb_agg(to_jsonb(t)-'person_id'-'snapshot' order by created_at) from (select * from health_private.turns order by created_at desc limit 40) t),'[]'::jsonb)
 ) where (select auth.uid()) is not null
$$;
create function health_private.mutate(p_kind text,p_request uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare own uuid; r health_private.records; j health_private.jobs; t health_private.turns;
 existing health_private.receipts; result jsonb:='{}'; item jsonb; rid uuid; cv integer; lease_id uuid;
 begin
 select id into own from public.persons where auth_user_id=auth.uid() for update;
 if own is null then raise exception 'Health authentication required' using errcode='42501'; end if;
 if p_kind in ('delete','export','claim') or (p_kind='consent' and p->>'purpose' in ('records','ai') and (p->>'granted')::boolean) then
 if not exists(select 1 from auth.users where id=auth.uid() and last_sign_in_at>now()-interval '15 minutes') then raise exception 'Recent Health authentication required' using errcode='42501'; end if;
 end if;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid Health payload'; end if;
 if pg_column_size(p)>250000 then raise exception 'Health request too large'; end if;
 if p_kind='delete' then
 select * into j from health_private.jobs where id=p_request and person_id=own;
 if found then
 if j.kind<>'delete' or j.record_id is distinct from nullif(p->>'id','')::uuid then raise exception 'Health request changed' using errcode='40001'; end if;
 return jsonb_build_object('id',j.id); end if; end if;
 select * into existing from health_private.receipts where person_id=own and request=p_request;
 if found then
 if existing.kind<>p_kind or existing.payload<>p then raise exception 'Health request changed' using errcode='40001'; end if;
 if p_kind='ask_begin' then raise exception 'Health explanation already started' using errcode='40001'; end if;
 return existing.result; end if;
 if (select count(*) from health_private.receipts where person_id=own and created_at>now()-interval '1 day')>1000 then raise exception 'Health daily limit'; end if;
 if p_kind='consent' then
 if p->>'purpose' not in ('wellness','records','ai') or jsonb_typeof(p->'granted')<>'boolean' or jsonb_typeof(p->'adult')<>'boolean' then raise exception 'Invalid consent'; end if;
 if (p->>'granted')::boolean and p->>'purpose' in ('records','ai') and not (health_private.release_status()->>case when p->>'purpose'='records' then 'ingestion' else 'ai' end)::boolean then raise exception 'Health beta capability is not activated' using errcode='42501'; end if;
 if (p->>'granted')::boolean and not (p->>'adult')::boolean then raise exception 'Adult consent required'; end if;
 insert into health_private.consents(person_id,purpose,granted,adult) values(own,p->>'purpose',(p->>'granted')::boolean,(p->>'adult')::boolean)
 on conflict(person_id,purpose) do update set granted=excluded.granted,adult=excluded.adult,version=health_private.consents.version+1,updated_at=now();
 if p->>'purpose'='records' and not(p->>'granted')::boolean then update health_private.consents set granted=false,version=version+1,updated_at=now() where person_id=own and purpose='ai'; end if;
 if p->>'purpose' in ('ai','records') and not(p->>'granted')::boolean then update health_private.turns set status='failed',answer='' where person_id=own and status='pending'; end if;
 elsif p_kind in ('reserve','finalize','confirm','amend') then
 if not exists(select 1 from health_private.consents where person_id=own and purpose='records' and granted and adult) then raise exception 'Records consent required' using errcode='42501'; end if;
 if not (health_private.release_status()->>'ingestion')::boolean then raise exception 'Health ingestion is not activated' using errcode='42501'; end if;
 if p_kind='reserve' then
 if exists(select 1 from health_private.tombstones where person_id=own and record_id=(p->>'id')::uuid) then raise exception 'Deleted record cannot be restored'; end if;
 if (select count(*) from health_private.records where person_id=own)>=200 or (select coalesce(sum(size),0) from health_private.records where person_id=own)+(p->>'size')::integer>52428800 then raise exception 'Health vault limit'; end if;
 rid:=(p->>'id')::uuid;
 insert into health_private.records(id,person_id,title,path,mime,size) values(rid,own,p->>'title',auth.uid()::text||'/'||rid::text||'/original',p->>'mime',(p->>'size')::integer) returning * into r;
 result:=to_jsonb(r)-'person_id';
 else
 if p_kind='amend' then
 select record_id into rid from health_private.observations where id=(p->>'id')::uuid and person_id=own;
 else rid:=(p->>'id')::uuid; end if;
 select * into r from health_private.records where id=rid and person_id=own for update;
 if not found or r.status='deleting' then raise exception 'Health record not found' using errcode='42501'; end if;
 if jsonb_typeof(p->'expected') is distinct from 'number' or (p->>'expected')::integer<1 then raise exception 'Expected version required'; end if;
 if p_kind='finalize' then
 if r.status<>'reserved' or r.version<>(p->>'expected')::integer or p->>'hash' !~ '^[a-f0-9]{64}$' or p->>'status' not in ('review_required','unsupported','failed') then raise exception 'Health record changed' using errcode='40001'; end if;
 if jsonb_typeof(p->'candidates') is distinct from 'array' or jsonb_array_length(p->'candidates')>100 then raise exception 'Invalid candidates'; end if;
 for item in select value from jsonb_array_elements(p->'candidates') loop if not health_private.validate_observation(item) then raise exception 'Invalid observation'; end if; end loop;
 update health_private.records set status=p->>'status',hash=p->>'hash',candidates=p->'candidates',version=version+1 where id=r.id;
 elsif p_kind='confirm' then
 if r.status<>'review_required' or r.version<>(p->>'expected')::integer then raise exception 'Health record changed' using errcode='40001'; end if;
 if jsonb_typeof(p->'observations') is distinct from 'array' or jsonb_array_length(p->'observations') not between 1 and 100 then raise exception 'Invalid observations'; end if;
 if (select count(*) from health_private.observations where person_id=own)+jsonb_array_length(p->'observations')>2000 then raise exception 'Observation limit'; end if;
 for item in select value from jsonb_array_elements(p->'observations') loop
 if not health_private.validate_observation(item) then raise exception 'Invalid observation'; end if;
 insert into health_private.observations(id,person_id,record_id,data) values((item->>'id')::uuid,own,r.id,item);
 end loop;
 update health_private.records set status='confirmed',version=version+1,candidates='[]' where id=r.id;
 else
 item:=p->'observation';
 if not health_private.validate_observation(item) or item->>'id'<>p->>'id' or length(p->>'reason') not between 3 and 300 then raise exception 'Invalid amendment'; end if;
 insert into health_private.revisions(person_id,observation_id,data,version,reason)
 select own,id,data,version,p->>'reason' from health_private.observations where id=(p->>'id')::uuid and person_id=own and version=(p->>'expected')::integer;
 if not found then raise exception 'Health observation changed' using errcode='40001'; end if;
 update health_private.observations set data=item,status=case when (p->>'excluded')::boolean then 'excluded' else 'active' end,version=version+1 where id=(p->>'id')::uuid and person_id=own;
 update health_private.turns set status='failed',answer='' where person_id=own and evidence ? (p->>'id');
 end if; end if;
 elsif p_kind='delete' then
 rid:=nullif(p->>'id','')::uuid;
 if rid is not null and not exists(select 1 from health_private.records where id=rid and person_id=own) then raise exception 'Health record not found' using errcode='42501'; end if;
 insert into health_private.tombstones(person_id,record_id) select own,id from health_private.records where person_id=own and (rid is null or id=rid) on conflict do nothing;
 update health_private.records set status='deleting',version=version+1 where person_id=own and (rid is null or id=rid);
 update health_private.turns set status='failed',answer='' where person_id=own;
 if rid is null then update health_private.consents set granted=false,version=version+1,updated_at=now() where person_id=own; end if;
 insert into health_private.jobs(id,person_id,kind,record_id) values(p_request,own,'delete',rid);
 result:=jsonb_build_object('id',p_request);
 elsif p_kind='export' then
 insert into health_private.jobs(id,person_id,kind) values(p_request,own,'export'); result:=jsonb_build_object('id',p_request);
 elsif p_kind='claim' then
 select * into j from health_private.jobs where id=(p->>'id')::uuid and person_id=own for update;
 if not found or (j.status='complete' and j.kind='delete') or (j.status='running' and j.lease_until>now()) then raise exception 'Health job unavailable' using errcode='40001'; end if;
 lease_id:=gen_random_uuid(); update health_private.jobs set status='running',lease=lease_id,lease_until=now()+interval '2 minutes' where id=j.id;
 result:=jsonb_build_object('lease',lease_id,'kind',j.kind,'record_id',j.record_id);
 elsif p_kind='renew_job' then
 update health_private.jobs set lease_until=now()+interval '2 minutes' where id=(p->>'id')::uuid and person_id=own and lease=(p->>'lease')::uuid and status='running' and lease_until>now();
 if not found then raise exception 'Health job lease changed' using errcode='40001'; end if;
 elsif p_kind='finish_job' then
 select * into j from health_private.jobs where id=(p->>'id')::uuid and person_id=own and lease=(p->>'lease')::uuid and status='running' and lease_until>now() for update;
 if not found then raise exception 'Health job lease changed' using errcode='40001'; end if;
 if j.kind='delete' then
 if exists(select 1 from storage.objects s join health_private.records source_record on source_record.path=s.name where s.bucket_id='aethelios-health' and source_record.person_id=own and (j.record_id is null or source_record.id=j.record_id)) then raise exception 'Health originals still pending deletion'; end if;
 delete from health_private.records where person_id=own and (j.record_id is null or id=j.record_id);
 delete from health_private.turns where person_id=own;
 -- Remove sensitive retry payloads; retain only this opaque job/tombstone.
 delete from health_private.receipts where person_id=own;
 end if;
 update health_private.jobs set status='complete',lease=null,lease_until=null where id=j.id;
 elsif p_kind='ask_begin' then
 if not (health_private.release_status()->>'ai')::boolean then raise exception 'Health AI is not activated' using errcode='42501'; end if;
 select version into cv from health_private.consents where person_id=own and purpose='ai' and granted and adult;
 if cv is null or cv<>(p->>'consentVersion')::integer or length(p->>'question') not between 3 and 3000 or jsonb_typeof(p->'evidence') is distinct from 'array' or jsonb_array_length(p->'evidence')>12 then raise exception 'Health AI consent changed' using errcode='42501'; end if;
 if (select count(*) from health_private.usage where person_id=own and created_at>now()-interval '1 day')>=10 then raise exception 'Health explanation daily limit'; end if;
 result:='[]';
 for item in select value from jsonb_array_elements(p->'evidence') loop
 select to_jsonb(o) into result from health_private.observations o join health_private.records source_record on source_record.id=o.record_id where o.id=(item#>>'{}')::uuid and o.person_id=own and o.status='active' and source_record.status='confirmed';
 if result is null then raise exception 'Health evidence unavailable' using errcode='42501'; end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(o)),'[]') into result from health_private.observations o where o.person_id=own and p->'evidence' ? o.id::text;
 delete from health_private.usage where person_id=own and created_at<now()-interval '30 days';
 insert into health_private.usage(person_id,request) values(own,p_request);
 insert into health_private.turns(id,person_id,question,evidence,snapshot,consent_version) values(p_request,own,p->>'question',p->'evidence',result,cv);
 elsif p_kind='ask_finish' then
 select * into t from health_private.turns where id=(p->>'id')::uuid and person_id=own for update;
 if not found or t.status<>'pending' then raise exception 'Health explanation unavailable' using errcode='40001'; end if;
 if not exists(select 1 from health_private.consents where person_id=own and purpose='ai' and granted and version=t.consent_version) or exists(select 1 from jsonb_array_elements(t.snapshot) e where not exists(select 1 from health_private.observations o join health_private.records source_record on source_record.id=o.record_id where o.id=(e->>'id')::uuid and o.version=(e->>'version')::integer and o.status='active' and source_record.status='confirmed')) then
 update health_private.turns set status='failed',answer='' where id=t.id;
 else update health_private.turns set status=case when p->>'status'='complete' then 'complete' else 'failed' end,answer=left(coalesce(p->>'answer',''),12000) where id=t.id; end if;
 else raise exception 'Unsupported Health operation'; end if;
 insert into health_private.receipts(person_id,request,kind,payload,result) values(own,p_request,p_kind,p,result);
 return result;
 end $$;
create function public.health_mutate(p_kind text,p_request uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$
 select health_private.mutate(p_kind,p_request,p_payload)
$$;
create function health_private.storage_allowed(object_name text,operation text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from health_private.records r where r.path=object_name and r.person_id=health_private.owner()
 and case operation when 'insert' then (health_private.release_status()->>'ingestion')::boolean and r.status='reserved' and exists(select 1 from health_private.consents where purpose='records' and granted and person_id=r.person_id)
 when 'delete' then r.status='deleting' else true end)
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('aethelios-health','aethelios-health',false,8388608,array['application/pdf','image/jpeg','image/png','text/csv','application/json']);
create policy health_original_insert on storage.objects for insert to authenticated with check(bucket_id='aethelios-health' and health_private.storage_allowed(name,'insert'));
create policy health_original_read on storage.objects for select to authenticated using(bucket_id='aethelios-health' and health_private.storage_allowed(name,'read'));
create policy health_original_delete on storage.objects for delete to authenticated using(bucket_id='aethelios-health' and health_private.storage_allowed(name,'delete'));
-- No UPDATE/upsert: originals are immutable.
revoke all on all functions in schema health_private from public,anon,service_role;
grant execute on all functions in schema health_private to authenticated;
revoke all on function public.health_read(),public.health_mutate(text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.health_read(),public.health_mutate(text,uuid,jsonb) to authenticated;
