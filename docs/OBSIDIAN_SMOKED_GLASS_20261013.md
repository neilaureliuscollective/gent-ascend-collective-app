# Obsidian / Smoked Glass / Emerald — review candidate

Founder-authorized material implementation, October 13, 2026. Local review only; no push, merge, deployment, environment changes or hosted data writes. The source mockup resolved as Library `libfile_19ed0e75ec8c8191ac73a9ca93130a4b`, version 0. Supported transfer failed on its initial attempt and one bounded retry. Pixels were not inspected. The explicit written fallback is the implementation authority and supersedes earlier broad emerald-surface direction for Talk and Studio.

## Base and independent candidates

| Candidate | Exact commit | Relationship |
| --- | --- | --- |
| Accepted Talk production | `0c45b2f65703e13fabc0725ad4a21f49a11093ff` | This worktree's base; production alias still pointed to READY deployment `dpl_36Eu49stBtKb9X4axyJAJHHeAifs` when checked |
| Current main | `441b0374b43af97e49cde08978d228df353b9f6b` | Refreshed, already an ancestor of the accepted Talk base |
| Live founder candidate | `398037e9587f0c1a5d84e712b97a1605005621b8` | Descends from Talk base; not merged here |
| Architect first-site candidate | `928f74a6e327a21fdeb1df9b0182060d8eb579f8` | Separate branch from common ancestor `35837f7a3745eda8521b3b6086d4caf6bea1c7fb`; not merged here |

Live's changed-file overlap with this design is documentation (`docs/STATUS.md`) only. Architect overlaps that status document and the fixture entrypoint, where this change adds one CSS import. No application-source conflict is expected from those exact diffs, but a later combined candidate still needs integration and browser verification. Do not infer that this review enables Live production admission or applies Architect's new migration. Shared shell styling will accompany the existing interface when independently approved feature changes arrive.

Living Sanctuary `28e1a04` remains a separate, unverified preservation item. No old workspace or restricted session directory was accessed or overwritten for this task.

## Material implementation and consumer audit

Eight neutral roles extend `src/platform/visual/aether-palette.json`; the normal token generator produces `aether-tokens.css`. Existing palette roles and official artwork remain intact. The root layout imports the new scoped material stylesheet after the existing Emerald layer. The browser component fixture imports the same layer.

The existing `io` semantic aliases are adopted only while the shell contains Talk or Studio. Their shared shell/header/navigation, overlays and nested panels therefore use the same palette: canvas #111111, panel #1A1A1A, raised #242424, primary #F2F2EE and secondary #B9BEBB. Existing Work, Architect, Founder Office, Health, Lifestyle, public worlds and document/print roles retain their palettes; their composition is outside this task. The retained global optical tokens continue to serve Work/Architect, while local Talk/navigation aliases recolor the existing B+ SVG geometry. No renderer, React state, provider, model, server service, feature gate or storage code changes.

Talk keeps its current viewport, compact header, identity presence, transcript and composer behavior. Its broad wash becomes a bounded accent, prompt cards use raised graphite with small gold edges, and the existing composer gains a neutral optical face with an emerald inner rim and reflected return. The existing upper-left catch, bevel, lower undercut and contact shadow remain dimensional. Native Tools/context and expanded-editor dialogs use charcoal glass. `.talk-council-access` now wraps with an explicit 20px horizontal / 8px vertical gap and 44px action height; labels and handlers are unchanged.

Studio's header, project navigation, selected project tile, room console and Direction surface use the same graphite layers. The existing emerald `AmbientHorizon` stays in the hero; media, titles, fonts and actions are unchanged. Selected controls retain emerald/gold marks; inactive labels are neutral and readable. Enabled gold-filled buttons use exact #C4912F with dark #111111 text.

Static translucent gradients provide thickness without new backdrop filters, animated shadows, paint loops or WebGL allocations. Existing intelligence motion is preserved. Solid, increased-contrast, reduced-transparency and forced-colors preferences have explicit paint fallbacks; existing Still/reduced-motion behavior remains authoritative. This is not a measured 80% coverage quota or a pixel match to the unavailable reference.

## Research applied

- [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials): distinguish controls from content, use glass sparingly, and favor thicker materials for legible text. Retrieved the official documentation JSON after the JavaScript page shell. This web implementation uses opaque reading surfaces and static smoked controls rather than imitating native Liquid Glass behavior.
- [Apple Color](https://developer.apple.com/design/human-interface-guidelines/color): contrast and accessibility variants remain independent of decorative color. Official documentation JSON retrieved.
- [Carbon color layering](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview): darker themes separate elevation with progressively lighter neutral layers and semantic tokens.
- [web.dev animation guidance](https://web.dev/articles/animations-guide): avoid adding paint-heavy animation; retain bounded existing transform/opacity interaction behavior.
- Installed Next 16.3.5 CSS documentation: preserve the global stylesheet order and explicit route scope.

## Verification and limits

Reproduction uses the optimized local build and a dedicated loopback server on port 3250, so it never attaches to another worktree's app. `playwright.obsidian.config.ts` retains the repository browser options. All new browser transport is synthetic and blocks non-loopback requests; the streaming test exercises the real UI using an isolated ReadableStream. Screenshots are requested review deliverables, not hosted/provider evidence.

Commands:

```sh
npm run lint
npm run typecheck
npm test
npm run db:ledger
npm run build
# If the existing Mirror prebuild DNS failure occurs, report it separately:
node node_modules/next/dist/bin/next build --webpack
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npx playwright test \
  --config playwright.obsidian.config.ts \
  tests/browser/obsidian-material.spec.ts tests/browser/bplus-talk.spec.ts \
  tests/browser/talk-recovery.spec.ts tests/browser/talk-interaction-recovery.spec.ts \
  tests/browser/talk-layout.spec.ts tests/studio-browser/production.spec.ts --workers=2
```

The new material checks capture empty/streaming Talk, focused multiline composer at reduced keyboard viewport height, Tools drawer, and Studio content at 344, 720 and 1440 CSS pixels. They verify spacing, retained draft text, Stop availability, overflow, navigation, selected tabs, focus and solid/forced-color behavior. Contrast checks hide only glyph paint, capture the actual composited element raster and measure foreground contrast against sampled interior pixels; this is stronger than token-only calculation but not a whole-page accessibility audit. Existing Talk/B+ tests cover 320–2560px, interrupted/repeated replies, reading anchors, keyboard viewport modes, focus, refresh and owner boundaries. Studio regressions use isolated synthetic media and persistence mocks.

Exact final results, screenshots, failures encountered while refining the implementation, commit/tree IDs and restore evidence are in the external checkpoint report. Normal `npm run build` fails at the existing Mirror prebuild download (`EAI_AGAIN storage.googleapis.com`); successful direct webpack compilation is a separate result.

Known prior Quality runs `38391156354` (Talk production) and `38397925358` (Live) remain red: 10 Current Command/identity failures, 108 passes; subsequent Live-policy/commerce and full e2e stages were skipped. The Home handoff browser-storage regression is separately diagnosed and deliberately not modified here. No existing test has been weakened to make this material branch appear green.

Physical Fold/iPhone/DeX keyboards/GPU, Safari, hosted auth/storage, actual paid model or voice, real database persistence and production performance are not demonstrated by this material task. No schema/environment dependency is introduced. Future approval should review the screenshots and unchanged CI blocker separately; rollback of this visual slice is a revert of its isolated commit, with no data migration.
