-- Phase 4: read-only decision follow-through. No new writes or progression rule.
-- Invoker privileges preserve owner RLS on every source table; no owner argument.
create function public.performance_outcomes() returns jsonb
language sql stable security invoker set search_path='' as $$
 with decisions as (
  select d.* from public.performance_progression_decisions d
  where d.person_id in (select id from public.persons where auth_user_id=(select auth.uid()))
  order by d.created_at desc,d.to_version desc limit 20
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'fromVersion',d.from_version,'toVersion',d.to_version,'createdAt',d.created_at,
  'review',d.evidence,'approvedPlan',approved.plan,'revisedAt',boundary.recorded_at,
  'sessions',coalesce(attempts.items,'[]'::jsonb)
 ) order by d.created_at desc,d.to_version desc),'[]'::jsonb)
 from decisions d
 join public.performance_program_revisions r on r.person_id=d.person_id and r.version=d.to_version
 cross join lateral (
  select item->'plan' as plan from jsonb_array_elements(r.sessions) item
  where item->>'id'=d.evidence->>'slotId'
 ) approved
 left join lateral (
  select later.version,later.recorded_at from public.performance_program_revisions later
  where later.person_id=d.person_id and later.version>d.to_version
   and (select item->'plan' from jsonb_array_elements(later.sessions) item
    where item->>'id'=d.evidence->>'slotId') is distinct from approved.plan
  order by later.version limit 1
 ) boundary on true
 left join lateral (
  select jsonb_agg(jsonb_build_object(
   'id',s.id,'title',s.title,'planVersion',s.plan_version,'prescription',s.prescription,
   'startedAt',s.started_at,'endedAt',s.ended_at,'status',s.status,'unit',s.unit,
   'pain',s.pain,'note','','sets',(
    select coalesce(jsonb_agg(jsonb_build_object(
     'id',x.id,'exerciseId',x.exercise_id,'exercise',x.exercise,
     'targetReps',x.target_reps,'targetLoad',x.target_load,
     'reps',x.reps,'load',x.load,'effort',x.effort,'done',x.done
    ) order by x.position),'[]'::jsonb)
    from public.performance_sets x where x.person_id=d.person_id and x.session_id=s.id
   )
  ) order by s.started_at,s.id) as items from (
   select s.*,c.prescription from public.performance_sessions s
   join public.performance_session_context c on c.person_id=s.person_id and c.session_id=s.id
   where s.person_id=d.person_id and c.slot_id=(d.evidence->>'slotId')::uuid
    and c.program_version>=d.to_version and s.started_at>=d.created_at
    and (boundary.version is null or (c.program_version<boundary.version and s.started_at<boundary.recorded_at))
   order by s.started_at,s.id limit 2
  ) s
 ) attempts on true
$$;
revoke all on function public.performance_outcomes() from public,anon;
grant execute on function public.performance_outcomes() to authenticated;
