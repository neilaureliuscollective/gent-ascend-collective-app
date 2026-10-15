# Architect source-aware review

Date: 2026-10-14. Branch `cursor/architect-source-review-501f` on `neilaureliuscollective/gent-ascend-collective-app`. Base: released main `f583d57ab5b5899134449afa1d20a6ffc1363905` (PR #120). Talk #121 stays separate. No production merge, hosted migration, credential change, paid model call, or Construct/Connections/Live activation.

## Shared-file overlap before this edit

Talk #121 (`28361628c6db6d16dd1db76be8e471440c58d37f`) overlaps this pass only on documentation (`docs/STATUS.md`, `docs/DECISIONS.md`). It does not own `src/domains/architect-construct/*` or the Architect workbench. Those doc files are appended, not rewritten. `package.json`, Quality/Origin workflows, `database.ts`, and Talk/intelligence sources were left untouched.

Construct #116, Connections #117 and UI #119 are already in main via #120. They were not merged again.

## Completion pass (same PR)

Reviewed head `ea99d85` kept path protection, last-good preview and Fold review. This follow-up does not start a new build phase:

1. **Excerpt budget on every content path.** `applyExcerptBudget` ranks content-bearing excerpts (`excerpt` and `too-large`) before provider assembly. Count and total UTF-8 bytes stay inside eight excerpts / 32 KiB. Assembled prompts set `manifest.excerpt` to null so metadata cannot smuggle snippets. Editable whole files are not truncated to make room.
2. **Collision-free check identity.** Display names may still truncate at 80 characters. Comparison uses `checkIdentity` (kind + command + full target). Duplicate or insufficient historical identity is labelled comparison-unavailable; a new failure is never silently pre-existing. Stored receipts are not rewritten.
3. **Phone review is a real modal.** Construct reuses `ContextSheet` (`showModal`, focus move, Tab containment, Escape, close control, focus restore). Crossing 639px while open closes the sheet so desktop review does not keep an inert background.
4. **Durable receipt bound.** `boundRunResult` shrinks baseline/post logs, then diff/preview, to the existing 120,000-byte SQL `result` limit. Truncation is marked. Status is never flipped to passed. Store rejection is `too-large`; the worker persists a failed bounded receipt instead of reporting success or leaving the run stuck.

## Correction pass (same PR)

Reviewed head `7bc82ae` kept the complete-file contract and Source / Change / Evidence review. This follow-up does not start a new build phase:

1. **One shared browser-safe path-protection predicate** (`path-protection.ts`) is used for context eligibility and edit protection. Intrinsic `.env` / `.env.*` / nested environment files, `.pem`, `.key`, `.git` and `secrets` stay out of prompts, excerpts and manifests even when a browser allowlist includes them. Server-side `effectiveProtectedPaths` still unions the execution defaults. Protected contents are never logged.
2. **Last successful preview is retained** via `selectRetainedConstructPreview`. A newer queued, running, failed or cancelled run no longer blanks the pane. The displayed revision is labelled, and older output is never described as the current attempt. Held output is owner/project scoped and cleared on switch.
3. **Fold / phone / desktop review.** The selected Source, Change or Evidence task is the main surface. Fold (≤1023px) shows one stacked secondary preview instead of squeezed columns. Phone sheets stack filename and inclusion label. Diffs stay in a padded scroll area, including a short keyboard-height viewport.

## What this pass adds

1. **Source context that matches the whole-file edit contract.** `prepareSourceContext` selects at most eight complete files totaling 48 KiB (64 KiB per file). Truncated excerpts are labelled and never used as `before` text. Relevant files past the former eight-file cutoff become an explicit omitted/missing-context state. Missing imports are listed so the owner can add them through the existing authorized path. Browser-claimed repository provenance is still ignored.
2. **Existing-file validation before approval.** Create and delete stay unsupported. Empty replacement content empties a file; it does not delete it. Stale before-text, truncated stand-ins, foreign paths, protected paths, duplicates and empty proposals are refusals.
3. **Honest checks.** The no-op `present` / `true` default is gone. JavaScript files get `node --check`. Typecheck, build and functional tests are recorded as unsupported inside the approved sandbox (`node` / `true` / `false` only). “No applicable checks available” is a valid non-pass. The worker records the same checks before and after the patch so introduced failures stay distinct from pre-existing ones. The check plan is part of the approved brief.
4. **Interactive review.** Construct keeps the last valid isolated preview dominant and adds Source / Change / Evidence context: requested outcome, inclusion labels, before/after diffs, and coverage. Narrow viewports use an accessible sheet. Draft, selection and panel scroll are preserved.

## Exact supported limits

| Bound | Value |
| --- | --- |
| Inventory files | 32 |
| Complete editable files | 8 |
| Complete editable bytes (total) | 49,152 |
| Complete editable bytes (per file) | 65,536 |
| Context excerpts | 8 files / 32,000 bytes total (2,000 characters each; instructions up to 4,000) |
| Durable execution receipt | 120,000 UTF-8 bytes (existing SQL `octet_length(result::text)` limit) |
| Provider output tokens | 8,000 |
| Patch files | 1–16 existing files |
| New files / deletions | Unsupported |
| Sandbox commands | `node`, `true`, `false` |
| Applicable checks | `node --check` on existing `.js` / `.mjs` / `.cjs` |

This is not a universal app generator and not complete-repository understanding.

## Configuration versus remaining code

Already required for Construct, unchanged and still default-off: `ARCHITECT_ORIGIN_ENABLED`, `ARCHITECT_CONSTRUCT_ENABLED`, additive Construct migrations, local worker token, Docker for isolated execution, `ARCHITECT_CONSTRUCT_AI_MOCK` for labelled development proposals. Paid `ARCHITECT_CONSTRUCT_AI_ENABLED` remains unauthorized.

Remaining code work is not configuration: bounded check-driven repair against the recorded plan, still inside the same sandbox and approval digest.

## Verification in this run

Ran:

- `npm run lint` — pass, zero warnings
- `npm run typecheck` — pass
- `npm test` — 937 unit/SQL tests
- `npm run db:ledger` — pass; no new hosted migration
- `npm run build` — production build pass
- Origin browser: 27/27, including protected-context regressions, retained-preview lifecycle, Source / Change / Evidence at 390/720/1440, phone modal keyboard/Escape/focus-restore/resize, and a 390×480 keyboard-height viewport

Screenshots: `docs/evidence/architect-construct/architect-source-review-{source,change,evidence}-{390,720,1440}.png`, `architect-source-review-keyboard-390.png`, plus the original 390/720/1440 full-page names.

Unrun / blocked:

- Exact-head hosted CI (starts after this push)
- Disposable local Supabase Auth/PostgREST Construct acceptance (`test:integration` needs `.env.development.local`)
- Host Docker isolated execution in this executor
- Paid OpenAI proposal calls
- Physical Fold / Safari / device review
- Talk #121 import-receipt correction (separate owner)

## Next phase

Bounded check-driven repair is implemented on the follow-on branch `cursor/architect-propose-repair-501f`. See [ARCHITECT_PROPOSE_REPAIR.md](ARCHITECT_PROPOSE_REPAIR.md). This source-review pass still only records the check plan, baseline/post results, and introduced-versus-preexisting failures.
