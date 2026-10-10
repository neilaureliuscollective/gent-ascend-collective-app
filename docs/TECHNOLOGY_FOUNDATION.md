# Aethelios Technology — Creation Foundation

Founder approved Phase 1 execution on October 8, 2026. Public repository only. This candidate builds on Public Intelligence OS PR #64 (`af89b7615cd65a3c2c5da84e252fe895bc6a4205`), not production main. Publication of an isolated review branch does not approve production promotion.

## Experience

Work → Technology provides Guided Creation and Vision to Product intake into one explicit business brief. Vision intake is structured requirements capture, not an autonomous interview or arbitrary application builder. Unsupported SaaS, stores and custom code are clearly excluded. The fixed service-business renderer supports grooming/beauty and a professional-services copy variant: Home, Services, About and Contact, up to twelve services, displayed prices, hours, contact and an optional external HTTPS booking link. Contact forms are disabled and labeled preview-only. Booking is an outbound link to the user's provider, not appointment configuration or API access. No external requests are made to validate that link.

Saved artifacts pin `service-business-v1`; future template releases must retain its renderer or explicitly migrate a new copy, preserving old brief versions. Approval/refinement are disabled while an older historical version is visible. A return-to-current control restores the current preview.

Manual changes update a working preview without provider spend. Save creates an immutable brief/site version; confirming it records the user's assessment of that exact saved revision. Further edits or AI refinement produce a new unreviewed version. Historical previews can be opened without changing the current brief. Reload/return reads existing records and never generates. Technology projects appear in Saved Work; personal Missions have an explicit Technology handoff and return link. A Mission ID/direction revision is captured only on project creation. Importing its objective into the brief requires a button press; no memory, conversation transcript or company context is automatically sent to the provider. Removing a Mission preserves its Technology project and versions.

The existing Talk/Work/Studio navigation, identity, billing, Council, memory, Studio and approved Obsidian/Gold/Petrol palette remain. This is a bounded creation foundation, not a claim of autonomous coworker engineering or launch-ready customer websites.

## Architecture

- `src/domains/technology/schema.ts`: strict shared Zod contracts, fixed model and usage policy.
- `src/domains/technology/service.ts`: session-bound reads, mutation orchestration and one optional direct OpenAI call.
- `src/app/api/technology/route.ts`: private/no-store GET and same-origin bounded JSON POST. Domain services own business rules.
- `src/components/technology`: editor, project/history/review controls and React renderer. Text is escaped; no arbitrary HTML, JavaScript, iframe, embed, uploaded executable or generated code is executed. Preview styles are repository-controlled.
- Additive migration `20261008180000_technology_foundation.sql`, after both Mission migrations. Four tables: person-bound expiring grants, projects, immutable site/brief versions and a generation reservation/usage ledger. One version transaction stores the complete requirements and renderable content together; separate brief versions and run-check tables would duplicate the same fixed-template artifact at this stage.
- RLS SELECT is owner-bound, including after a pilot grant expires. Direct authenticated/anonymous writes are denied. Narrow security-definer RPCs resolve person through `auth.uid()`, verify founder/explicit pilot grant, enforce exact revisions, reject changed request replays, and serialize owner/project writes. Membership, beta status, email and user metadata never grant Technology access. Mission references use composite owner keys.
- Founder grant is reused as an implemented nonclinical capability. Additional pilot grants must be created by an authorized operator; this implementation creates no hosted grant. Expiration is enforced in the database before every mutation.

## Provider and cost boundary

Manual saved previews work without AI configuration. AI refinement requires server-only `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and the existing public Supabase URL, an exact reviewed current brief and explicit per-request consent. The service key is used only for the settlement RPC; ordinary user reads, saves, reviews and cost reservations use the user's RLS session. It is never forwarded to OpenAI, the renderer or generated content. Ordinary clients cannot forge usage or refund reservations.

Refinement improves headline/about/service descriptions only. Business identity/category, vision, service names/prices, hours, contact and booking URL must match exactly or output is withheld. Generated copy remains a draft for human assessment; this check cannot prove every generated sentence factual.

- Technology-only `gpt-6.1-sol`; general Talk routing is unchanged.
- One provider request, `maxRetries: 0`, 4,000 maximum output tokens, 14,000-byte serialized brief limit and 85-second provider timeout inside the 90-second route limit. No search, image generation, tools or Council fan-out.
- Atomically reserve USD 1 before calling the provider, from a USD 10 UTC-calendar-month internal pilot allowance. This is an inference allowance, not a Stripe charge or purchasable credit balance.
- Current short-context price contract: USD 2/M input and USD 10/M output. Full SDK output tokens are charged conservatively, including reasoning; cached input receives no discount in this estimate. `actual_micros = input_tokens × 2 + output_tokens × 10`. Rates are fixed alongside the model and must be reviewed together before changing either. With this bounded payload/output, the dollar reservation exceeds the estimated maximum request cost; this is not a universal provider spending guarantee.
- Display the remaining monthly allowance from the complete bounded owner ledger and ten recent run receipts. One reserved run per person. Successful settlement stores token counts and modeled cost and appends an unreviewed version atomically. The ledger, not the browser, decides available allowance.
- Timeout, refusal, invalid output, unknown usage or interrupted/failed settlement retain the full reservation and block further generation across the person's projects. Saving on the affected reserved project is blocked so stale provider output cannot overwrite new work. No automatic retry. Uncertain runs do not reset at a monthly boundary.

### Reconciliation

There is deliberately no client-controlled refund, retry or reset. An authorized operator must compare the persisted run ID, timestamp, model and provider/broker evidence. A reserved or uncertain run may still have incurred provider spend, or settlement may have succeeded after the browser failed. First reload exact saved state. Do not launch a replacement request to investigate. A separate reviewed administrative repair may account for proven usage, retain the reservation if unknown, and mark the run resolved; no such repair is executed or exposed by this candidate. Before expanding beyond the invited pilot, add request-ID correlation, an authenticated operator workflow, provider invoice reconciliation and failure-cost categories. The current conservative lock is safe but requires founder support.

## Limits and deliberate omissions

Five retained projects per person, 100 versions per project, bounded field sizes and lightweight project metadata. History is loaded with bounded complete brief bodies; lazy loading should precede higher limits. Archival/deletion and restoring an older version as current are not offered in this slice. The initial five-project limit is stricter than the planning proposal's five active projects, preserving predictable storage without adding a project lifecycle prematurely.

No image/asset selector, logos, autonomous requirements interview, generated repository, code sandbox, background worker, specialist roster, deployment, DNS, hosting, booking API, payments, operational contact forms, commerce, customer database or subscription changes. No new paid service was purchased, live provider called or hosted migration applied during implementation. A durable worker and isolated generated workloads belong to subsequent engineering phases.

## Acceptance and release

Tests distinguish contract/SQL emulation, synthetic browser fixtures, disposable local real Auth/PostgREST CI and hosted/live-provider acceptance. See STATUS.md for actual receipts. The real local founder journey also uses actual Next routes and two authenticated accounts to prove save/review/revision/reload, Saved Work discovery and cross-account read/write denial without provider calls. The local integration runner exercises owner isolation, default-deny grants, idempotent creation, immutable writes, exact review and denial of client settlement with real local sessions; no provider calls.

Release preflight now checks all three exact additive migrations, Technology tables/RLS/write privileges, public mutation RPCs and service-only settlement privilege. A catalog observation cannot authorize release. Application CI includes the new service contracts and responsive save/review/history/resume journey. Database CI resets only its disposable local Supabase and runs the real-account tests.

Before any production promotion: green exact-candidate CI, isolated staged migration rehearsal, real two-account Technology persistence/denial, separately authorized live model quality/usage evaluation, device/keyboard acceptance, required operational launch gates and an explicit founder release decision. No hosted project or database branch is provisioned by this scope. Rollback redeploys prior code and retains additive data; never drop saved projects/versions to roll back the UI.
