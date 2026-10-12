-- Operational module setup only. No account data or secrets; no job activated here.
-- CLI migration-new was attempted but failed on read-only /home/agent/.supabase.
-- These optional hosting modules are not required for local application migrations.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- HTTP queues contain authentication headers. Ordinary app roles must never read them.
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
