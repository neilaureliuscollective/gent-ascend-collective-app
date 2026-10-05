# Presence — focused repositioning

Implemented 2026-10-05. Founder mission: grooming belongs within Presence, without daily completion pressure. No full app rebuild or database migration.

## Inspection and execution plan

- Main navigation already used Command / My world / Collection / Progress / You; keep this mobile footprint. Recognize Presence under My world.
- Command's operating-space shortcut and My world directory named Grooming. Rename and route those entry points to Presence.
- Compact Home continuity displayed ritual completion counts, and Daily Command read morning routines and check-ins to create a GROOM decision. Remove that daily demand at the source.
- Preserve `/app/grooming` and all scan, look, brief, professional, routine, feedback, history, product and commerce routes. Keep API/database identifiers and ownership contracts unchanged.
- Compose `/app/presence` from existing session-owned direction, upcoming occasions and member-marked running-low products. Use editorial rows, restrained green/gold surfaces and optional deeper tools; no tracker grid.
- Add Presence conversation starters and relevant upcoming occasions to existing per-message personal-context reads. No auto-send, auto-memory or background agent.
- Validate route types, lint, units, build, responsive component journeys, and existing grooming interactions.

## Implemented behavior

Presence encompasses appearance, grooming, wardrobe discussion, confidence and preparation. It shows the nearest saved occasion within seven member-calendar days, or a quiet direction/empty state. Saved running-low products appear only when explicitly marked by the member. Individual source failures are visible without hiding remaining available records. Nothing is inferred from missing routine logs.

The destination links directly to Ascend Scan, My Look and professional preparation. Wardrobe opens an editable Aethelios draft that asks about the occasion and clothes owned. Grooming routines, products and visual history remain under a disclosure, with query-selected deep links opening existing history/occasion sections. Legacy links and action redirects still work. Deep grooming views return to Presence.

Home no longer displays daily ritual completion totals in its compact continuation. Daily Command stops querying grooming routines/check-ins/goals solely to create daily grooming pressure. It still reads an explicitly saved occasion approaching within seven days and links PREPARE to Presence. The model retains the legacy ritual input and stored snapshot shape for compatibility, while never producing a GROOM move. Historical stored decisions/outcomes are retained as actual history.

Aethelios can request the existing saved appearance context for Presence/preparation/wardrobe questions when the member enables personal context. Context now includes bounded upcoming occasion records. Instructions distinguish preferences, member-reported product status, dated scan summaries and unknown wardrobe/cadence. Chat still cannot save grooming changes except through existing separate reviewed controls.

## Preserved

Scans and guided camera permission, private imagery, recommendations, generated concepts, routine versions and optional completion recording, feedback, professional handoff, photos, history, Cabinet links, commerce and person-owned records. No schema or RLS changes; no new dependencies. Public historical world routes remain accessible.

## Remaining intelligence work

No connected calendar, persistent wardrobe inventory, explicit haircut-cycle model, automated preparation schedule, reminder delivery, background monitoring, replenishment forecast or booking integration. These need actual user-controlled data and service contracts. This phase does not imply they exist. Wardrobe support is conversation today; dated skin observations are never treated as a live condition assessment.

## Validation

Typecheck, zero-warning lint, 350 unit tests, production build and migration-ledger check passed. Browser coverage includes Presence at 344/390/768/1440px, empty/degraded states, direct-home access and large text/short viewport, Command arrival/outcome, saved-work continuity, direction draft recovery, and grooming routine retry/edit/feedback journeys. Chromium automation uses synthetic component records for personal views, not live authenticated account evidence. Production route build and signed-out private API denial were checked; live model, hosted session read/write, and physical-device review remain unverified here.

Release status: implementation prepared on a review branch; no production promotion in this phase.
