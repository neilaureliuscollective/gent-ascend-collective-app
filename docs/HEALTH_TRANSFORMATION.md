# Aethelios Health transformation

Branch: `cursor/health-creation-environment-36d4`, from main `544c156`. Destination remains Health. No rename of the platform, no revival of Legacy Reserve, no production merge, hosted migration, or activation of medical ingestion / Health AI.

## What this pass changes

`/app/health` is an immersive creation environment with three connected states:

1. **Creation home** — “Make Health work your way” and “What would you like to create?”. A labelled-sample evening tool sits beside the composer on large screens and below it on phones. Foundations are miniature starting materials. My tools lists real saved work. Records, privacy and connections stay reachable without owning the first viewport.
2. **Active canvas** — opening or creating a tool shows its name, draft/saved state, Use/Customize, the rendered tool, and “Change your tool…”. Customize keeps the tool visible and puts structural controls beside it (or in a phone sheet).
3. **Owned personal tool** — a confirmed save keeps the accepted definition, layout and progress. Leave, reopen and refresh restore that tool. It is usable, not a saved brief.

## Real creation

There is no generated-app runtime on this branch. Creation is compositional, not a silent map onto two presets:

- Blank tool, add/remove/reorder/rename supported sections, choose their display, configure evening time limits and bloodwork markers.
- Supported pieces: next action, evening sequence, preparation notes, marker trend, results table, source inspection.
- Natural-language edits use bounded commands (`add a trend`, `remove the table`, `rename this tool to …`, time limits, `show LDL`). Unsupported ideas are kept as an Architect brief. Generated-code execution stays unavailable.

Evening sequence and Bloodwork Tracker remain working starting materials: timers, packing, notes, reviewed markers, original units, ranges and source inspection. Custom layout cannot alter source records, provenance, units or comparison rules.

## Private state and saves

**Save and continue** navigates only after the matching save is `confirmed`. Failed or uncertain acknowledgement keeps the current canvas, edits and pending destination.

Drafts clear only when the exact generation that was sent is confirmed. Copy still includes unsaved edits. Owner/session/hidden-document clearing is unchanged. If Health storage is unavailable, the UI says the draft has not been saved.

## Architect

Trusted presentation still applies immediately. Isolated compile depends on Architect Apps PR **#130** `cursor/architect-create-apps-501f`, inspected 2026-10-15 at `3248e8da6fce8b56af9fd310b7ad66ea02312248` (moved from `97b9a645…`). `/api/architect-apps` remains 404 on this branch. Blocked compile does not present illustrative diffs as verified receipts. Personal records are not sent into general coding context.

## Persistence

Additive migration `20261015181000_health_workspace.sql` is unchanged. Tool composition is a versioned `settings.composition` object (`schemaVersion: 1`) inside existing workspace JSONB. Hosted application of 181000 has not been verified and is not applied from this pass.

## Verification

Health unit/SQL tests, composition command tests, and Playwright fixture journeys including:

- Create a distinct tool, structural change, behavior change, undo/redo, save, leave, reopen.
- Failed Save and continue retains edits and location.
- Owner change clears the private canvas.
- Phone 390, Fold-like 768 and desktop 1440 for home, customize and use.

Screenshots in `docs/evidence/health-creation/` are labelled fixture renders, not live Auth.

Unrun: signed-in Next.js `/app/health` against isolated Supabase Auth/Storage; hosted migration; Docker Architect Apps compile. Medical ingestion and Health AI remain off.
