-- A reviewable, owner-bound proposal; chat text does not execute it.
create table public.ai_action_proposals (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 source_turn_id uuid references public.ai_turns(id) on delete set null,
 tool_name text not null default 'create_daily_action' check(tool_name='create_daily_action'),
 title text not null check(char_length(btrim(title)) between 1 and 100),
 status text not null default 'pending' check(status in ('pending','executed','rejected')),
 proposed_at timestamptz not null default now(),
 decided_at timestamptz,
 executed_day date,
 unique(person_id,source_turn_id)
);
create index ai_action_proposals_owner_recent on public.ai_action_proposals(person_id,proposed_at desc);
alter table public.ai_action_proposals enable row level security;
revoke all on public.ai_action_proposals from public,anon,authenticated;
grant select on public.ai_action_proposals to authenticated;
create policy ai_action_proposals_owner on public.ai_action_proposals for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));

create function public.ai_propose_daily_action(p_id uuid,p_turn uuid,p_title text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; existing record;
begin
 select id into owner_id from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_id is null or p_turn is null or p_title is null or char_length(btrim(p_title)) not between 1 and 100 then
  raise exception 'Invalid proposal' using errcode='22023'; end if;
 if not exists(select 1 from public.ai_turns where id=p_turn and person_id=owner_id and status='complete') then
  raise exception 'Source turn not found' using errcode='42501'; end if;
 select id,title into existing from public.ai_action_proposals where person_id=owner_id and source_turn_id=p_turn;
 if found then
  if existing.id=p_id and existing.title=btrim(p_title) then return p_id; end if;
  raise exception 'Turn already has a proposal' using errcode='23505';
 end if;
 insert into public.ai_action_proposals(id,person_id,source_turn_id,title)
 values(p_id,owner_id,p_turn,btrim(p_title));
 return p_id;
end $$;

create function public.ai_decide_daily_action(p_id uuid,p_approve boolean)
returns date language plpgsql security definer set search_path='' as $$
declare owner_id uuid; zone text; proposal record; today date; next_position integer; current_version integer;
begin
 select id,timezone into owner_id,zone from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_id is null or p_approve is null then raise exception 'Invalid decision' using errcode='22023'; end if;
 select * into proposal from public.ai_action_proposals where id=p_id and person_id=owner_id for update;
 if not found then raise exception 'Proposal not found' using errcode='42501'; end if;
 if proposal.status='executed' and p_approve then return proposal.executed_day; end if;
 if proposal.status='rejected' and not p_approve then return null; end if;
 if proposal.status<>'pending' then raise exception 'Proposal already decided' using errcode='40001'; end if;
 if not p_approve then
  update public.ai_action_proposals set status='rejected',decided_at=now() where id=p_id;
  return null;
 end if;
 today:=(current_timestamp at time zone zone)::date;
 select coalesce(max(position)+1,0) into next_position from public.daily_actions where person_id=owner_id and day=today;
 if next_position>=5 then raise exception 'Today has five actions' using errcode='P0001'; end if;
 select version into current_version from public.daily_entries where person_id=owner_id and day=today;
 if current_version is null then
  insert into public.daily_entries(person_id,day,timezone) values(owner_id,today,zone);
 else
  update public.daily_entries set version=version+1,updated_at=now() where person_id=owner_id and day=today;
 end if;
 insert into public.daily_actions(person_id,day,id,title,done,position)
 values(owner_id,today,p_id,proposal.title,false,next_position);
 update public.ai_action_proposals set status='executed',decided_at=now(),executed_day=today where id=p_id;
 return today;
end $$;
revoke all on function public.ai_propose_daily_action(uuid,uuid,text),public.ai_decide_daily_action(uuid,boolean) from public,anon;
grant execute on function public.ai_propose_daily_action(uuid,uuid,text),public.ai_decide_daily_action(uuid,boolean) to authenticated;
