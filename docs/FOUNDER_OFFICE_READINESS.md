# Founder Office phase two: readiness and recovery

2026-10-12. Canonical public application only. Candidate source; not deployed.

## Research and decision

Reviewed the existing Founder Office release gates, owner-bound reads, task graph validation and immutable work-version/CAS services. Saved task dependencies already express a bounded graph (24 tasks), so a deterministic domain calculation is sufficient. No queue, recursive database function, new table or additional agent runtime is justified for readiness alone.

Official sources reviewed today:

- [PostgreSQL graph traversal and cycle detection](https://www.postgresql.org/docs/current/queries-with.html): dependency traversal must terminate on cycles. The shared existing graph validator rejects invalid plans, and reopening uses a visited set.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): preserve session-bound ownership reads and writes. No policy, grant or query privilege changes are made. The changelog Markdown endpoint could not be fetched by the browsing tool; no complete changelog audit is claimed.
- [Next.js useTypeScriptCli](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli), corroborated by installed Next 16.3.5 docs: compiler-API checking is supported via experimental.useTypeScriptCli=false. Installed TypeScript 6.0.3 has the API; this does not ignore errors or support upgrading blindly to TypeScript 7. Independent strict CLI checking remains required.

## Implemented behavior

- The shared task domain classifies saved tasks as ready, blocked, needs review, completed or invalid. Unknown task IDs are unavailable. Readiness never invokes a provider or starts background work.
- Founder Office mission cards expose those states and assignees; the existing portfolio briefing receives bounded readiness and approved proposals still awaiting an executor.
- Approved proposals remain in attention even when the deliverable was reviewed. Approval is not evidence of deployment, communication, spending or other external execution.
- Reopening a completed prerequisite now reopens its completed transitive dependents for review in the same saved work version. Independent work and approvals are preserved. The button states the effect explicitly. This repairs the former graph-validation dead end.
- Completed task generation is denied by the server until explicit reopening. Invalid dependency plans and unmet prerequisites also fail before provider invocation.
- Committed the documented compiler-API build mode to resolve this runner's Next CLI config parsing failure while retaining checking. No dependency upgrades or asset-download bypass were added to npm run build.

Source: src/domains/company-work/tasks.ts; src/domains/founder-office/{service,tasks,briefing}.ts; src/components/founder-office/{office,mission-tasks}.tsx; next.config.ts.

## Acceptance boundaries

Tests cover mixed task states, unknown IDs, cycles, missing dependencies, transitive reopening, immutability, preservation of independent tasks, completed-task provider denial and approved-proposal attention. These are local domain/service tests, not live provider or Supabase Auth acceptance.

The full npm build still fails during the existing Mirror prebuild asset download (storage.googleapis.com DNS unavailable). Direct webpack compilation tests the candidate application and compiler mode but skips that asset preparation. Browser tests cannot start their local web server. Real Auth, model and physical-device gates remain as recorded in FOUNDER_OFFICE_RELEASE.md. No new migration, hosted data change, push, PR or deployment.

Next: supply the pinned Mirror model through the established checksum-verified asset preparation; run the normal build, configured real Auth/provider and phone/Fold journey; resolve the existing broad CI baseline; obtain explicit authorization before the compatibility-reader/activation production release.

Final local receipts: lint and strict TypeScript passed; 451 tests across 63 files passed, with the final fixture typing correction rechecked by strict types and 11 targeted service tests. Direct webpack build completed successfully with the committed compiler mode. Migration ledger passed for the unchanged 28-file snapshot. Browser and normal-build failures were reproduced; no screenshots, authenticated live persistence or model results are claimed.
