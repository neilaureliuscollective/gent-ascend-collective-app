# Architect commissioning — current source and observed blockers

Read-only inspection: 2026-10-16. Source main `175fda72eeb37f389d76d73572dd882fe68cef15`; Architect #130 merged as `58a59df9cb1d56694f13c71c8f36d85d7b321daf` from `8e9e56cc3fc3d6f18db57ca15931c011af37e899`. This continues draft #146, not a new Architect implementation. Main was merged into that isolated branch with both STATUS histories preserved. #154 (`2cee4c9`) owns premium Talk handoff and `20261016051741_premium_design_receipt.sql`; its migration/release and the separate Talk dock are excluded. Small overlapping Architect edits must be reconciled with that owner before integration.

## Root cause

`workspace.tsx` previously rendered “Build connection pending” whenever `constructReady()` was false. That means Origin/Construct flags, **not** a GitHub OAuth failure. Construct is the existing source-patch execution path and still refuses production workers. Standalone generated applications use **Apps**, which has its own commissioned production worker path. Do not bypass Construct's production ban to enable Apps.

Saving a blueprint only needs Origin. A generated application additionally needs model admission, complete Apps schema, database execution policy, founder access, a fresh matching isolated worker and shared preview sessions. GitHub and Vercel account connections are optional read-only source context, never standalone-build prerequisites.

The repair gives application projects an Apps-specific label, corrects the misleading “not in this checkout” Construct copy, and provides an explicit owner-only **Check build readiness** GET. It reads existing worker readiness and execution policy with the user's session, reports configuration gates without secret values, and neither starts jobs nor calls a model. Normal worker preflight can write presence and was not run against production. Incomplete worker heartbeat/digest/queue/artifact/state evidence now fails closed before paid admission.

## Production facts, not inferred from source

Observed via Vercel metadata (no decrypted secrets) and narrow SELECT queries on the existing Gent database `volpzkfsnmtztrovexcw`. These are dated snapshots, not permanent authority.

| Item | Observation |
| --- | --- |
| Latest production deployment | READY `dpl_7SgntMmfpGU157dACvWVdeRkrEX8`, main `175fda72…`; production URL https://www.gentascend.com. This is the existing deployment, not this repair. |
| Saved Nexus | Existing **Ascendance Nexus**, revision 1, updated 2026-10-16 20:04:27 UTC, owner has `founder_access`, zero Apps rows. Identifiers/content were not copied into Git. No duplicate project created and no saved data edited. |
| Origin | Tables and saved project exist; production `ARCHITECT_ORIGIN_ENABLED` is true. |
| Apps config | No production `ARCHITECT_APPS_ENABLED`, `ARCHITECT_APPS_AI_ENABLED`, `ARCHITECT_APPS_FOUNDER_PILOT`, preview secret/cluster or image-digest names were present in the inspected project configuration. Existing `OPENAI_API_KEY` and service-role names exist; values/validity were not read. |
| Base Apps schema | `architect_apps`, revisions, artifacts, jobs, events and records exist; approve/start/claim/heartbeat/finish/write-record RPC names exist. Existence is not full contract/permission acceptance. |
| Missing Apps schema | Preview-session, generation-run, worker-presence, execution-policy and generation-budget tables absent. Preview, reserve/begin/finish-generation, worker-readiness and budget-lock RPCs absent. |
| Construct | No Construct tables/RPCs appeared in the inspected schema. Its production flag is absent. Not required for a standalone Apps build. |
| Worker | No Apps presence table or readiness RPC, hence no verifiable commissioned worker receipt. No persistent host is demonstrated. |
| Hosted Talk progress | Ledger has later base/retain/trusted-observe entries beyond the old six-step snapshot. The original “paused after six” note is historical only. This task did not resume or reconcile Talk SQL. |

The earlier 2026-10-14 entrance-only report and “Origin unapplied” advice are superseded by these observations. Do not reapply Origin or replay the original Talk batch.

Identity reconciliation (2026-10-16): the initial management lookup established the saved project and person-bound founder entitlement, but the initially supplied email did not match. Neil subsequently supplied his actual app sign-in. A narrow owner-scoped SELECT now confirms the Auth user → person → existing Nexus relationship, founder access, application discipline, revision 1, one saved version, zero Apps rows and unchanged creation/update timestamp. No entitlement grant or duplicate project is needed. Authenticated browser/session-RLS acceptance is still unperformed; the management lookup does not substitute for it. Personal emails and owner/project identifiers remain outside Git. This task made no data mutation.

## Required SQL review, nonexecuted

Existing ledger names include the shared Apps files `20261015080000`, `20261015120000`, `20261015140000` and Talk retain `20261015160000` / `20261015170000`; physical base Apps tables were observed. Preserve them.

Missing Apps dependency chain from current source:

1. `20261015156000_architect_apps_preview_sessions.sql`
2. `20261015156500_architect_apps_pilot_budget.sql`
3. `20261015156600_architect_apps_execution_gate.sql`
4. `20261015156700_architect_apps_budget_lock.sql`

This is a review list, not an apply script or authorization. Because Talk retain is already present, **do not apply** interim `20261015155000_architect_apps_retain_verified.sql`: it would replace the winning retain contract. The four missing files do not define `architect_apps_retain_design`; confirm hashes, function dependencies, grants and actual current definitions before any separately authorized additive completion. Their natural fresh-install ordering precedes Talk retain; the hosted database has advanced out of that sequence, so a fresh-install receipt must not be fabricated. #154's premium-receipt migration remains owned by Cursor.

Review the four files as one transaction, not four independently committed partial states. Disposable PGlite review with synthetic identity and the later retain/provenance definitions verified rollback, atomic commit, unchanged retain definition, policy false, denial of founder execution while false, removed four-argument reservation overload and relevant authenticated/anon/service-role grants. This does not prove hosted defaults or Supabase Auth. Persistent effects include five tables, indexes/RLS policies, new/replaced security-definer functions and grants. Preview RPCs remain available for owned revisions while policy is false; worker claim can still consume already queued jobs. Before commissioning a worker, inspect outstanding jobs without claiming them and stop for unrelated queued work. Disabling flags does not revoke database privileges or reverse the schema. Require fresh physical ACL/definition checks, precommit assertions and an agreed ledger-recording method before authorizing the transaction.

Origin tool/repair extras (`20261014080000`, `20261014190000`, `20261014203000`, `20261014220000`, `20261014224500`) and Construct's five migrations are distinct capabilities, not prerequisites for standalone Apps generation. Do not bundle them into an Apps activation grant. The existing [release manifest](../scripts/architect-apps-release-manifest.json) remains a **pinned historical fresh-install dependency profile**, including those wider capabilities; its main/source pins are not the current main and cannot certify this production state. A refreshed integrated release manifest and physical reconciliation receipt must be reviewed before its offline report can pass for a new candidate.

## Real pipeline and Nexus acceptance

1. Reopen the existing Nexus project using its saved-project link in Architect. Preserve revision history and all data; no duplicate or hand-coded substitute.
2. Choose App. Prepare a bounded generation request from the saved brief. `proposeArchitectApp` checks founder policy and worker readiness, reserves/begins the bounded model call, and uses `defaultAppGenerationTransport` → direct OpenAI `openaiAppTransport` (`gpt-6-astra`). It returns a proposed source tree, not a working preview.
3. Review the proposed files/changes. Approve persists a revision tied to project/version, approved hash and generation provenance. Start queues that exact approved revision. In the existing implementation, model generation happens during **proposal**, before compile approval; requesting a proposal is the paid boundary. Do not describe approval as the first possible spend.
4. The supervised Apps worker claims durable jobs with leases, compiles in Docker, stores verified artifacts/receipts and finishes the job. A queue without a worker is not a build. Failed revisions preserve the last working revision.
5. Preview uses a signed shared session for the verified revision; iframe code has no credentials/network authority. The host data bridge supports owner-bound list/get/create/update. Revise generates a bounded patch on the selected revision; explicit approval/start compiles it. Reopen restores a verified saved artifact/session and retained records.

First real request, after approvals: a focused interactive knowledge graph of AI/software concepts, search, node inspector, focus mode, create/edit concepts and saved relationships, responsive at phone/Fold widths. Require accessible keyboard/search/list fallback and additive host collections for concepts/relationships; no external network, external-content ingestion, additional package installs, 3D engine or publishing in this first build. This is a request/acceptance scope, not generated code. No Nexus app or real-model result is claimed here.

Acceptance must include one real generation and compile, search/inspect/focus, create/edit and relationships surviving reload/reopen, one bounded revision, last-good recovery, ordinary-account denial and real phone/Fold review. Existing labelled local fixtures/CI prove contracts, not that this specific real model build succeeds.

## Additional approvals

See [activation configuration and worker plan](ARCHITECT_APPS_ACTIVATION.md). Explicit separate approvals are still needed for (1) narrowly reconciled hosted SQL completion, (2) billed host provisioning, (3) credential placement/configuration and preview settings, (4) generation flags plus SQL execution policy, (5) bounded real model spend, and (6) merge/deploy of this repair after coordinating #154. None was performed by this task. Authenticated browser access for the existing Nexus owner is also required for live demonstration; the management SELECT is not a user-session acceptance test.

## Validation of this continuation

Local labelled checks: 33 API/admission/budget/policy tests and 41 related lifecycle/budget/preview/mutation tests (overlapping suites, not 74 distinct tests), plus 50 offline release-report tests, typecheck and changed-file lint passed. Phone/Fold readiness fixtures verify the action sends one GET, makes no Apps mutation, preserves the saved project and fits 390/720px. Two existing 320/390px preview-reachability fixtures also passed. Normal production build remains locally blocked in existing prebuild asset download by `EAI_AGAIN storage.googleapis.com`; exact-head CI is the build evidence gate, not a claimed local pass. No real-model or authenticated hosted Nexus acceptance was run.
