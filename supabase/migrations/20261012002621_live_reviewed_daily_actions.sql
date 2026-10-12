-- One explicitly user-confirmed action from a completed scoped review. No AI write tool.
alter table public.ai_action_proposals
 add column source_review_id uuid references public.ai_conversation_artifacts(id) on delete set null,
 add column review_day date,
 add column review_version integer check(review_version>=0),
 add column review_timezone text;
alter table public.ai_action_proposals add constraint reviewed_action_metadata check(
 (review_day is null and review_version is null and review_timezone is null and source_review_id is null)
 or (review_day is not null and review_version is not null and review_timezone is not null and source_turn_id is null)
);
create unique index ai_action_one_per_review on public.ai_action_proposals(source_review_id)
 where source_review_id is not null;

create function public.ai_confirm_reviewed_daily_action(
 p_id uuid,p_conversation uuid,p_review uuid,p_title text,p_day date,p_version integer,p_timezone text
) returns date language plpgsql security definer set search_path='' as $$
declare owner_id uuid;zone text;source public.ai_conversation_artifacts;
 receipt public.ai_action_proposals;current_version integer;
begin
 -- Same owner mutex as daily_save and the existing action writer.
 select id,timezone into owner_id,zone from public.persons where auth_user_id=(select auth.uid()) for update;
 if owner_id is null then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_id is null or p_conversation is null or p_review is null or p_day is null
 or p_version is null or p_version<0 or p_timezone is null
 or p_title is null or char_length(btrim(p_title)) not between 1 and 100 then
  raise exception 'Invalid action confirmation' using errcode='22023';end if;
 if not exists(select 1 from public.founder_access where person_id=owner_id)
 and not exists(select 1 from public.membership_accounts where person_id=owner_id and beta_access) then
  raise exception 'Pilot access required' using errcode='42501';end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation and person_id=owner_id and company_id is null and archived_at is null) then
  raise exception 'Conversation unavailable' using errcode='42501';end if;
 select * into source from public.ai_conversation_artifacts where id=p_review and person_id=owner_id
 and conversation_id=p_conversation and operation='visual.review' and status='complete' for share;
 if source.id is null or source.visual->>'kind' is distinct from 'review' then
  raise exception 'Completed review unavailable' using errcode='42501';end if;
 select * into receipt from public.ai_action_proposals where id=p_id and person_id=owner_id;
 if receipt.id is not null then
  if receipt.source_review_id is distinct from p_review or receipt.title is distinct from btrim(p_title)
  or receipt.review_day is distinct from p_day or receipt.review_version is distinct from p_version
  or receipt.review_timezone is distinct from p_timezone or receipt.status<>'executed' then
   raise exception 'Confirmation changed' using errcode='40001';end if;
  if not exists(select 1 from public.daily_actions where person_id=owner_id and day=receipt.executed_day
   and id=p_id and title=receipt.title) then
   raise exception 'Saved action changed or was removed' using errcode='40001';end if;
  return receipt.executed_day;
 end if;
 if exists(select 1 from public.ai_action_proposals where source_review_id=p_review) then
  raise exception 'Review already has a confirmed action' using errcode='40001';end if;
 perform 1 from public.ai_artifact_selection where person_id=owner_id and conversation_id=p_conversation
 and artifact_id=p_review for update;
 if not found then raise exception 'Selected review changed' using errcode='40001';end if;
 if zone<>p_timezone or p_day<>(current_timestamp at time zone zone)::date then
  raise exception 'Local day or timezone changed' using errcode='40001';end if;
 select version into current_version from public.daily_entries where person_id=owner_id and day=p_day;
 if coalesce(current_version,0)<>p_version then
  raise exception 'Daily record changed' using errcode='40001';end if;
 -- Pending exists only within this transaction. Legacy RPCs never see an executable review draft.
 insert into public.ai_action_proposals(id,person_id,source_turn_id,title,source_review_id,review_day,review_version,review_timezone)
 values(p_id,owner_id,null,btrim(p_title),p_review,p_day,p_version,p_timezone);
 return public.ai_decide_daily_action_v2(p_id,true,btrim(p_title));
end $$;
revoke all on function public.ai_confirm_reviewed_daily_action(uuid,uuid,uuid,text,date,integer,text) from public,anon;
grant execute on function public.ai_confirm_reviewed_daily_action(uuid,uuid,uuid,text,date,integer,text) to authenticated;
