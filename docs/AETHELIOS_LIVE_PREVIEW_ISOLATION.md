# Protected voice environment — preview binding, October 12, 2026

## Inspected risk and implementation

The previous preview gates checked runtime mode, Live enablement and a control-readiness declaration, but not whether the configured database was separate from production. Existing Vercel environment names/scopes do not prove target isolation. A stale shared Preview URL could therefore direct a deliberately enabled pilot at live data. Normal text/account permissions and existing production binding are left intact; this check applies specifically to Live admission and infrastructure expiry work on previews.

Require server-only `AETHELIOS_LIVE_PREVIEW_PROJECT_REF`, an exact lowercase 20-character project reference. The public Supabase URL must be the matching root HTTPS managed-project origin, with no credentials, path, custom port, query or fragment, and a publishable key must exist. Explicitly reject the canonical Gent production reference and the separate founder Aethelios reference even if both the URL and pin agree. Reject missing/malformed pins, lookalike domains, loopback/HTTP URLs and different projects. Admission and preview expiry fail before provider/privileged database work.

The founder preflight returns only a binding category and keeps acceptance unverified. A configuration match does not prove branch ancestry, non-production classification, schema, key validity or RLS. Those require actual target approval and hosted tests. The check never calls Supabase or creates/changes a project, key, grant, migration or flag. Existing local pilot behavior and manual owner cleanup remain available; production voice admission stays rejected. Production expiry retains its future canonical connection behavior rather than becoming a normal user/AI action.

## Research and target decision

Reviewed official [Supabase branching](https://supabase.com/docs/guides/deployment/branching) and [Vercel environment scopes](https://vercel.com/docs/environment-variables), plus installed Supabase guidance. Branches are distinct environments; a Vercel preview label alone is not proof of database isolation. Rechecked canonical Gent project: **no development branches**. Its current organization is `nsigbbnvhixvldkapqvq`. Requested a choice between a temporary branch proposal in that existing organization and an existing isolated preview reference. The actual account-specific cost must be retrieved/reviewed before branch creation; no cost confirmation, new branch or subscription was executed.

Existing OpenAI Vercel credentials are reused. No replacement provider key is requested. Database/worker/scheduler setup still needs the isolated target and server-only authority described in the existing expiry/hosted validation plans. Do not set the readiness flags to bypass those steps or treat this configuration check as cleanup evidence.

## Validation and phase status

Local lint/types pass; **82 files / 550 unit/SQL tests pass**. New cases cover protected projects, missing/malformed pins, URL mismatch/decorations, acceptance separation and rejection of an unpinned preview before privileged worker/provider work. Tests are synthetic configuration checks, not actual provider/hosted database acceptance. Existing owner/RLS, first-session and voice fixture checks remain required in exact-head CI.

This completes the isolation-configuration slice within the first of the three planned release phases. The protected founder environment is not yet active. Next dependent action: verify the selected existing target, or obtain/review an actual branch cost proposal for the confirmed organization; provision schema and server-only credentials there, then test hosted model access and cleanup before enabling the controlled preview. Actual voice/device/billing acceptance and public release gates still follow. No production release, voice activation or ChatGPT-parity claim.
