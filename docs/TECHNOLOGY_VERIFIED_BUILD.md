# Technology Phase 2 — Verified service-site builds

October 8, 2026. Founder requested recovery, inspection and execution of Phase 2. Correct public repository: `neilaureliuscollective/gent-ascend-collective-app`.

## Recovery and decisions

Recovered Phase 1 at `e429cfae1070b903060d37db0cf323e89e0c1b96`, remotely published on `feat/technology-creation-foundation` (PR #65). Clean committed candidate, not production. Its documented receipts include 442 unit/SQL tests, responsive fixtures and actual local two-account/Next journeys in earlier CI candidates. Final release acceptance remains distinct.

Phase 2 begins with durable deterministic execution for that fixed service-site foundation. The existing renderer/schema is a safer and directly useful export boundary than introducing arbitrary code or a new paid provider without demonstrated need. No new package, model call, paid executor or infrastructure provisioning. Managed agent/provider evaluation and general code execution remain future work; this slice does not claim to complete the broad autonomous-code roadmap.

Current source research: Next 16.3.5 installed route-handler documentation; Supabase RLS documentation (https://supabase.com/docs/guides/database/postgres/row-level-security); MDN iframe isolation (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe). Changelog markdown retrieval was unavailable. The implementation retains existing SDK calls, explicit grants and owner-resolved RPC patterns rather than adopting changed APIs.

## User flow

Save → review exact current version → Prepare website build → Build / resume saved job → inspect in a script-free isolated frame → download standalone HTML. A build uses the saved reviewed requirements, never an unsaved editor draft. New edits require another review/build; previous artifacts remain downloadable with their version identity.

The export is a single responsive HTML document with Home, Services, About and Contact sections and functional section navigation. This is a portable marketing-site artifact, not four route-based pages or a generated application/backend. External booking links are preserved; contact forms, appointment availability and publication remain unverified. The isolated inspector intentionally prohibits scripts, network resources, forms, popups and same-origin access. External booking can be used from a downloaded file, not the stricter inspector.

## Durable execution and evidence

`technology_builds` persists exact project/version/template identity, queued/running/ready status, attempts, server lease, completion checks, HTML and SHA-256. Session-owned queue/claim RPCs handle review, deduplication, same-request replay and ownership. A 30-second lease and unique lease token fence a stale executor. After interruption, the user reloads and explicitly resumes; no background processing or automatic retries are implied. Deterministic work is safe to repeat, unlike uncertain billed AI calls. Five attempts require operator review thereafter.

Queue remains a separate committed action from execution, so app closure retains the job. One artifact per saved version/template. On ambiguous completion, reload: ready returns existing data; an active lease prevents duplicate execution; an expired lease allows recovery. Exact source versions are immutable and retained. Deleting the owning project/account through an authorized lifecycle operation cascades to its build records; removing a Mission still preserves the independent project. A newer current editor/version does not rewrite the queued job. Existing Phase 1 inference reconciliation locks remain intact and distinct.

Only trusted server settlement can persist HTML, hashes and verification receipts. Ordinary sessions cannot forge a pass or directly edit jobs. Read/export always verifies authenticated person ownership. Exports recheck hash and deterministic static checks, send attachment/private/no-store/nosniff headers and never serve user code as application-origin executable content. Listings omit HTML bodies.

Checks cover document/language, viewport, internal destinations, executable content exclusion, content security policy and output size. They are explicitly static-template checks, not a claim of security certification, live integrations, full WCAG audit or independent AI verification. Browser tests separately load the actual exported document in a sandbox at phone/unfolded/desktop widths and check navigation/overflow. The local-only bootstrap writes its disposable server broker key to the ignored mode-0600 development environment, after rejecting non-loopback or hosted targets; it is never NEXT_PUBLIC. The exact candidate's real local authenticated founder suite exercises queue/build/export/inspection and second-account denial in CI.

## Release and rollback

Additive migration follows Phase 1: `20261008221240_technology_verified_build.sql`. Local SQL/RLS tests apply the full migration chain. CI performs disposable actual local Supabase and Next acceptance; hosted schema remains untouched. The release preflight now binds all four exact migration hashes and inspects the build table/RLS/RPC/service-only settlement contract. Before release, inspect ownership/grants/lease behavior on isolated staging and finish public foundation's provider/device/hosted gates. Catalog observation remains distinct from authenticated acceptance.

Production promotion, customer-site publication and paid infrastructure are outside this execution request's release scope. Rollback code while retaining additive tables and artifacts. No destructive down migration.

## Verification

Actual receipts are maintained at the top of STATUS.md. Provider fixtures, PGlite, browser fixtures, real local CI and hosted/device tests are distinct evidence levels.
