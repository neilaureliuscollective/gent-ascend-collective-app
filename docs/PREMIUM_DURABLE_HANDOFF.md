# Premium durable Talk → Architect handoff

This continues PR154 on its existing branch. Main `4a7d909a5ff779a39e3262a055705687260c0ada` (released PR155 globe) is reconciled in `98972f7`. Live/Cedar/voice transport, the original emblem, approved photographic entrances, charcoal materials and released PR152 attachments are preserved relative to that main. PR153 knowledge/continuity and the other pending feature branches remain separate.

The earlier permanently blocked premium handoff is replaced by a fresh database authority check. **The migration is proposed, not applied to any live database.** An unmigrated or incompatible database still refuses premium receipt review/transfer before project binding. No client capability or verified flag enables it.

## Receipt contract and authority

`20261016051741_premium_design_receipt.sql` retains the original private derivation as `ai_talk_derived_design_receipt_v1`. Genuine v1 content and digest bytes are unchanged. The existing public retain/acknowledgment signatures remain compatible. No historical rows are rewritten, upgraded or deleted.

Premium snapshots keep the bounded optional `designSnapshot` on `talk-architect-direction/v1`, with renderer `premium/v2`: selected composition, exact copy, all color/surface/border roles, typefaces/scale, spacing, shape/material, product and authorized asset references. Source conversation, immutable board/version and scoped direction identity remain digest-bound. The receiving proposal is not a generated application or a completed build.

Premium digests use canonical JSON with recursively sorted ASCII schema keys and ordered arrays. JavaScript and PostgreSQL derive the same UTF-8 SHA-256, including Unicode and escaped strings. Legacy receipts deliberately keep their original JSON.stringify-compatible serialization. Premium source strings must already be canonical, trimmed, bounded UTF-16 strings as saved by Talk; malformed direct-RPC source data is refused rather than silently remapped.

`ai_talk_review_premium_direction` is an authenticated, read-only server derivation. It resolves the owner from `auth.uid()`, validates the exact board/version, rejects candidates and unsupported/downgraded renderers, requires a personal unarchived Talk workspace, and checks private Studio version ownership/status/personal-project scope. The response marker `talk-premium-receipt/v1` is insufficient by itself: the application validates the entire derived receipt and digest against its own authorized source mapping.

Review, receive, retained reads and generation-context preparation recheck this authority. Missing RPC/schema capability fails closed. Archived/workspace-revoked sources and removed/foreign/incomplete private asset versions block subsequent premium reads and proposals without erasing prior receipts or last-good application artifacts. Media pixels remain behind the existing session-owned image route; transfer neither copies nor publishes private media. Missing photography stays honestly labelled.

The retain RPC ignores caller `p_verified`/`p_source_kind` as authority. Premium mismatch is refused; successful premium storage uses the server-derived receipt. The acknowledgment RPC rederives premium identity/content/digest again before recording success. Internal helpers and historical implementation aliases are not callable by normal users. Existing RLS and feature/owner/project/budget/approval/isolation/worker rules remain.

## Recovery and version behavior

Owner serialization and a project lookup prevent different request IDs from creating duplicate premium receipts for one destination. A repeat of the original request remains idempotent. If Architect retained a direction but Talk's acknowledgment was interrupted, reviewing that exact saved source recovers the retained request ID and allows the same request to finish.

A newly saved board revision has a new exact identity/digest and separate deterministic destination. It never replaces a previously retained direction. Earlier immutable versions remain explicitly addressable; a newer version does not silently retarget an earlier approval. Wrong identity/version/digest, altered tokens/copy/assets, foreign owners, candidates, unknown renderers and revoked visibility are rejected. Selection, edits and original source-turn lineage remain on the saved Talk version chain.

The receiving workspace shows the retained design and one action, **Review build brief**. Diagnostic digest/version data stays under Details. Received/awaiting approval, building, preview ready and blocked remain distinct. Import/navigation does not generate a proposal, enqueue a job, enable a worker or spend a provider budget.

## Verification and limits

- 89 focused tests across 15 files passed at the implementation checkpoint: JS/PostgreSQL premium parity for all three compositions, legacy v1 parity, strict source validation, flags/tampering, exact revisions, duplicates, source/asset revocation, failed/missing authority, attachments, drafts and streams. PGlite tests are SQL emulation, not real Auth acceptance.
- Local full lint, strict TypeScript, optimized Next build and recorded migration-ledger check passed. The latter verifies the existing hosted ledger snapshot; it does not claim this new migration is hosted.
- Both full and reduced disposable local Supabase startup attempts failed at registry/image-storage limits. Only task-created disposable image caches were cleaned; no live database or credentials were changed.
- `playwright.premium-auth.config.ts` and the Quality database job exercise the real session/Next/PostgREST journey in disposable CI: create, select, edit/save v3, reload, review/retain/acknowledge, exact receiving design and source updates, interrupted acknowledgment recovery, duplicate/tamper/foreign rejection, archive revocation and zero build jobs. This uses a labelled deterministic model fixture, never a paid provider.
- Initial integration CI applied the migration and passed all four existing Talk Auth journeys. Its first premium test attempt stopped at a Playwright server-module import error before running; that harness import was removed. Pure generation-context fidelity stays covered in Vitest; the Auth test checks the durable server receipt directly. Final exact-head status and artifacts are recorded on PR154, never inferred from this earlier run.
- Working-surface regressions include phone/Fold/desktop canvases, short keyboard-like viewports, draft/send/save/recovery, asynchronous reading anchors, attachments and compact/full-screen mocked Live coexistence. Current results and evidence labels are in the evidence index and PR.
- External read-only production/alias smoke is blocked locally by DNS/proxy access. Only the obsolete route-background assertion was changed: shared `--aether-smoke-canvas: #111111` → `--io-environment` → `.imperial-workspace`. Navigation, privacy and public-alias assertions are retained. No application recolor is part of this phase.

Physical devices/native IME, real provider output quality, private media pixel availability, production compatibility and production acceptance remain unverified. A successful deterministic fixture is not evidence of live generation or paid-worker readiness.

## Release checklist

- [ ] Review PR154's exact final SHA and terminal hosted checks, including the new premium Auth journey and rendered artifacts.
- [ ] Review the additive migration and its existing prerequisites against the target's actual ledger; obtain separate authorization before any hosted SQL. No blanket migration push is authorized by this task.
- [ ] Apply the reviewed migration in the approved release sequence; confirm PostgREST schema reload and owner-authenticated `talk-premium-receipt/v1` parity using an authorized disposable acceptance record. Until this succeeds, leave premium transfers gated.
- [ ] Verify Origin persistence is already commissioned/configured in the receiving environment. This work does not turn on Origin, provider generation, execution policy or workers.
- [ ] Run the combined attachment/mobile/keyboard/Live and historical v1 plus premium saved-direction journeys on the release candidate. Confirm no paid calls/jobs and preservation of prior artifacts.
- [ ] Recheck public entry, navigation, privacy and both production aliases from a network-capable runner after the separately approved release. Inspect phone/Fold/desktop working surfaces, not only entrances.
- [ ] Obtain merge/deployment approval. Neither action is performed here. No production-ready claim is made while required gates remain incomplete.

If compatibility/read verification fails, the saved Talk board and prior receipts remain; generation is blocked and last-good preview artifacts are preserved. Rollback must preserve those records and the legacy helper contract, and separately review effects on premium source revocation checks. Never downgrade provenance, rewrite existing digests or delete artifacts as a workaround.
