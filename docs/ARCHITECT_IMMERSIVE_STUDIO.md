# Aethelios Architect — immersive creation studio

UI feature branch `cursor/architect-immersive-studio-5865`, 2026-10-13. Review candidate only. No production merge, hosted migration, credential change, paid provider activation or permission change.

## Coordination

Released main at implementation start: `810966302c2074df98eedf06edae6a6d8a030020`.

| Workstream          | Last observed in the prompt                | Reverified head                                                           | Architect UI overlap                                                                             |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PR #116 Construct   | `4b2f5793663cc7d8ac749bcffd0ad84400741607` | `0a08c6a70499c49fe1069f257fe3250ab751696d` (ancestor of the observed SHA) | `workspace.tsx`, `origin.css`, `page.tsx`, `architect-origin.spec.ts`, new `construct-panel.tsx` |
| PR #117 Connections | `3dc3fed225d4f027e72300a257069b682ea2dbb9` | unchanged                                                                 | none in Architect routes                                                                         |

This branch does **not** copy Construct execution, worker, Docker, migrations, Connections OAuth, credential or webhook files. Shared-file policy: presentation components and a read-only preview adapter; Origin domain/API/SQL remain authoritative.

## Experience implemented

- Creation entry: four illustrated choices, compact header, “What will you create?”, focused composer, progressive Audience / Constraints / First outcome, emerging brief from typed fields only.
- Workbench: compact project identity, Plan / Changes / Checks / Preview, outline rail, central artifact canvas (~60–70% on desktop), Refine composer, revision strip.
- Fold (~720px): canvas plus Refine; Outline / Revisions via the dock.
- Phone (≤600px): canvas first; Outline, Refine and Revisions open as focused panels. Origin surface tabs remain available so existing journeys still reach Blueprint / Research / Deliverables / History.
- Persistence/AI/publish warnings are compact readiness notices. Publish is disabled. Voice is disabled. Build connection pending is honest while PR #117 is unmerged.

## Preview truth

| Artifact                                  | Embedded preview today                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Origin Markdown document                  | Carbon reading canvas (actual saved text). Not a running website.                                                                        |
| Origin document that is static HTML       | Isolated `iframe` `sandbox=""` + CSP + tag/handler/url stripping.                                                                        |
| Construct `result.preview.body` (PR #116) | Same isolated renderer, bound to project/owner/revision and source/result hashes when the route exists and `constructEnabled` is passed. |
| Running-server applications               | Not invented. Requires Construct/Connections isolated runtime URL. Unavailable until that contract exists.                               |
| `?demo=architect-preview`                 | Labelled demonstration fixture. Never described as a live generated site.                                                                |

Last working Construct preview is retained when a newer receipt is unavailable. No fake token streaming, percentages or invented passing checks.

## Remaining contracts for other workstreams

PR #116 should keep exposing owner-scoped `/api/architect-construct?project=` with `result.preview.body`, hashes, isolation flags and lifecycle cancel. When merging, pass `constructEnabled={constructReady()}` from `page.tsx` and mount `ArchitectConstructPanel` without replacing this canvas adapter.

PR #117 should keep Connections as the real GitHub/Vercel status. This UI only labels “Build connection pending” until that API is present; it does not store tokens or start OAuth.

## Visual references

Approved mockups were inspected from the task attachments. Card scenes are original lightweight SVG, not purchased stock and not baked screenshots of the chrome.

### Comparison with approved concepts

| Surface | Matches | Honest gap |
| ------- | ------- | ---------- |
| Creation entry | Compact header, “What will you create?”, four named choices, focused composer, progressive brief stages, gold primary action, pending build chip | Card objects are lightweight SVG scenes, not the photoreal 3D stills. Emerging brief and project library sit below the 1440 fold in the captured shot; they are present and interactive. |
| Workbench | Compact project identity, Plan / Changes / Checks / Preview, outline rail, Refine composer, revision strip, Fold dock (Canvas / Outline / Refine / Revisions), phone canvas-first sheets | Captured default is the real Origin Blueprint/Plan document, not a fabricated website. A generated-site canvas appears only for static HTML or a Construct `result.preview.body`. Publish stays disabled. |
| Fold | Canvas plus one useful secondary panel; dock for the rest | Checks honestly report Construct checks are not in this checkout. |
| Phone | Canvas first; Outline / Refine / Revisions as focused panels | Origin surface tabs remain so Blueprint / Research / Deliverables / History journeys still work. |

Evidence: `docs/evidence/architect-studio/` and `/opt/cursor/artifacts/architect_studio_*.png`. Viewport captures are Playwright/browser simulated widths, not physical Fold or phone acceptance.

## Verification results (2026-10-13)

| Gate | Result |
| ---- | ------ |
| `npx eslint` on changed Architect files | Pass |
| `npx tsc --noEmit` | Pass |
| Vitest `tests/architect-preview-contract.test.ts` + Origin unit suite | 31 passed |
| `npm run build` | Pass |
| Playwright `origin.config` (fixture server) | 17/17 |
| Playwright origin-navigation (production start) | 31/31 |

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
