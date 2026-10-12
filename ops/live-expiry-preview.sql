-- Final low-cost schedule. Verify timed delivery first with unconditional function invocation.
-- No credential values or caller-controlled targets appear in cron logs.
select cron.schedule(
  'aethelios-live-preview-expiry', '* * * * *',
  $job$
    select case when exists(
      select 1 from public.ai_live_sessions s
      left join live_private.expiry_leases l on l.session_id=s.id
      where s.call_id is not null and s.expires_at<=now() and l.confirmed_at is null
    ) then live_private.run_preview_expiry()
    else '{"idle":true}'::jsonb end;
  $job$
);
-- Rollback: disable admissions, drain calls, then:
-- select cron.unschedule('aethelios-live-preview-expiry');
-- Revoke only the dedicated Vercel automation credential after draining the pilot.
-- Do not remove shared extensions or unrelated jobs/Vault entries.
