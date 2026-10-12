# Founder milestone corrections — 2026-10-12

Candidate inside the canonical public application. No deployment, new schema, dependency or executor.

## Research and implementation

The previous phase made task readiness inspectable but left saved task objectives, assignees and dependencies inaccessible to correction. Reuse the existing founder-only task endpoint, immutable company work versions and expected-revision CAS write. No separate task database is needed.

Reviewed official [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) and [React immutable array updates](https://react.dev/learn/updating-arrays-in-state). An ordinary read does not prevent a concurrent write; retain the existing atomic expected-revision check rather than relying on the editor snapshot alone. UI edits use map/filter without changing saved objects.

Implemented editing, reassignment, dependency changes and removal from the current task plan. Removal never deletes historical versions. Tasks with dependents cannot be removed until those references are corrected. Self dependencies are excluded from the editor; the existing graph validator rejects cycles and dangling references on both sides of the boundary.

Completed milestones must first be reopened in a separate saved version before their objective, title, assignment, dependencies or presence can change. A domain guard enforces this server-side, including requests which simultaneously change status and scope. Completion/reopening controls remain available. The editor captures its starting revision and rejects submission when the displayed mission changed underneath the draft; the database CAS still protects concurrent writes.

Exact uncertain-save recovery keeps its original payload and identifiers. Successful writes reset the editor; failed writes retain the draft and recovery controls. Editing remains available at the 24-task limit without permitting a 25th task.

## Verification and remaining gates

Domain/service tests cover open-task reassignment, immutable input preservation, completed-edit/removal denial before writes, explicit separate reopening, dependency removal and cycle rejection. Existing owner/founder denial, immutable replay and graph tests remain in the suite. Final counts and checks are recorded in STATUS.md.

Browser/device and real Auth/provider acceptance remain blocked by the previously recorded environment constraints. The optimized compilation skips the missing Mirror asset preparation; it is not a successful normal npm build claim. No production changes or external work execution are represented by this phase.
