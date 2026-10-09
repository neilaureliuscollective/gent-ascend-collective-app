# Proposed next build — E1: Launch Core Recovery & Acceptance

October 9, 2026. Founder approved E1 implementation; see [E1_LAUNCH_CORE.md](E1_LAUNCH_CORE.md) for candidate progress and outstanding release gates. This plan is actionable; no product implementation, infrastructure purchase, database change, merge or deployment occurred during the architecture assignment. Context: [AETHELIOS_ENTITIES_ARCHITECTURE.md](AETHELIOS_ENTITIES_ARCHITECTURE.md).

## Ranked next three phases

| Rank | Phase | Launch/customer impact | Gap, dependencies, complexity and cost |
| --- | --- | --- | --- |
| 1 | **E1 — Launch Core Recovery & Acceptance** | A real new customer can enter, receive useful intelligence, retain reviewed work and return safely. | Public registration is closed; recovered Library/deliverable candidate is unmerged/conflicting; support and hosted acceptance are incomplete. Reuse #64/#63 and existing Auth/AI/Supabase. Medium integration scope; bounded model test spend, no mandatory infrastructure upgrade. |
| 2 | **E2 — Entities Advisor V1** | A customer creates, saves and uses their own specialized intelligence, beyond choosing a built-in specialist. | Requires proven account/access/history/context/cost contracts from E1. Two small Entity tables plus shared conversation integration, guided setup and actual model calls. Medium complexity, one provider, no scheduler/connector fleet. |
| 3 | **E3 — Paid Launch & Operational Readiness** | Convert validated customer value into a supportable, sustainable public commercial release. | Existing Stripe lifecycle needs real test-mode acceptance; entitlement/allowance plans, per-user/provider costs, retention/export/deletion, monitoring and physical-device gates need closure. Medium/high operational effort; use existing infrastructure before adding vendors. |

Recover the eight-phase website creation implementation, but do not make customer website publication, arbitrary file ingestion, video/music, autonomous Entities or a tool marketplace prerequisites for this launch path. They require separate capability acceptance. A useful Advisor launch can precede them. Next Operator slice should connect one existing reviewed internal action; external connectors and recurring work follow measured need.

## E1 objective and scope

Make the existing **account → Aethelios → reviewed saved outcome → return** journey work on a verified release candidate, with honest access, privacy and spend boundaries. Target a controlled public beta, not an unbounded free or paid launch. Founder approval of this phase authorizes implementation work; an exact validated production release remains reviewable before promotion. Existing main CI already reports real local Auth/PostgREST integration success, so this is activation/recovery and hosted verification, not an authentication rewrite.

What already exists: Supabase Auth/person mapping, two gated public entry paths, onboarding/claim handling, server-owned entitlements, real AI adapter, persistent chat, explicit memory, Table/specialists, Missions, Studio/private Storage, three-tab navigation and the complete Imperial Steel design. PR #64 already implements granular saved-source consent, inclusive entry, retained Mission documents and Saved Work, together with release preflight/ordinary two-account acceptance. Do not rebuild them.

What changes:

1. Recover #64/#63 into a new candidate based on current main, resolve conflicts deliberately and preserve the steel homepage/workspaces/new install crest. Do not integrate ancestor PRs twice. Preserve all Technology branches unchanged.
2. Reconcile production's configured public project and current catalog; determine which of the two Mission migration contracts are actually missing. No blind pushes, history edits or changes to Reserve/private applications.
3. Choose one clear public entry experience using existing Auth. Consolidate entry links/copy; keep existing member login compatible. Complete real confirmation, returning session and lost-access recovery; no forced new account or authentication bypass.
4. Define a bounded beta access policy using existing server-owned grants/entitlements. Signup alone must not invent paid/founder status. The initial cohort can use an approved invitation/grant process; don't silently grant all public signups unrestricted AI/Studio. Existing AI access denial must explain the next step.
5. Restore reviewed Mission → retained document → exact saved version/Markdown export and Saved Work discovery from the recovered candidate. Opening/resuming never sends a model request. Show save errors and uncertain state honestly.
6. Retain granular per-request source consent, remove misleading private-link/legacy consumer claims through recovered code, and align public/account messaging with personal and professional use. This is terminology/flow continuity, not another visual redesign.
7. Close the minimum operational launch gaps: reviewed privacy/terms links, real support ownership/inbox and an owner-verified account-data request procedure. The procedure may initially be assisted; do not label it automated. A founder/legal review is a real policy-content dependency.
8. Fix shared usage gaps for provider-call entry points and set a bounded beta budget/kill switch. Retain existing quotas; meter Table children, summaries/titles, draft/proposal calls and image reservations. Evaluate the configured model before choosing a cheaper policy; no blind downgrade or new provider.

## Primary customer journey

The user arrives with a real task, signs in or creates an eligible beta account, confirms access, and returns to their draft. Aethelios answers using only explicitly selected context. The user reviews a Mission/deliverable, saves it, closes the tab, and later finds the same work/version in Saved Work. They can continue, export a reviewed Markdown version, manage confirmed memory, and get account help. Lack of AI access, connection or budget is explained without fabricating answers or losing drafts.

## Frontend work

Reuse existing account/sign-in/claim/first-session components, Talk workspace/context controls, Mission/deliverable components, Saved Work projection and current shell/material tokens. Add only missing recovery screens and clear grant/allowance/error states. Connect policy/support links to real reviewed content. Verify 360px phone, ~820px unfolded/tablet and 1440px desktop, short-height composer, focus, keyboard and reduced motion. Preserve working mobile PWA/session return and current installed icon.

## Backend, database and integrations

- Reuse current identity/person/access/intelligence/Missions/Studio services and existing API routes. Recover the candidate's preflight and ordinary-session acceptance scripts. No new agent framework, database, background worker or general executor.
- Candidate carries `20261007190000_mission_continuity.sql` and `20261007210000_mission_deliverables.sql`. Audit actual deployed tables/constraints/RPCs/grants first; apply only verified missing compatible additive contracts after rehearsal. Keep existing immutable versions, optimistic revision checks, owner composite references and deletion behavior. Never edit an applied source migration to disguise drift.
- Authentication: existing Supabase, confirmed redirect origins, CAPTCHA and email/provider setup. Provider: existing direct OpenAI Responses/image configuration, real model availability/latency/usage verified on synthetic bounded tasks. Billing remains existing Stripe; beta activation does not charge customers.
- Cost accounting may require one narrowly scoped additive provider-call/budget contract if the existing ledger cannot reserve all entry points. Specify the exact schema after service inventory; avoid redundant usage tables and retain unknown-call reservations until reconciled.
- Local/disposable isolation before hosted acceptance. No production secrets copied into the cloud repository; no service-role application reads, private founder data, forged headers or relaxed RLS. Retire anonymous/private cache risks; preserve no-store responses.

## Security boundaries

The authenticated session resolves the owner. Entity work is not part of E1 and creates no new cross-owner authority. All context/Library/document links are rechecked server-side; no person-wide memory enters company work by default. AI output cannot approve its own promotion/action. Grants and budget policy are server-controlled. Approval and stale-revision checks cannot be bypassed through retries. Uncertain saves/provider calls require state reconciliation, not automatic replay. Hosted `/dev` remains unavailable.

The public database shares historical migration ownership with Reserve. A separate isolated rehearsal protects that history; never reset it or alter the private product. Public profile/marketing updates do not require private Coworker changes.

## Acceptance criteria

- A fresh eligible beta account can complete actual email/CAPTCHA confirmation and enter; a second account can do the same; existing member sign-in still works. Returning session and lost-access recovery are demonstrated on the hosted candidate.
- Ordinary free/noneligible accounts cannot self-enable AI, Studio, paid/founder or other-user access. Beta policy is explicit and observable.
- A bounded **real** provider task streams to a confirmed saved turn; reload retains text, contributors and returned sources. A specialist/Table task records selected contributors truthfully. A provider outage/timeout does not claim completion or lose the recoverable draft.
- The customer saves a reviewed Mission and immutable document version, exports that exact version, closes/reopens and finds it in Saved Work. No opening/resume automatically sends or promotes memory.
- Source selection excludes unselected saved data from retrieval. Company scope remains isolated; policy is disclosed for private text already in conversation history.
- Two ordinary sessions cannot read/write each other's conversations, Missions, versions, references or private assets. Anonymous and hostile-origin mutation attempts fail. Hosted harness returns 404.
- Every provider path uses shared allowance/concurrency reservations; duplicates do not double-execute; uncertain/failed calls are visible and cannot appear as free usage. The approved beta cost bound is exercised rather than merely documented.
- Privacy/terms are reviewed and linked; support contact works and owner verification/retention/account-data request handling is recorded. No invented legal approval or support inbox.
- Main's current e2e/founder CI failures are diagnosed for the integrated candidate; security/persistence assertions are preserved. All required candidate gates pass with receipts classified as local, synthetic or hosted.
- Phone/unfolded/desktop and at least founder iPhone/Fold install/session/recovery review pass; current materials and icon are preserved.

## Testing and release strategy

1. Research → inspect → implement the approved E1 scope on an isolated branch; record the exact candidate and change inventory.
2. Run lint/types, all relevant unit/SQL tests, a fixed production build, current interaction tests and migration contract/hash checks. Use the existing component fixture on a candidate-specific port to avoid stale shared servers.
3. Run existing real Auth/PostgREST tests against disposable local Supabase. Docker is currently available; a Docker-backed check is stronger than PGlite and need not wait for a paid cloud branch.
4. Hosted rehearsal on a verified isolated public-project environment with two synthetic ordinary accounts and bounded provider spend. Existing green #64 CI is evidence for its own head, not acceptance of the newly integrated candidate. No customer records or production credentials in fixtures/logs.
5. Review screenshots and actual device behavior, measured provider quality/cost, redacted receipts and remaining exceptions with the founder. Founder approves the concrete release candidate.
6. Apply only reviewed needed additive schema contracts, then merge/deploy the approved code through the established GitHub/Vercel workflow. Verify domain → commit → current schema, real sign-in/save/reload/export, support and no harness exposure.
7. Roll back application/server contract together to the prior deployment if necessary; retain additive tables and saved records. Disable affected entry paths/grants instead of deleting customer data.

Definition of done: this full hosted account-to-saved-outcome journey has evidence, no unresolved ownership/save/blocking-entry defect, bounded beta spend and working support/privacy operations, and an exact founder-approved release verified live. A preview build, attractive screenshot or synthetic model fixture alone cannot close E1. Open paid enrollment is E3, not an accidental side effect.

## Preparation needed after approval

- Authenticated read access to the public Vercel project's configuration and Supabase catalog/Auth settings; Stripe test access when E3 is reached. This assignment had GitHub access and public read probes, not those administrative connections.
- One independently verified isolated staging target and two synthetic ordinary identities. Prefer existing/free capacity where eligible; do not buy a branch by default. If none is available, local work continues and only the hosted gate waits.
- Founder-confirmed beta eligibility/allowance budget, support owner/contact and reviewed policy content. These are concrete launch settings, not reasons to postpone implementation.
- Exact implementation and release receipts before requesting production promotion. No additional generic permission gate is required for routine approved development.
