# Architect source-aware review

Date: 2026-10-14. Branch `cursor/architect-source-review-501f` on `neilaureliuscollective/gent-ascend-collective-app`. Base: released main `f583d57ab5b5899134449afa1d20a6ffc1363905` (PR #120). Talk #121 stays separate. No production merge, hosted migration, credential change, paid model call, or Construct/Connections/Live activation.

## Shared-file overlap before this edit

Talk #121 (`28361628c6db6d16dd1db76be8e471440c58d37f`) overlaps this pass only on documentation (`docs/STATUS.md`, `docs/DECISIONS.md`). It does not own `src/domains/architect-construct/*` or the Architect workbench. Those doc files are appended, not rewritten. `package.json`, Quality/Origin workflows, `database.ts`, and Talk/intelligence sources were left untouched.

Construct #116, Connections #117 and UI #119 are already in main via #120. They were not merged again.

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
| Context excerpts | 8 × 2,000 characters (instructions up to 4,000) |
| Provider output tokens | 8,000 |
| Patch files | 1–16 existing files |
| New files / deletions | Unsupported |
| Sandbox commands | `node`, `true`, `false` |
| Applicable checks | `node --check` on existing `.js` / `.mjs` / `.cjs` |

This is not a universal app generator and not complete-repository understanding.

## Configuration versus remaining code

Already required for Construct, unchanged and still default-off: `ARCHITECT_ORIGIN_ENABLED`, `ARCHITECT_CONSTRUCT_ENABLED`, additive Construct migrations, local worker token, Docker for isolated execution, `ARCHITECT_CONSTRUCT_AI_MOCK` for labelled development proposals. Paid `ARCHITECT_CONSTRUCT_AI_ENABLED` remains unauthorized.

Remaining code work is not configuration: bounded check-driven repair against the recorded plan, still inside the same sandbox and approval digest.

## Next phase

Bounded check-driven repair. This pass now records a reviewed check plan, baseline and post results, and introduced-versus-preexisting failures. The next slice can propose a repair only for introduced failures on the same immutable source, without autonomous loops, new-file creation, or expanded sandbox privileges.
