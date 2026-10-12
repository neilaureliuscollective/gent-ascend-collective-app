# Aethelios Live — Phase 5B hosted preflight and configuration audit

October 12, 2026. First hosted-readiness slice implemented locally; actual voice/mobile acceptance remains open. No production deployment, environment change, migration application or credential copy was performed.

## Actual Vercel findings

Read the connected Vercel account, selected the exact canonical `gent-ascend-collective-app` project and confirmed its repository link/deployment metadata. Environment inspection requested `decrypt: false`; OpenAI credential values were never retrieved or printed.

| Check | Observed result |
| --- | --- |
| OpenAI credential | `OPENAI_API_KEY` exists as a protected sensitive/Secret variable, scoped to **Production and Preview**, without a branch override. |
| ElevenLabs | Existing production key/agent configuration remains present. Untouched. |
| Live activation | No project variable named `AETHELIOS_LIVE_ENABLED` or `AETHELIOS_LIVE_CONTROL_READY` was listed. Absence does not establish any independent hosting-control acceptance. |
| Live branch deployment | Branch-filtered deployment listing for `feat/aethelios-live-openai` returned zero deployments. |
| Current production source | READY deployment on `main`, commit `9d973fe94526cbd5c98f5ea1495c999ddd3f803e` (Obsidian Intelligence release), rather than this local Live branch. Preserve that completed release when preparing the integration preview. |
| Local workspace credential | Still absent here. Vercel-scoped Secrets do not become local runtime bindings automatically. This does **not** mean the deployed application lacks its configured OpenAI key. |

The founder's correction is confirmed: do not request a replacement key or introduce Gateway/new billing. Reuse the existing server configuration. Project metadata establishes presence and target scopes, not key validity, runtime injection on a particular build, Realtime permissions, quota or audio performance. The connector also redacted the value of the public Supabase URL, so this audit does not independently prove its exact deployment-to-database binding.

## Read-only hosted database findings

The connected Supabase account contains **Gent Ascend App** (`volpzkfsnmtztrovexcw`), whose historical migration ledger matches this repository, and a separate `aethelios` project with a different application/migration history. Neither project was modified. No user records, Auth tokens or provider keys were read.

Gent Ascend App has none of the new Live migrations recorded. A direct read-only catalog query confirmed all six checks false: `ai_live_sessions`, `ai_conversation_artifacts`, `ai_artifact_selection`, `ai_live_reserve(uuid,uuid,text)`, `ai_confirm_reviewed_daily_action(uuid,uuid,uuid,text,date,integer,text)` and `ai_action_proposals.source_review_id`. These are actual hosted schema observations, not SQL-emulator results. They do not prove user-session RLS behavior or that Vercel currently binds this project; confirm that binding before any migration rollout. The separate project is not a substitute database or deployment target for Public Aethelios.

## Implemented preflight

The existing founder launch ledger (`/app/founder/launch`) now includes **Aethelios Live hosted preflight**. Access remains the existing person-bound `founder_access` grant, read through the authenticated session and RLS; membership, email, metadata, Vercel access and developer simulation cannot grant it.

- **Inspect Live configuration** reads the current deployed server's environment, validated commit SHA, allowlisted model, key-presence boolean, pilot flags and admission configuration. It makes no OpenAI request. Invalid environment/model combinations fail closed; production voice remains blocked.
- The schema check uses parallel owner-filtered zero-row selects through the normal Supabase client, with bounded abort signals. Only readable/unavailable categories leave the server. This checks the read contract, not RPC installation, successful saves or complete migration activation. No RPC, schema write, service-role access or user content retrieval occurs.
- **Check OpenAI model metadata** explicitly sends one server-only read to the fixed OpenAI `/v1/models/{allowlisted-model}` endpoint using the existing `OPENAI_API_KEY`. It has a five-second timeout, a 16 KiB response bound, redirect denial and no retries. It never creates a voice session, ephemeral credential, generation, image, paid task or reservation. Model identity must match; errors are reduced to categories and raw provider bodies/keys are not returned or logged.
- POST requires same-origin bounded JSON and exactly `checkProvider: true`; caller URLs, models, credentials and arbitrary extra fields are rejected. Both GET/POST enforce founder authority, return private/no-store responses and never promote configuration or accessible model metadata into launch acceptance.
- Provider metadata timing is labeled as a metadata-request duration, **not voice latency**. A forbidden metadata endpoint can reflect key permission restrictions without proving Realtime itself is unusable. Audio access, quota, billed cost, hosting sideband lifetime and independent expiry/hangup still require real session tests.

The preflight is implemented in source, not available on current production or a Live preview yet. Configuration audit via connected tools is the only actual remote acceptance completed this phase. Provider requests in unit tests are synthetic. Existing cinematic assets/voiceovers, normal chat/Council, ElevenLabs and current production configuration remain unchanged.

## Research

Official documentation reviewed October 12:

- [Vercel Secret/Config variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables): environment scopes and protected secret handling. Do not assume project Secrets can be pulled into a local clone. The installed Vercel env-vars/CLI skills guided read-only metadata inspection; the project's direct-OpenAI policy supersedes Gateway recommendations.
- [OpenAI retrieve model](https://developers.openai.com/api/reference/resources/models/methods/retrieve): model retrieval provides basic metadata/permission information. It does not execute voice or demonstrate conversational performance.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): preserve caller identity and explicit row ownership; founder authority reuses the existing scoped grant. Changelog index retrieval remained unavailable through the research tool; no changelog review or package/schema upgrade is claimed.
- Installed Next.js 16.3.5 route-handler guidance reviewed before edits: runtime reads, domain-owned authorization and private no-store responses. The React quality checklist was applied to the client panel and server composition.

## Validation and next action

Lint/typecheck pass; **75 files / 491 unit/SQL tests pass**. Targeted preflight/release tests: 13 pass. Historical migration ledger: 28 files unchanged and verified. Tests cover denied founder access before database/provider work, production/invalid configuration, secret redaction, fixed endpoint and no redirects, response limits, error categories, zero-row owner filters, explicit origin/body review and no automatic provider call or acceptance promotion.

Browser founder-denial cases now assert the preflight is absent at 360/768/1440px. Discovered by Playwright but unrun: fresh loopback probe remains `EPERM`. Fresh build still fails at the unchanged pinned MediaPipe prebuild download (`EAI_AGAIN storage.googleapis.com`). No camera asset or required check was bypassed. Vercel metadata and hosted SQL catalog reads succeeded through connectors despite local execution/network restrictions.

Next: prepare and validate an integration preview containing the Live stack while preserving the current Obsidian release, confirm its **non-production database binding**, review/apply the existing additive migrations to that approved target, then use the founder preflight on the actual deployed server. Verify model metadata, normal two-account ownership, actual WebRTC audio/tools, independent expiry/hangup and device behavior using [AETHELIOS_LIVE_ACCEPTANCE.md](AETHELIOS_LIVE_ACCEPTANCE.md). Do not enable readiness flags as a substitute for hosting evidence. Production admission stays rejected; no runtime/model promotion or ChatGPT-parity claim until measured acceptance.
