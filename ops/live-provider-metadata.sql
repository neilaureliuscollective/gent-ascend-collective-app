-- Read-only provider metadata probe. No caller input, generation, account data or credentials in output.
select extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','15000');
select extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000');
select status,case when content_type like 'application/json%' and length(content)<1024
  then content else null end as result
from extensions.http(row(
  'POST',
  'https://gent-ascend-collective-app-git-integration-7ec769-stutes-legacy.vercel.app/api/internal/live-expiry',
  array[row('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='aethelios_live_preview_cron'))::extensions.http_header,
    row('x-vercel-protection-bypass',(select decrypted_secret from vault.decrypted_secrets where name='aethelios_live_preview_vercel'))::extensions.http_header],
  null,null
)::extensions.http_request);
