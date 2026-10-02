-- Trigger-only synchronization must not be exposed as a callable RPC.
revoke execute on function public.ai_sync_messages() from public, anon, authenticated;
