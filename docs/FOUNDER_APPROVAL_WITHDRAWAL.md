# Founder approval control and receipts — 2026-10-12

Canonical public application only; candidate source, not deployed.

## Research and architecture

Inspected existing owner-scoped company versions, founderSession, approval transitions, full-payload replay/CAS writes and the Approval Center. The previous implementation had immutable approve/reject records but no explicit withdrawal, and exposed no inline decision timeline.

Reviewed official [OWASP transaction authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), especially server-enforced transitions, significant action details and protecting approved data. Use a distinct strict withdrawal payload and exact expected snapshot rather than treating a second ordinary rejection as withdrawal. Preserve the prior approved version. No external transaction executor is introduced.

## Implemented

- Strict founder-only withdrawal request at the existing approvals API, with the same company/job/expected/version receipt contract.
- Only approved proposals may be withdrawn. Missing, pending and rejected proposals fail; normal decideApproval transitions are unchanged.
- Withdrawal saves the unchanged proposal as rejected in a new immutable work version. No status-schema expansion or migration is needed. History derives approval_withdrawn from an approved-to-rejected transition; prior approval remains inspectable. Models cannot change these decisions through generation.
- Approval Center exposes the withdrawal control and per-proposal decision history with revision, saved time and source. At most 100 loaded versions are shown. First states from a truncated history are labelled observed; unchanged copied decisions do not manufacture new decision events.
- Exact uncertain-write recovery keeps original identifiers/payload; existing SQL CAS protects concurrent writes. No communications, spending, deployment or other external action is executed or undone.

Source: src/domains/founder-office/approvals.ts; src/app/api/founder-office/approvals/route.ts; src/domains/company-work/approval-history.ts; src/components/founder-office/mission-approvals.tsx.

## Validation limits

Local tests verify approved-only withdrawal, founder denial, stable receipt replay, preservation of proposal data, no model invocation, timeline ordering, unchanged copies, initial rejection, unknown proposals and truncated history. They are not live Supabase Auth or provider tests. Final checks are recorded in STATUS.md.

Normal build asset-download, browser socket, real Auth/provider/voice/device and broad remote CI acceptance blockers remain as previously recorded. Direct optimized compilation skips Mirror asset preparation. No push, PR, new migration or deployment.

Before an executor is connected, it must revalidate the exact current approval and scoped authorization at execution time and record actual results. This approval ledger alone is not permission to execute. Withdrawal does not undo a completed external action; any such capability needs its own accepted contract and receipt.
