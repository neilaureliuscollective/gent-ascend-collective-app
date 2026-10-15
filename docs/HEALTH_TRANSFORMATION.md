# Aethelios Health transformation

Branch: `cursor/health-transformation-36d4`. Destination remains Health. No rename of the platform, no revival of Legacy Reserve, no production merge, hosted migration, or activation of medical ingestion / Health AI.

## What changed

`/app/health` is a composed personal workspace. This phase keeps the two foundations and makes the working surface the center:

- Evening sequence: current/next action, in-app timer, compact time controls, proposed packing that must be accepted, notes on the selected step. Calendar, purchases, messages and devices stay unavailable.
- Bloodwork Tracker: one selected marker trend, compact marker/date controls, original units and laboratory ranges, source inspection. Empty marker selection stays empty. Assist “show LDL” selects LDL.
- Inspector and mobile sections hold settings, library and records. In-progress work is kept across layout changes and confirmed before switching foundations.
- Member-facing copy does not include PR numbers or commit hashes. Technical dependency details stay in collapsed diagnostics.

## Private state and saves

HealthAtelier follows the parent owner/session/visibility lifecycle. Account change, signed-out refresh and hidden documents clear draft, assist text, inspector and Architect panels. Timers are fenced to the current owner, workspace and generation.

Saves return confirmed, failed or uncertain receipts. The draft is cleared only when the exact generation that was sent is acknowledged. Failed and uncertain saves keep the visible edits. “Save as copy” sends the current working surface when it is dirty (`includeDraft`). Switching foundations or saved workspaces with unsaved edits asks to keep editing, discard, or save first.

## Architect

Trusted presentation controls work immediately. Genuine compile uses a Health-owned adapter: the person enters a customization request; Health classifies it as presentation-only or sensitive; approved Health source, the versioned contract and a synthetic example are the only builder inputs. Personal values, documents and clinical instructions are not sent.

A compile is ready only after isolated Docker compilation and a usable preview. Host-fixture or missing preview is failed, not ready. Client `workingRevision` metadata cannot verify a build. Accept binds source hash, artifact hash, isolation and revision in `health_private.workspaces` only when the stored attempt is already ready with Docker isolation.

Inspected Architect Apps dependency: PR **#130** `cursor/architect-create-apps-501f` @ `97b9a645d88a7498f5661d69d3259ad7239d853b` (2026-10-15). That runtime is not on this branch (`src/domains/architect-apps/service.ts` is absent; `/api/architect-apps` is 404). This phase therefore reports customization compile unavailable and does not present a fake preview. Runtime access, when later enabled, stays on the Health-owned bridge, filtered to selected markers, date window and fields.

## Persistence

Additive migration `20261015181000_health_workspace.sql` stores owner-scoped workspaces, full revision settings/progress/architect, and a read-only record bridge. The 181000 timestamp avoids colliding with Talk’s unmerged `20261015180000_talk_live_trusted_observe.sql`. Neither file is on main or hosted projects. Exact request receipts prevent duplicate creates. Workspace save does not take working revision from the client. Export includes reconstructable revision payloads, not labels only.

Apply the migration only on local/synthetic databases. Do not apply it to hosted projects from this phase.

## Verification notes

Local this phase: Health unit/SQL tests, migration ledger uniqueness, and Playwright fixture journeys (emulated 344 / 390 / 768 / 1440). Screenshots in `docs/evidence/health-transformation/` are labelled fixture renders, not live Auth.

Unrun: signed-in Next.js `/app/health` against isolated Supabase Auth/Storage; hosted migration; Docker Architect Apps compile. Medical ingestion and Health AI remain off.
