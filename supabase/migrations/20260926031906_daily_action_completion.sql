-- Complete one existing action. The chat cannot choose the owner or mark an entire day.
create function public.daily_complete_action(p_day date,p_action uuid,p_version integer)
returns integer language plpgsql security definer set search_path='' as $$
declare owner_id uuid; zone text; current_version integer; completed boolean;
begin
 select id,timezone into owner_id,zone from public.persons
 where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_day is null or p_day<>(current_timestamp at time zone zone)::date or p_action is null
    or p_version is null or p_version<0 then
   raise exception 'Invalid action or local day' using errcode='22023';
 end if;
 select version into current_version from public.daily_entries
 where person_id=owner_id and day=p_day;
 select done into completed from public.daily_actions
 where person_id=owner_id and day=p_day and id=p_action;
 if not found then raise exception 'Action not found' using errcode='42501'; end if;
 if completed then return current_version; end if;
 if current_version<>p_version then
   raise exception 'Daily record changed. Reload before confirming.' using errcode='40001';
 end if;
 update public.daily_actions set done=true
 where person_id=owner_id and day=p_day and id=p_action;
 update public.daily_entries set version=version+1,updated_at=now()
 where person_id=owner_id and day=p_day;
 return current_version+1;
end $$;
revoke all on function public.daily_complete_action(date,uuid,integer) from public,anon;
grant execute on function public.daily_complete_action(date,uuid,integer) to authenticated;

-- Preserve the old RPC for in-flight app versions; the new one records the edited title.
create function public.ai_decide_daily_action_v2(p_id uuid,p_approve boolean,p_title text)
returns date language plpgsql security definer set search_path='' as $$
declare owner_id uuid; zone text; proposal record; today date; next_position integer; current_version integer; chosen text;
begin
 select id,timezone into owner_id,zone from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_id is null or p_approve is null then raise exception 'Invalid decision' using errcode='22023'; end if;
 select * into proposal from public.ai_action_proposals where id=p_id and person_id=owner_id for update;
 if not found then raise exception 'Proposal not found' using errcode='42501'; end if;
 if proposal.status='executed' and p_approve then
   if btrim(p_title) is distinct from proposal.title then
     raise exception 'Proposal already decided with different title' using errcode='40001'; end if;
   return proposal.executed_day;
 end if;
 if proposal.status='rejected' and not p_approve then return null; end if;
 if proposal.status<>'pending' then raise exception 'Proposal already decided' using errcode='40001'; end if;
 if not p_approve then
   update public.ai_action_proposals set status='rejected',decided_at=now() where id=p_id;
   return null;
 end if;
 chosen:=btrim(p_title);
 if chosen is null or char_length(chosen) not between 1 and 100 then
   raise exception 'Invalid action title' using errcode='22023'; end if;
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
 values(owner_id,today,p_id,chosen,false,next_position);
 update public.ai_action_proposals set title=chosen,status='executed',decided_at=now(),executed_day=today where id=p_id;
 return today;
end $$;
revoke all on function public.ai_decide_daily_action_v2(uuid,boolean,text) from public,anon;
grant execute on function public.ai_decide_daily_action_v2(uuid,boolean,text) to authenticated;
