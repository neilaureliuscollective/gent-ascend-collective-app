# Architect quantity-and-cost estimator

Date: 2026-10-14. Branch `cursor/architect-create-tool-501f` stacked on Architect source-review PR #122 (`7bffe6b`). Correction pass on PR #124. Talk #121 and Command #123 stay separate. No production merge, hosted migration, credential change, paid model call, or Construct expansion.

## Correction pass

1. Invocation receipts are computed by `architect_origin_tool_invoke`. Direct `architect_origin_tool_record_invocation` calls are refused; a browser-supplied result cannot be stored.
2. Tool save retries an immutable pending snapshot (owner, project, tool, expected revision, request, payload). A lost HTTP response reconciles the committed revision. Later edits stay separate.
3. The Tool panel stays mounted while switching surfaces. Tab-local draft recovery is honest: unsaved edits survive Tool/Blueprint and Back/Forward in this tab, not a hard browser restart unless sessionStorage still has them. The footer never says the project is fully saved while a tool draft is unsaved.
4. Quantity waste is applied before monetary rounding. Schema and SQL reject zero/invalid quantities and currency-precision mismatches. Markup remains distinct from margin.
5. Agent-fixture invoke is a typed contract and test helper, not a normal user control.

## What is implemented

A creator-owned quantity-and-cost estimator inside the existing Architect Origin project:

1. Named items, quantities, units and unit costs.
2. Optional waste as an extra percentage of quantity. Optional markup as a percentage of the wasted-cost subtotal. Markup is not margin; implied margin is shown only as a derived explanation.
3. A trusted TypeScript calculation engine. No `eval`, generated JavaScript, or model arithmetic.
4. Additive owner-scoped tables `architect_origin_tools`, `architect_origin_tool_versions` and `architect_origin_tool_invocations`. Existing Origin `ProjectContent` is unchanged and remains readable.
5. Optimistic revisions, exact replay, stale-edit rejection and RLS owner isolation.
6. Server invocation of an exact saved revision at `POST /api/architect-tools`. Draft changes do not change a previously saved tool.

Open it at `/app/architect` with Origin enabled. Create a project, choose **Create a quantity & cost estimator**, or open an existing project and use the **Tool** surface.

## Invocation contract

Architect uses this contract directly. Talk does not.

```
POST /api/architect-tools
Authorization: authenticated session cookie
{
  "action": "invoke",
  "projectId": "<owned project uuid>",
  "toolId": "<owned tool uuid>",
  "revision": 1,
  "requestId": "<idempotency uuid>",
  "quantities": {},
  "source": "architect" | "agent-fixture"
}
```

Owner, project and permission come from the session. A browser-supplied owner ID or a model claim is not authorization. Talk #121 must not claim this tool until a reviewed Talk adapter posts the same contract and the Auth/PostgREST tests pass from that surface. The exact receiving contract is `architectToolInvokeContract` in `src/domains/architect-tools/contract.ts`.

## Verification in this run

Ran locally on this branch:

- `npm run lint` — pass, zero warnings
- `npm run typecheck` — pass
- `npm test` — 955 unit/SQL tests
- `npm run db:ledger` — pass; authority migration is additive and unhosted
- `npm run build` — production build pass, including `/api/architect-tools`
- Origin browser: 29/29, including create → calculate → save → switch Blueprint → return → invoke, plus dropped-response retry

Screenshots: `docs/evidence/architect-construct/architect-tool-{390,720,1440}.png` and `architect-tool-keyboard-390.png`. Simulated viewports, not physical-device testing.

Exact-head hosted CI starts after this push. Origin local-auth smoke now includes owner-scoped tool save and foreign invoke denial; that job is unrun on this executor until CI.

Unrun / blocked unless later recorded:

Unrun / blocked unless later recorded:

- Hosted migration (not applied)
- Paid OpenAI operation of the tool
- Physical Fold / Safari
- Talk adapter

## Founder phone test

1. Open Architect on the local or preview host with Origin enabled.
2. Enter a short idea, then tap **Create a quantity & cost estimator**.
3. Load the labelled sample, confirm the total, and save a tool revision.
4. Change an assumption so the preview is labelled unsaved.
5. Invoke the saved revision and confirm the receipt still names revision 1.
6. Leave Architect, return to the same project, open **Tool**, and confirm the saved revision is still there.
