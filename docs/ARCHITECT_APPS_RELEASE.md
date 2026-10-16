# Architect Apps release state — pipeline not production-demonstrated

Inspected 2026-10-16 against main `175fda72eeb37f389d76d73572dd882fe68cef15`. #130 is merged; this continuation stays on draft #146. #154 and the separate Talk dock are not incorporated or changed.

| Level | Evidence / limit |
| --- | --- |
| Implemented on released main | Origin saved projects, Apps proposal/approve/start, durable jobs, isolated Docker compiler, verified private preview, revision/reopen and owner-bound data bridge. Code presence does not activate them. |
| Configured and observed | Origin enabled; existing Nexus revision 1 and database-owner founder access. That Auth identity is not yet verified as Neil's sign-in. Base Apps tables exist. Latest inspected READY production deployment points to main `175fda72…`. |
| Not configured / missing | Apps/AI/founder-pilot/preview/image-digest configuration; physical preview/budget/execution/presence schema; verifiable persistent worker. Existing API key name does not satisfy those requirements. |
| Repair implemented on #146 | Capability-specific label and read-only owner-scoped readiness action; missing worker evidence fails closed. Historical commissioning instructions reconciled with current source and dated facts. |
| Locally tested | Labelled synthetic API/policy/ownership/negative tests. Exact-head checks must be attached to #146 after publication. |
| Deployment | No manual deployment or production promotion. Git integration attempted a preview at `06b7776`; it failed because Supabase URL/publishable-key configuration was incomplete. Existing production is not this repair. |
| Production-demonstrated | Saved Nexus exists. No generated Nexus code, isolated compile, preview, revision or authenticated reopen demonstration. No paid model call made. |

Root cause, exact missing SQL files, saved-project preservation and real pipeline: [commissioning](ARCHITECT_COMMISSIONING.md). Required flags, worker sizing/configuration, separate approvals and bounded acceptance: [activation](ARCHITECT_APPS_ACTIVATION.md).

The existing [offline release checker](ARCHITECT_APPS_RELEASE_REPORT.md) still validates its pinned historical fresh-install manifest. It is not a live schema authority or an apply tool. Production has advanced beyond the old six-step Talk snapshot and outside the manifest's original source pins; do not relabel that snapshot as current or replay any original batch. A new integrated-candidate evidence set and reviewed physical reconciliation are still required.

No key values or personal project contents were committed. No hosted data was changed. Keep this PR draft until integration authority is reconciled with the separate #154 owner. A green build or fixture worker receipt never substitutes for the first authorized real Nexus build and authenticated production acceptance.

CI follow-up: `06b7776` exposed one stale Fold browser assertion for the replaced Construct checks copy. The assertion now expects the truthful execution-not-activated message; no runtime or Talk changes were required. Exact final-head workflow outcomes belong on PR #146. The supplied email did not resolve the saved project's Auth owner; wait for confirmed sign-in before owner-scoped acceptance.
