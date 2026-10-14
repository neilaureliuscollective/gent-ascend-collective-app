# Aethelios Architect — immersive creation studio

UI feature branch `cursor/architect-immersive-studio-5865`, 2026-10-13. Review candidate only. No production merge, hosted migration, credential change, paid provider activation or permission change.

## Coordination

Released main at implementation start: `810966302c2074df98eedf06edae6a6d8a030020`.

| Workstream          | Last observed in the prompt                | Reverified head (2026-10-13 follow-up)                                    | Architect UI overlap                                                                             |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PR #116 Construct   | `4b2f5793663cc7d8ac749bcffd0ad84400741607` | `ef3741e81fe7ef931cdc1054f7ffc49d86c6dfca`                                | `workspace.tsx`, `origin.css`, `page.tsx`, `architect-origin.spec.ts`, new `construct-panel.tsx` |
| PR #117 Connections | `3dc3fed225d4f027e72300a257069b682ea2dbb9` | `b2ee42a43801e093b07577646c72b1c6f1ac53a0`                                | none in Architect routes                                                                         |

This branch does **not** copy Construct execution, worker, Docker, migrations, Connections OAuth, credential or webhook files. Shared-file policy: presentation components and a read-only preview adapter; Origin domain/API/SQL remain authoritative.

## Experience implemented

- Creation entry: four illustrated choices, compact header, “What will you create?”, focused composer, progressive Audience / Constraints / First outcome, emerging brief from typed fields only.
- Workbench: compact project identity, Plan / Changes / Checks / Preview, outline rail, central artifact canvas (~60–70% on desktop), Refine composer, revision strip.
- Fold (~720px): canvas plus Refine; Outline / Revisions via the dock.
- Phone (≤600px): compact Plan / Changes / Checks / Preview stays visible so Artifact preview remains reachable after Blueprint or Deliverables. Outline, Refine and Revisions open as focused panels. Origin surface tabs remain available.
- Persistence/AI/publish warnings are compact readiness notices. Publish is disabled. Voice is disabled. Build connection pending is honest while PR #117 is unmerged.

## Preview truth

| Artifact                                  | Embedded preview today                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Origin Markdown document                  | Carbon reading canvas (actual saved text). Not a running website.                                                                        |
| Origin document that is static HTML       | Isolated `iframe` `sandbox=""` + CSP + tag/handler/url stripping.                                                                        |
| Construct `result.preview.body` (PR #116) | Same isolated renderer, bound to project/owner/revision and source/result hashes when the route exists and `constructEnabled` is passed. |
| Running-server applications               | Not invented. Requires Construct/Connections isolated runtime URL. Unavailable until that contract exists.                               |
| `?demo=architect-preview`                 | Labelled demonstration fixture. Never described as a live generated site.                                                                |

Last working Construct preview is retained only for the same owner and project, and is labelled with that receipt’s revision. A failed or delayed fetch for project B cannot show project A. Missing receipt IDs are not treated as a match. `runs[0]` is never chosen blindly.

Unsaved `draft.documents` are labelled “Unsaved draft preview” and are not assigned a saved-revision caption. Revision controls say “Saved revisions”, “Current”, “Original” (first saved revision) and “Compare previous”.

## Remaining contracts for other workstreams

PR #116 should keep exposing owner-scoped `/api/architect-construct?project=` with required `person_id`, `project_id`, `project_revision`, `status`, `source_tree_hash`, `result.isolation`, `result.source_hash` / `result_hash` and `result.preview.body`. When merging, pass `constructEnabled={constructReady()}` from `page.tsx` and mount `ArchitectConstructPanel` without replacing this canvas adapter.

This UI performs a **selection-only GET**. It does not start, poll, cancel or refresh runs. `building` stays hardcoded `false` because no worker lifecycle is wired here; in-progress statuses are reported as unavailable (“does not refresh execution”) rather than as fake progress. Fixture tests may pass `?construct=adapter` to exercise the adapter; that is not a live Construct activation.

PR #117 should keep Connections as the real GitHub/Vercel status. This UI only labels “Build connection pending” until that API is present; it does not store tokens or start OAuth.

## Visual references

Approved mockups were inspected from the task attachments. Card scenes are original lightweight SVG, not purchased stock and not baked screenshots of the chrome.

### Comparison with approved concepts

| Surface | Matches | Honest gap |
| ------- | ------- | ---------- |
| Creation entry | Compact header, “What will you create?”, four named choices, focused composer, progressive brief stages, gold primary action, pending build chip | Card objects are lightweight SVG scenes, not the photoreal 3D stills. Emerging brief and project library sit below the 1440 fold in the captured shot; they are present and interactive. |
| Workbench | Compact project identity, Plan / Changes / Checks / Preview, outline rail, Refine composer, revision strip, Fold dock (Canvas / Outline / Refine / Revisions), phone canvas-first sheets | Captured default is the real Origin Blueprint/Plan document, not a fabricated website. A generated-site canvas appears only for static HTML or a Construct `result.preview.body`. Publish stays disabled. |
| Fold | Canvas plus one useful secondary panel; dock for the rest | Checks honestly report Construct checks are not in this checkout. |
| Phone | Compact Plan / Changes / Checks / Preview plus canvas-first sheets | Origin surface tabs remain so Blueprint / Research / Deliverables / History journeys still work. |

Evidence: `docs/evidence/architect-studio/` and `/opt/cursor/artifacts/architect_studio_*.png`. Viewport captures are Playwright/browser simulated widths, not physical Fold or phone acceptance.

## Verification results (2026-10-13 follow-up)

Reviewed baseline `470bafdd3c359336e772d61ef2f663e23d7d76a9`. This follow-up keeps the approved entrance and workbench materials.

| Gate | Result |
| ---- | ------ |
| `npx eslint` on changed Architect files | Pass |
| `npx tsc --noEmit` | Pass |
| Vitest preview-contract + Origin unit | 24 passed in the targeted files (`architect-preview-contract`, `architect-origin`, `architect-origin-draft`) |
| Playwright `origin.config` (fixture server) | 21/21 |
| `origin-auth` create/save/revise/leave/resume | Not re-run this pass; spec file unchanged |
| Playwright origin-navigation | See exact-new-head CI; not re-run locally this pass unless noted |

New evidence: `docs/evidence/architect-studio/architect-phone-preview-320.png` and `architect-phone-preview-390.png` show compact Plan / Changes / Checks / Preview on the phone workbench. Desktop capture shows “Saved revisions” / “Current” instead of “Example revisions”.

Blocked / unrun:

- Physical Fold and phone acceptance
- Live Supabase Auth (`origin-auth` not re-run this session)
- Live Construct worker / Docker runtime from PR #116
- Connections OAuth / credential APIs from PR #117
- Hosted preview origin and production publish

Performance: no permanently running WebGL or animated blur fields. Card artwork is static SVG. Preview iframe is created only for compatible HTML and disposed on revision change. Reduced-motion uses existing short opacity/transform tokens. No layout-thrash measurements were taken on physical hardware.

## Shared-file integration notes

This branch prefers new files. The only shared functional file edited is `src/components/architect-origin/workspace.tsx` (presentation swap; Origin request/save/draft logic retained). Browser coverage is extended in `tests/browser/architect-origin.spec.ts`.

Intentionally **not** edited: `origin.css`, `src/app/**/architect/**/page.tsx`, Construct worker/migrations, Connections OAuth/credentials.

When landing with PR #116: keep this canvas adapter; pass `constructEnabled` from the route only after `/api/architect-construct` exists; mount `ArchitectConstructPanel` beside it. Do not merge either backend branch into this UI branch first.
