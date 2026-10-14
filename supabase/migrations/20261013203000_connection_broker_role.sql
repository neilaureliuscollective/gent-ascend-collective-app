-- Current PostgREST sets request.jwt.claims JSON. The legacy
-- request.jwt.claim.role scalar is not present on disposable local
-- Supabase. Use the official auth.role() helper (JSON with scalar fallback).
-- Fail closed: missing or non-service_role claims are denied. Do not use
-- current_user inside this SECURITY DEFINER function as caller identity.
create or replace function public.service_connection_require_broker() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'Trusted connection broker required';
  end if;
end $$;
revoke all on function public.service_connection_require_broker() from public, anon, authenticated;
