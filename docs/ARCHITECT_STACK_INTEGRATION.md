# Architect stack integration

Date: 2026-10-14. Branch `cursor/architect-integrate-stack-501f` onto current main `529d5f1` (Talk/Live #126). This draft does **not** merge #122, #124 or #128 into production. Talk/Live and Connections remaining work stay on their own branches.

## Overlaps with current main

#122 was conflicting with main. Exact overlapping files versus main since #122’s merge-base `f583d57`:

| File | Ownership |
| --- | --- |
| `docs/STATUS.md` | prepend-only status ledger; both Architect stack and newer Talk/Live/Command entries kept |
| `docs/DECISIONS.md` | prepend-only decisions ledger; same resolution |

No application, migration, or test files overlapped. Talk #126, Live #125 and Command home required no code merge.

#124 and #128 added only those same two changelog files against main besides Architect-owned paths.

## Source commits included

From `35c369c` on `cursor/architect-propose-repair-501f`, not already on main:

1. `38b32c9` feat: Architect source-aware review with complete-file patches
2. `7bc82ae` docs: record Architect source-review verification evidence
3. `ea99d85` fix: keep protected source out of model context and retain last preview
4. `7bffe6b` fix: bound excerpt, check identity, phone modal and receipt size
5. `79e37ce` feat: add a saved quantity-and-cost estimator tool
6. `4448071` fix: make estimator receipts, retries and drafts trustworthy
7. `479856e` fix: reconcile tool saves against the project library
8. `805a96e` fix: compare estimator receipts without JSON key order
9. `977ef10` fix: scope tool Revision 1 and clear recovered save dirtiness
10. `ca0ecca` feat: add one reviewed check-driven Construct repair
11. `a1a9a8d` fix: scope cancelled construct status away from the repair journey
12. `b3313eb` fix: bind repair to failed snapshot, one journey and current revision
13. `35c369c` fix: recover approved repairs after reload and keep generation provenance

## PRs this branch supersedes for review

This integration branch is the coherent review/merge vehicle for:

- #122 `cursor/architect-source-review-501f` (`7bffe6b`)
- #124 `cursor/architect-create-tool-501f` (`977ef10`)
- #128 `cursor/architect-propose-repair-501f` (`35c369c`)

Those source PRs stay open. They are not closed, force-pushed, or merged individually to production.

## Not included

Open Talk/Live repair branches beyond what main already has. Remaining Connections work. Hosted migrations. Credential or spending changes.

## Checks

Run lint, typecheck and Construct/unit checks on the **integrated SHA**, not only on the stacked feature branch. Hosted exact-head CI starts after this push because this PR targets main. Production merge still requires founder approval.
