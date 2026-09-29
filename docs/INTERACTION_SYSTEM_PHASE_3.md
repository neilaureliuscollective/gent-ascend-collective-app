# Interaction System Phase 3 — Performance and whole-man navigation

## Recovery status

Workspace maintenance removed the local-only Interaction Phase 1 (`e86ea07`) and Phase 2 (`23f3b01`) objects. Their push had previously been rejected pending explicit remote-upload approval. Neither commit exists in this checkout or current remote branches; Library searches found no matching source artifact. Do not describe those implementations as recovered.

This phase starts from the remotely preserved Performance Phase 6 (`1009091`) and reconciles released main (`1db7da7`), including the original Grooming Concierge. The merge retains both domains' table/RPC type contracts and existing migrations. It does not include the lost Phase 2 immersive Grooming flows. Those remain a separate reconstruction task using this conversation's implementation record.

The shared sheet, compact gutters, measured nav clearance and choice-group foundation needed by Phase 3 were reconstructed here. No hosted database or deployment was changed.

## Research and plan

Reviewed official [Android adaptive layouts](https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts), [Apple modality](https://developer.apple.com/design/human-interface-guidelines/modality), and [WAI dialog focus guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Use one focused task on compact screens; retain context/drafts; place secondary configuration in a sheet; expand that sheet into a side panel when both width and height allow. Native radio semantics and native dialog modality avoid gesture-only controls. Local Next.js 16 documentation was checked for client/server and mutation boundaries.

Build order: recover shared foundation → migrate Performance editors without changing persistence → strengthen My World and Progress hierarchy → check compact layouts and existing domain regressions. No new provider, framework or model of physical readiness is introduced.

## Implemented

- Shared `ContextSheet` owns modal focus, keyboard containment, focus return, scroll locking, visual-viewport sizing and responsive sheet/side-panel placement. Mounted children preserve paused edits. Busy writes prevent dismissal; domain errors appear inside the task rather than behind it.
- Performance profile, plan, program, check-in, fuel and recovery editing use this shared task surface. Existing schemas, request IDs, optimistic revisions, sync, account isolation and offline workout persistence remain authoritative.
- Existing direction begins with a summary and Keep / Adjust. Keep on unchanged data closes without a request; changes require review before saving. Goal choices use native radios. Numeric records remain precise inputs rather than imprecise sliders.
- Performance uses open canvas and compact title/section rhythm. Primary actions retain hierarchy, secondary navigation scrolls within its own rail, and dense task fields collapse to one column on phones.
- My World is a linked directory for LifeOS, Performance, Grooming, Aethelios and Studio. Commerce, Reserve and the member guide sit in a secondary disclosure. Future features are not presented as available cards.
- The four-destination structure already used by the Performance branch is retained: Command, My world, Progress, You. Both Performance and Grooming highlight My world. Aethelios remains independently available; no global AI behavior was changed.
- Progress uses expandable dated entries rather than rendering every detail permanently. Capture also uses the shared sheet while retaining its existing request logic.

## Responsive and accessibility rules

16px gutters below 400px, 20px at 400–599px, 24px at 600–1100px, 32px beyond. Shell owns outer spacing. Bottom navigation clearance is measured, with safe-area padding included. Four links occupy one row. Sheets become max-600px side panels from 840px when viewport height is at least 600px; short landscape remains a scrollable full-height task. Inputs are 16px, task controls at least 48px tall. Motion is a finite 150ms entrance and respects reduced motion. No keyboard-height assumption or scroll interception.

## Validation and limits

Local validation: production build, strict TypeScript, ESLint, migration-ledger check and 143 unit/SQL tests pass. All 28 selected browser scenarios passed across the initial run and focused recovery rerun: seven direction-sheet widths (360/375/390/412/430/768/1440), unchanged Keep without writes, compact four-link navigation, workout/offline/retry behavior, fuel and recovery flows. Recovery assertions now target the shared sheet heading and verify that expanded history survives editing. Redundant domain-level focus management was removed so the sheet owns focus consistently.

Browser fixtures use synthetic account data and intercepted requests; SQL emulation does not establish live Supabase Auth acceptance. Physical Samsung/iPhone/Fold keyboard, safe areas, installed PWA, screen readers and real authenticated cross-account workflows remain release gates. Inherited Performance migrations must be reconciled with the hosted ledger before any deployment. There are no new migrations in this interaction phase.

The repository remains local until explicitly approved for remote upload. Do not deploy this integration branch as a substitute for reconstructing and validating the missing Phase 2 Grooming changes.
