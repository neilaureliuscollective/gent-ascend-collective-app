# Realtime model access and founder acceptance — October 12, 2026

## Implemented build

Added a protected operator POST on the existing internal expiry route. It accepts no body/query, caller-selected model, account ID, session ID or command. It is disabled unless the worker is enabled, requires its existing scheduler credential, and only runs on a correctly bound Preview. It invokes the existing fixed-model metadata helper using the existing server-only OpenAI configuration. It returns redacted provider status and metadata-request duration with callAcceptance unverified, and creates no voice session, transcript, reservation or personal-data read. Production and ordinary requests are denied. The existing founder preflight retains normal user-session/RLS authorization; this operational check does not grant founder authority.

The ordinary Realtime call POST now explicitly rejects redirects and disables cache, preserving credential routing to the fixed provider URL. No engine replacement, new infrastructure or cinematic change.

Local lint/types and all 84 files / 563 tests pass. Exact application source e282363321e06d6d58019770da194185211bb702 passed connected Live integration run 38250113926: production build/focused browser checks (job 114813912906) and actual local Auth/worker-denial/lease checks (job 114813912589). This does not establish provider speech or physical-device acceptance. Broad Quality is separate.

## Actual hosting blocker

Vercel source retrieval failed with git_info_fail before build logs were created:

- automatic source deployment dpl_7Hqeo8UkYWmTJNzU2khpPkoCDnC1;
- redeployment dpl_EPxmja5UU5uTi9xjTa3f8HDhv8gT;
- explicit verified GitHub repository ID and commit deployment dpl_xAe7w4xca8C3nx6Jcg7Mvtg1J93W;
- redeploy from the last successful source with latest commit dpl_2aR4kJ7KhDAgeHmWEDr2ESdwc4ws.

Each returned ERROR/git_info_fail. Repository 1381423737 is accessible, the Git namespace is connected, and the existing project remains linked to neilaureliuscollective/gent-ascend-collective-app. These facts do not identify the underlying cause; do not claim the connection is missing or API keys are wrong. Team context confirms Pro. Connected tools provide no deeper error message/build events. Existing CI contains validation only and no configured direct Vercel upload/deployment fallback. Requested the additional Git error visible in the owner's deployment dashboard.

The last working Preview on bfff19ed remains available, as does the independent low-idle-cost cleanup schedule. Voice/readiness stay off. No credentials, public settings, Git connection, Production environment or production deployment changed in this phase. The new metadata probe has not yet executed against the hosted OpenAI configuration; no model access, actual call or latency is claimed.

## Next concrete action

Resolve source retrieval using the dashboard's exact Git error, deploy this validated source, run ops/live-provider-metadata.sql, then conduct a controlled normal-founder call. Preserve deployment protection, application Auth, transcript/context consent and two-minute pilot quotas. Actual termination after browser/function loss and final provider usage must be observed. Metadata access alone is not proof of voice access, billed cost, sound quality or interruption speed.

Reviewed current official OpenAI WebRTC and server-controls documentation; direct WebRTC plus server control remains the selected architecture. No speculative provider-native duration field or substitute credentials were introduced. Sources: https://developers.openai.com/api/docs/guides/realtime-webrtc and https://developers.openai.com/api/docs/guides/realtime-server-controls.
