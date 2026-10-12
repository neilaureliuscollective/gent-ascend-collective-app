-- Operator-only, fixed-target delivery. This is not an application/model tool.
create or replace function live_private.run_preview_expiry()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare scheduler text; protection text; response extensions.http_response; result jsonb;
begin
  select decrypted_secret into strict scheduler from vault.decrypted_secrets where name='aethelios_live_preview_cron';
  select decrypted_secret into strict protection from vault.decrypted_secrets where name='aethelios_live_preview_vercel';
  if length(scheduler)<32 or length(protection)<>32 then raise exception 'Scheduler configuration unavailable'; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','55000');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000');
  select * into response from extensions.http(row(
    'GET',
    'https://gent-ascend-collective-app-git-integration-7ec769-stutes-legacy.vercel.app/api/internal/live-expiry',
    array[row('Authorization','Bearer '||scheduler)::extensions.http_header,
      row('x-vercel-protection-bypass',protection)::extensions.http_header],null,null
  )::extensions.http_request);
  if response.status<>200 or response.content_type not like 'application/json%' or length(response.content)>1024 then
    raise exception 'Cleanup delivery failed';
  end if;
  result=response.content::jsonb;
  if jsonb_typeof(result) is distinct from 'object' or result-'claimed'-'confirmed'-'pending'<>'{}'::jsonb
    or coalesce(result->>'claimed','') !~ '^[0-5]$'
    or coalesce(result->>'confirmed','') !~ '^[0-5]$'
    or result->>'pending' is distinct from '0'
    or result->>'claimed' is distinct from result->>'confirmed' then
    raise exception 'Cleanup receipt unconfirmed';
  end if;
  return result;
exception when others then
  -- Never echo response bodies, headers, Vault values or nested SQL error details.
  raise exception 'Preview expiry delivery unconfirmed' using errcode='P0001';
end $$;
revoke all on function live_private.run_preview_expiry() from public,anon,authenticated,service_role;
