# Aethelios Chat + Studio release readiness — 2026-09-27

## Decision

The next useful phase is release hardening of the already-built Chat Foundation and Studio V1. A new media feature would compound unverified Auth, Storage, model and device behavior. The release candidate must let the founder test real conversation persistence and one saved image generation/edit loop, with clear failure recovery.

## Findings from the live read-only audit

- Gent Ascend Supabase project `volpzkfsnmtztrovexcw` is healthy and currently has 16 applied migrations. Eleven have source in this repository. Five `reserve_*` migrations belong to the Reserve app but share this database. The Chat Foundation (`20260927210000`) and Studio (`20260927220000`) migrations are not applied. Existing conversation and turn data is present. No hosted schema or records were changed during this audit.
- Vercel project `gent-ascend-collective-app` uses Next.js on Node 24 and has a ready preview deployment. The project has SSO protection for its default deployment URLs. This audit does not establish that this branch or the image model is deployed/configured.
- A Vercel Function request or ordinary response has a 4.5 MB payload limit. The former 10 MB multipart reference upload would fail for larger phone photos. The corrected flow issues an owner-scoped Supabase signed upload and finalizes after server-side byte validation. The authenticated image response is streamed. [Vercel limits](https://vercel.com/docs/functions/limitations), [large upload guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [Supabase signed upload](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl).
- Vercel's Node Function duration supports the configured 300 seconds on current plans, but actual image latency must be measured. Supabase standard uploads are recommended under 6 MB, another reason to keep phone photos direct to Storage. [Vercel duration](https://vercel.com/docs/functions/limitations), [Supabase upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
- Current OpenAI docs favor the Responses image-generation tool for iterative edits; model access and organization verification have to be tested with the actual account. [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation).

## Code in this pass

Reference upload: authorize owned project and capability → issue random, non-upsert signed Storage path → browser uploads direct with the Supabase SDK → authenticated finalize downloads and checks PNG/JPEG/WebP signature and 10 MB bound → persist the reference. Saved references can be reselected after returning to a project. Failed versions offer a prompt reuse action that preserves their source link. The browser never automatically resends an ambiguous generation request. The local migration ledger check now pins the applied Gent Ascend pilot migration and states that the Reserve migrations are external.

## Exact release sequence (when publication is authorized)

1. Review this branch and the two additive SQL migrations. Recheck the live migration ledger immediately before application; do not run `supabase db push` blindly from this checkout because the shared project has Reserve-owned migrations absent from this repository.
2. Use an isolated staging database/preview if available. Apply the Chat Foundation migration first, then the Studio migration. Confirm the private `aethelios-studio` bucket and authenticated owner policies. Do not seed production.
3. With two real accounts, verify one cannot list, download, register or generate from the other's project/reference/version. Sign out and confirm private image routes return 401. Verify a >4.5 MB reference uploads from a phone directly to Storage, then create/refine an image and return after signing in on another device.
4. Verify the actual `OPENAI_API_KEY` account can call the configured mainline model plus `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst`. Measure first-image latency, cost, moderation failure, 429, timeout and a lost network response. Confirm at most one pending request and no duplicate billing on repeated request IDs.
5. Check Chat Foundation end to end: create/send/stream/refresh, second thread isolation, search, rename, archive, revision/retry and long-thread summary. Confirm the old daily-action/feedback links survive migration.
6. Review closed Fold, open Fold, desktop, keyboard focus and slow network. Then promote the reviewed app build after the founder's release approval. Observe runtime errors and preserve the previous deployment for rollback. SQL migrations are additive and are not rolled back by redeploying old code.

## Limits that remain explicit

No local Docker runtime, browser binary, live Auth session or OpenAI key is present in this execution environment. PGlite validates SQL contracts but is not Supabase Storage or GoTrue. Signed upload tokens can leave orphaned objects if the browser never finalizes; lifecycle cleanup and per-user asset quotas should be added before a wider paid rollout. Studio history currently shows the most recent 100 versions/project; long-history pagination and image thumbnails remain future work. A live, measured founder test is required before a production-quality claim.
