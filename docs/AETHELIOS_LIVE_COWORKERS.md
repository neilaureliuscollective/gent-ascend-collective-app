# Aethelios Live — Phase 4A scoped coworker review

Research and implementation receipt · October 12, 2026 · protected-preview implementation, not deployed.

## Delivered slice

A person can request **one existing Council coworker**—Athena, Prometheus, Apollo, Hermes or Themis—to review a standalone task or an explicitly selected diagram component, comparison option or chart point. Voice proposes `request_coworker_review`; text uses the same shared artifact API. Aethelios remains the conversational coordinator and the existing root controller/session continues.

Sharing defaults to task-only in the form. Selected-part sharing requires an actual completed, selected visual part. Before paid approval, the person sees the named recipient, exact task, selected content and an inspectable snapshot. The server captures that snapshot; the caller cannot submit an owner, arbitrary source ID, profile or fabricated context payload. If the selection or chart assumption changes before approval, admission is refused until the review is proposed again.

The worker reuses the existing Council model/role definitions and configured server OpenAI key/model. Its tool set is empty: no web search, repository access, account retrieval, record changes, messages, further delegation or privileged backend actions. A coworker receives only the approved task and snapshot. Read-only suggestions are displayed literally, saved in the same conversation and usable in later voice/Talk context. No suggestion is auto-promoted to memory, fact or user commitment.

Review work runs independently of voice End on the existing bounded artifact worker. The result identifies the source selection and can return to its original part. Selected sources older than the recent 24-item window are now explicitly loaded with the same owner/conversation checks so returning to older work remains usable.

This first Phase 4 slice supports one coworker, not an unrestricted Entity system or multi-coworker Table. Existing ordinary Council and legacy standalone background work remain compatible. Paid record-changing actions and richer synthesis are separate follow-up slices. No financial Entity, connected accounts or native mobile background audio is invented.

## Research and choices

Official OpenAI guidance recommends treating untrusted content as data rather than higher-priority instructions, constraining data flow and keeping authorization/business rules on the application server. Existing Realtime sideband controls already fit this architecture. No new agent framework, hosted Agent Builder dependency, Gateway, provider or subscription is required.

Scope enforcement is structural: the review request uses a fixed role/scope schema, the database captures owned selection data, and the Council invocation receives no tools. Prompt guidance reinforces these boundaries but is not the authorization mechanism. A role lens never creates permission to read profile, memory, clinical records, finances or unrelated history.

Sources inspected:

- [OpenAI safety in building agents](https://developers.openai.com/api/docs/guides/agent-builder-safety)
- [OpenAI server-side voice controls](https://developers.openai.com/api/docs/guides/voice-server-controls)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Installed Council/AI SDK code and Next 16.3.5 `after()` documentation.

Supabase changelog Markdown retrieval failed; no packages or Supabase product APIs were upgraded. OpenAI Realtime remains the gated runtime; GPT-Live remains an evaluation adapter pending account/audio/sideband/billing/latency acceptance.

## Snapshot, privacy and lifecycle

Additive migration `20261012000324_live_coworker_reviews.sql` extends the existing owned artifact table with role, sharing scope and immutable captured context. No new history silo or controller was introduced. Selected-part context contains the selected part, its relevant comparison considerations or chart unit/period and original/hypothetical value, plus the source catalog when present. It does not include other visual parts, personal profile, memories, unrelated transcript or image pixels. Snapshot JSON is capped at 12,000 characters; oversized sharing is refused rather than silently expanded.

Task-only snapshots are empty. Image-pixel review and recursive review-of-review handoffs are excluded from this slice. Shared task strings can contain user-provided information; the user reviews exactly what will be sent to the existing OpenAI provider. `store:false` is retained and does not imply zero provider retention. The approved snapshot is retained with conversation history; deleting the conversation removes content/snapshots while the non-content usage ledger survives.

Approval uses the same atomic reasoning-operation reservation, current pilot grants, one-running-visual limit and existing daily/minute/proposal caps. A pending Talk turn is not created, and duplicate approvals/completions cannot reserve or save twice. No new action authority is granted to the coworker. Model output is validated against the approved recipient and source/scope binding before save.

The review has a 35-second overall signal, the existing 30-second specialist timeout, 1,200 output-token cap and no retries. One review generation stage is metered. Known provider counts, including incomplete-response counts, are retained; missing usage remains unknown/partial instead of fabricated zero. Ordinary Council metering also preserves missing-count uncertainty. No settled price or billed-usage claim is made.

Execution remains bounded Next `after()` work, not a crash-safe queue. Stale work becomes uncertain; paid requests are not automatically replayed. Independent production expiry, crash recovery and actual hosting/provider cleanup remain launch blockers inherited from earlier phases.

## Validation

Lint, strict types, CSS syntax, ledger and diff checks pass. Full suite: **71 files / 468 tests pass**. New tests exercise allowlisted roles, explicit context scopes, task-only omission, absence of tools, no additional delegation, literal rendering, changed-selection/scenario fencing, cross-account denial, immutable source binding, duplicate admission/save, unknown and incomplete-response usage and return to an older owned selection. Existing Council, visual, research and Studio regressions remain included.

Browser scenarios at 390px and 1440px are written for snapshot consent and contribution display but unrun. Fresh build attempt still fails at the existing pinned MediaPipe download (`EAI_AGAIN`); fresh loopback verification still returns `EPERM`. No check was removed or bypassed. A stylesheet write error caught in review was corrected by restoring the existing CSS; only the new review styles remain in the final diff.

PGlite validates the migration chain/SQL rules, not hosted Supabase Auth/Storage/advisors. The additive migration remains unapplied to hosted Supabase. No configured provider credentials are available: actual coworker quality, voice continuity, latency, billing, screenshots/accessibility and physical mobile tests remain unverified. Cinematic assets, voiceovers and separate repositories were untouched. No production merge or deployment occurred.

## Acceptance and next phase

Select a chart point and hypothetical assumption → request Themis → inspect recipient/task/snapshot → change selection and confirm approval is refused → restore or repropose → approve → continue speaking/minimize → End voice → inspect the saved suggestion → select the original source part → continue in Talk. Repeat with task-only sharing, denied ownership/grants, declined approval and provider interruption. Compare actual model content against the approved scope before release.

Next priority is real provider/hosting/build/browser acceptance. Phase 4B's first reviewed-action slice is now implemented locally: one editable human-entered title, the existing current-local-day restriction, exact source/day/version guards and a verified receipt. See [AETHELIOS_LIVE_ACTIONS.md](AETHELIOS_LIVE_ACTIONS.md). Future scheduling and broader actions remain deferred. AI suggestions stay separate from user commitments; no unrestricted command execution or automatic action promotion.
