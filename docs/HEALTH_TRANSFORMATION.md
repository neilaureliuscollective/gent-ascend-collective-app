# Aethelios Health transformation

Branch: `cursor/health-transformation-36d4`. Destination remains Health. No rename of the platform, no revival of Legacy Reserve, no production merge, hosted migration, or activation of medical ingestion / Health AI.

## What changed

Health Command is no longer a six-section landing with a decorative hero. `/app/health` is a composed workspace inside the existing Aethelios shell:

- Slim rail: saved workspaces and the two ready foundations.
- Central working surface: the selected evening sequence or Bloodwork Tracker.
- Context strip: title, saved/unsaved state, version.
- Inspector: settings, sources and allowed behavior for the selected element.
- Compact assist dock: bounded time/foundation commands. Text and touch are complete without voice.

Records, history, labs, connections and privacy remain as secondary routes. They are not the primary experience.

## Foundations

1. **Evenings, made usable.** Structured sequence with editable minutes and finish time, proposed packing, explicit accept, notes, in-app timers and completion. Calendar, purchases, messages and device control stay visibly unavailable.
2. **Bloodwork Tracker.** Chronological reviewed evidence using existing compatibility rules. Original units, collection dates, laboratory ranges and source inspection. Layout, density, markers and comparison drawer persist. When the owner has no reviewed records (or ingestion is off), an isolated **sample** workspace is used and labelled. Sample values are never written into personal records and never bypass activation gates.

## Architect

Trusted presentation/workflow controls work immediately. Genuine source generation, isolated compile and running preview require Architect Apps PR **#130** at `9f858d1b5af4df710c4a01dd43668db7366f6626` (`cursor/architect-create-apps-501f`). This branch does **not** vendor that engine. The Health adapter records the exact dependency, sanitizes briefs (no personal labs, titles or notes), and reports dynamic compilation as blocked. A mocked model response is not treated as a running preview. Failed or blocked compiles keep the last working revision.

## Persistence and privacy

Additive migration `20261015180000_health_workspace.sql` stores owner-scoped workspaces, revisions, and a read-only record bridge. Exact request receipts prevent duplicate creates. Newer saves use expected versions, so an older failed request cannot overwrite a newer one. Full Health deletion removes workspaces. Export includes workspace artifacts without bridge tokens. The coding path never receives personal lab values. Generated presentation cannot replace host-controlled evidence. Bridge access rechecks owner, consent, revision and session; another account, a forged owner header, or revoked records consent cannot read it.

Apply the migration only on local/synthetic databases. Do not apply it to hosted projects from this phase.

## Verification notes

Browser fixture journeys cover evening constraint/timer/save/resume, labelled sample bloodwork, blocked Architect compile, and exact save retry. SQL emulation covers owner isolation and bridge denial. These are not a live Auth/Storage/Docker Apps result. Medical ingestion and Health AI remain off.
