# Public Aethelios — Phase 1 integration candidate

Founder approved execution on October 8, 2026. This is the public repository `neilaureliuscollective/gent-ascend-collective-app`. No private founder platform, production deployment, live billing change or service purchase is included.

## Baseline and consolidation

Default branch: `0f2500e40140205d86444f63fa98cb7d3f527b7e`.
Candidate derives from PR #63 head `4a56de8689afb10a49cd262b2119a56f0cde922f`, containing default branch and PR #62 head `a316bd09be099d49edf3682dc7f437a8f3d1da65` as ancestors. PR #62 must not be integrated a second time. Preserve the source branches/PRs until candidate acceptance.

PR #60 head `56714026d97f9ec3af4eac22329ae406bc946a9e` is selectively reconciled:

| Foundation behavior     | Candidate treatment                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Old navigation/landing  | Superseded by Talk/Work/Studio and approved Petrol identity; no wholesale file import                                                |
| Source category consent | Explicit per-request profile, goal, memory, daily and lifestyle selection; excluded categories are not queried for model context     |
| Specialist preparation  | Separate saved specialist-record consent, off by default; text-only preparation remains available                                    |
| Private founder bridge  | Retrieval disabled; retired start/callback return 410 and expire historical cookie paths; existing explicit revoke cleanup preserved |
| Inclusive entry         | Public positioning, prompt, identity introduction and first-session project option support universal personal/professional work      |
| Company systems         | Exact company/conversation scope, immutable brief snapshots and existing work/Studio remain intact                                   |

## Visible result

Work includes personal Missions and company rooms. Saved work at `/app/library` searches bounded metadata from Missions, retained documents, conversations, Studio projects and company jobs. Links carry exact existing record identifiers and scope; opening never sends an AI request. Detached Mission deliverables remain discoverable. This is a read projection, not a new database or generic work schema.

Mission Continuity and Deliverables from #63 retain reviewed direction, source revisions, linked Studio, explicit promotion of completed replies, immutable versions and user review. Version history now loads summaries plus one current body; historical text and Markdown export retrieve the exact owner/document/version. No document analysis, PDF intake, general file upload, external autonomy or automatic memory is added.

Unsaved deliverable text and review notes prompt before link navigation and browser unload. Back/route return can recover an explicitly restored, account/document-scoped draft in memory. Up to three drafts remain for thirty minutes; the next recovery check removes expired entries. Account changes clear the cache. Nothing is placed in localStorage, sessionStorage, URLs, cookies or model prompts. A changed base version is disclosed before restoration. Browser/process closure still loses unsaved session drafts; saving a version is the durable path.

Saved source consent remains off by default and is not silently persisted between newly mounted Talk surfaces. Legacy clients enabling context without explicit categories share none. Mission context is a separate visible, reviewed scope. Details already written in a conversation cannot be removed by switching saved sources off; a fresh conversation is required. Read-only account context previews remain distinct from model consent.

## Migrations and rollout

Reuse these two additive scripts unchanged, in this order:

1. `20261007190000_mission_continuity.sql`
2. `20261007210000_mission_deliverables.sql`

Do not edit applied migrations, reset hosted databases, or blindly push the entire local ledger. Production has timestamp/content differences and Reserve-owned historical migrations. Reconcile exact definitions/identity first. Existing ledger check validates a recorded 28-file snapshot, not the live database or these new deployments.

Before any production promotion: isolated database acceptance, real two-account Auth/PostgREST/Storage checks, migration/grant receipts, bounded live-model checks, physical phone/Fold/desktop review, and an explicit release decision. No existing Supabase development branch was available at inspection. Creating paid infrastructure or authorizing live-provider test spend requires a concrete separate scope. CI's disposable local Supabase can provide real local Auth/RLS receipts without touching production; it cannot close hosted acceptance.

On promotion, additive schema precedes dependent code. On failure restore the prior deployment/SHA and disable affected entry points; keep new schema and saved records. Never drop deliverable tables or reset production to roll back. Old code ignores the new source selection fields because they are additive client/server contracts; restore code and server together. Preserve existing billing settings and aliases.

## Validation and limits

Historical #63 full browser run: 259 pass / 107 fail. Reconciliation inventory is `PHASE_ONE_REGRESSION.md`. Retired storefront/story assertions are replaced with current truthful contracts; auth, isolation, private cache, offline, uncertain-write and no-auto-send controls remain mandatory. CI application/database jobs are bounded to 60/40 minutes; database browser evidence is retained. The six-hour cancelled job's exact root cause is not proven.

Local results and outstanding gates are recorded at the top of STATUS.md. A passing build or intercepted browser journey is not production acceptance. Pricing, provider routing and monthly cost budgets are later commercial/reliability work.

## Provider exposure inventory

| Entry point                             | Existing bound/receipt                                                                                            | Remaining commercial gap                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Talk / Council                          | Atomic turn reservation; daily/rate and pending-request guards; saved usage; bounded recent history and summaries | Monthly tier budgets, failed-call cost visibility, search cost accounting and measured p95 latency |
| Titles / thread summaries               | Auxiliary reservations and input/output usage                                                                     | Cheaper-task routing and monetary budget                                                           |
| Mission direction proposals             | Explicit request, proposal reservation, usage receipt and review                                                  | Monthly allowance/cost visibility                                                                  |
| Studio image generation                 | Explicit generation, concurrent/day guards, private saved output                                                  | Image token/tool usage not completely recorded; cost-based entitlements                            |
| Performance/Presence/Studio preparation | Explicit request with separate saved-record consent and provider timeout                                          | Existing preparation path lacks shared cost reservation/usage receipt                              |
| Company work/model/visual paths         | Exact job/brief scope and existing revision contracts                                                             | Reconcile all model/image/tool costs with subscription budgets                                     |

No provider defaults, live tiers, prices or customer demand assumptions are changed in Phase 1.

### Validation follow-up — 2026-10-08

The first published candidate (`8781a294`) passed the GitHub Actions real local Supabase reset and authenticated integration script. Receipt: run `37796238541`, database job `113376304944`. The two additive Mission migrations applied successfully. The integration script passed Mission context, immutable deliverable replay/review/history, retained detached work, Studio continuity, and authenticated cross-account/anonymous denial. This is a real local database receipt, not a hosted-production acceptance receipt.

Ten of eleven authenticated browser flows passed on that candidate. The remaining flow exposed a pre-existing unreachable FirstSession component after Welcome moved to Talk-first onboarding. Restore that existing owner-scoped planning component under optional “Plan a first next move”; preserve the primary Talk entry. The expanded authenticated flow must pass again on the corrected candidate.

The frozen broad local browser run produced 307 passes and 39 failures with a 30-second override and four restricted single-process workers. Most failures were stale surface selectors or assertions about retired static storefront pages; some were Chromium process/teardown failures. Keep the configured 90-second limit and rerun affected suites with two workers. Correct quiet-mode checks to assert the existing `animation-name: none` contract rather than adding a redundant animation-play-state CSS override. Preserve the approved textured maskable PNG by checksum; physical launcher mask acceptance remains a separate device gate.

One genuine handoff defect was found: service-worker fallback v4 cached the previous icon. Fallback v5 caches the approved Aether icon, removes obsolete fallback caches without reloading drafts, and retains static-only caching. Offline/installation copy now names Aethelios. Do not interpret these browser fixtures as proof of provider, billing or hosted Supabase readiness.

Corrected candidate `d91f46ef` passed real local migrations, Auth/PostgREST integration and 11/11 authenticated browser flows in run `37797715436`, database job `113381414394`. Final follow-up keeps the existing next action when reopening optional planning, verifies the authenticated saved-work route, checks scoped finder links/filtering at phone/desktop widths, and corrects the compact Talk brand assertion. Final full-browser acceptance remains pending until the final tree has a receipt.
