-- Additive Stage 2A migration. Developer identities remain confined to seeds.
alter table public.persons
 add column unit_system text not null default 'imperial' check(unit_system in ('imperial','metric')),
 add column priority text not null default '' check(length(priority) <= 280),
 add column version integer not null default 1 check(version > 0),
 add column updated_at timestamptz not null default now();
alter table public.persons add constraint person_name_not_blank check(length(btrim(display_name)) > 0);
grant update(unit_system,priority) on public.persons to authenticated;

create function public.validate_person_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
  raise exception 'Invalid timezone' using errcode = '23514';
 end if;
 if tg_op = 'UPDATE' then
  new.version := old.version + 1;
  new.updated_at := now();
 end if;
 return new;
end;
$$;
revoke all on function public.validate_person_update() from public,anon,authenticated;
create trigger person_validate before insert or update on public.persons for each row execute function public.validate_person_update();

create table public.goals (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.persons(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 domain text not null check(domain in ('body','mind','life')),
 reason text not null default '' check(length(reason) <= 600),
 next_step text not null check(length(btrim(next_step)) between 1 and 280),
 target_date date check(target_date between date '1900-01-01' and date '2100-12-31'),
 status text not null default 'active' check(status in ('active','completed','archived')),
 version integer not null default 1 check(version > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 closed_at timestamptz,
 constraint goal_owner_reference unique(person_id,id),
 constraint goal_close_consistent check((status='active' and closed_at is null) or (status<>'active' and closed_at is not null))
);
create unique index goals_one_active_per_person on public.goals(person_id) where status='active';
create index goals_person_created on public.goals(person_id,created_at desc);
alter table public.goals enable row level security;
revoke all on public.goals from anon,authenticated;
grant select on public.goals to authenticated;
grant insert(id,person_id,title,domain,reason,next_step,target_date) on public.goals to authenticated;
grant update(title,domain,reason,next_step,target_date,status) on public.goals to authenticated;
grant all on public.goals to service_role;
create policy goals_owner_read on public.goals for select to authenticated
 using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy goals_owner_insert on public.goals for insert to authenticated
 with check(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy goals_owner_update on public.goals for update to authenticated
 using(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())))
 with check(exists(select 1 from public.persons p where p.id=person_id and p.auth_user_id=(select auth.uid())));

create function public.validate_goal_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='UPDATE' then
  if old.status <> 'active' then raise exception 'Closed goal cannot be edited' using errcode='23514'; end if;
  if new.status <> old.status and (new.title,new.domain,new.reason,new.next_step,new.target_date) is distinct from (old.title,old.domain,old.reason,old.next_step,old.target_date) then
   raise exception 'Save edits before closing goal' using errcode='23514';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  if new.status <> 'active' then new.closed_at := now(); end if;
 end if;
 return new;
end;
$$;
revoke all on function public.validate_goal_update() from public,anon,authenticated;
create trigger goal_validate before update on public.goals for each row execute function public.validate_goal_update();

alter table public.personal_events add column goal_id uuid;
alter table public.personal_events add constraint events_goal_owner
 foreign key(person_id,goal_id) references public.goals(person_id,id) on delete cascade;
alter table public.personal_events add constraint goal_event_reference
 check(kind not in ('goal.created','goal.updated','goal.completed','goal.archived') or goal_id is not null);
create index events_goal_id on public.personal_events(goal_id) where goal_id is not null;

-- Narrow definer trigger: only metadata from the authorized goal row. No client
-- payload or arbitrary SQL, fixed search_path, and no direct EXECUTE grants.
create function public.record_goal_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_kind text;
begin
 if tg_op='INSERT' then event_kind := 'goal.created';
 elsif new.status='completed' then event_kind := 'goal.completed';
 elsif new.status='archived' then event_kind := 'goal.archived';
 else event_kind := 'goal.updated'; end if;
 insert into public.personal_events(person_id,kind,occurred_at,source,source_record_id,goal_id)
 values(new.person_id,event_kind,now(),'user',new.id,new.id);
 return new;
end;
$$;
revoke all on function public.record_goal_event() from public,anon,authenticated;
create trigger goal_record_event after insert or update on public.goals for each row execute function public.record_goal_event();
