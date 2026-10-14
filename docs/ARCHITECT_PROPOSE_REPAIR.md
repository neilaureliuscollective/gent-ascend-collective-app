# Architect bounded repair

Date: 2026-10-14. Branch `cursor/architect-propose-repair-501f` stacked on create-tool PR #124 (`977ef10`). Talk #121 and Command #123 stay separate. No production merge, hosted migration, credential change, or paid model call.

## What this slice adds

One **Propose repair** action for an eligible terminal Construct run that recorded reliably identified **introduced** check failures.

1. Eligibility requires a failed terminal run, comparable baseline/post checks, and at least one introduced failure. Pre-existing-only, ambiguous, unsupported-only, and non-failed terminals are refused.
2. The proposed correction is one bounded patch through the existing provider (labelled mock or authorized OpenAI). Deterministic fixture: repair the introduced `const introduced = ;` syntax failure.
3. The owner reviews the **combined** diff against the original pinned source before approval.
4. Approval writes a new brief and a **fresh** digest. The original patch approval cannot be reused.
5. Execution applies that combined patch to the original source, with the same allowlist, protected paths, check plan, and limits.
6. At most one repair per original run. Replay of the same request is safe. A second repair is refused, including concurrent starts.
7. If the repair still fails, the receipt is kept and control returns. There is no hidden loop.

Coverage remains **syntax-only** unless the approved plan says otherwise. Typecheck, build and functional tests stay unsupported in this sandbox.

## Workbench

Original attempt → observed failure → proposed correction → approved repair → observed result.

Phone is canvas-first. Fold keeps the canvas plus one secondary review panel.

## Founder model-generated run

Read-only blockers from `founderModelGeneratedRunBlockers`:

- Origin and Construct flags
- Unauthorized or missing paid OpenAI path
- Production / Vercel refusal
- Local worker token and non-hosted plane
- Unapplied hosted Construct migrations
- Isolated Docker for a non-fixture run
- A real imported or git-pinned tree; the labelled fixture is not a model-generated change

A funded OpenAI account does not supply a sandbox, worker, or repository connection.

## Local verification

- `npm run lint` — pass
- `npx tsc --noEmit` — pass
- Focused Construct unit/SQL tests, including eligibility, combined patch, and introduced-syntax repair execution
- Origin browser: repair journey is visible; Propose repair stays disabled without an eligible failed run
- Origin / Quality: cancel assertion scoped to `Latest run cancelled` plus the Repair journey step, after the journey strip also named the cancelled original attempt

Exact-head hosted CI starts after this push. Live workflows stay unrun on a stacked PR.

## Not in this PR

No autonomous multi-repair loop, new-file creation, expanded sandbox, production merge, hosted migration, or paid call.
