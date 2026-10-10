# Imperial Obsidian — implementation and review

Founder direction, 2026-10-10. This supersedes the prior member ivory/steel directions. No founder mockups could be uploaded; implementation follows the written palette and experience brief. No image-to-image comparison has occurred.

## Architecture and inventory

The public member application uses Next 16.3.5, React 19.3, local Inter/Sora fonts, Tailwind 4 and existing Three.js orb renderers. Root `layout.tsx` previously loaded the ivory member theme followed by steel controls and steel environmental overrides. The latter two imports are removed. `imperial-workspace.css` now owns one scoped member material contract. Historical steel styles remain for the public arrival homepage, which is outside this completed member code slice.

`aether-palette.json` remains the shared source and `generate-aether-tokens.mjs` generates compatibility variables. Stable legacy variable names and API contracts are preserved. `Shell` and `Navigation` remain the navigation/layout owners. Talk retains `ConversationViewport`, `AureliusWorkspace`, `TalkPresence`, history/context drawers, composer, real request/save status and scroll behavior. Work retains `CompanyRooms` and existing starter links. Studio retains its project selection, generation/upload controls, storyboard and finish workflows. No provider, Auth, billing, Supabase, database, ownership or entitlement implementation is changed.

## Semantic materials

| Role | Token / material | Use |
| --- | --- | --- |
| Page environment | `--io-environment` #07130F | Spatial canvas |
| Navigation / conversation support | `--io-navigation` #10241C | Shell, drawers, project navigation, code blocks |
| Raised / editorial surface | `--io-raised` #17382B | Panels, notices, user messages |
| Interaction illumination | `--io-interaction` #386049 | Restrained light, selected-state tint; not small text |
| Primary text | `--io-text` #DCE9D6 | Conversation and interface text |
| Secondary text | `--io-secondary` #AEC2AD | Metadata on obsidian/canopy/imperial surfaces |
| Brand gold | `--io-gold` #C4912F | Hierarchy and selection trim |
| Illuminated gold | `--io-highlight` #E8C980 | Labels/links on dark environments |
| Focus | `--io-focus` #E8C980 | 2px ring with environmental separation |
| Dividers / selected edges | `--io-divider`, `--io-selected-edge` | Sage at 18% / 48% |
| Composer | `--io-composer` | Canopy/imperial gradient; dark readable input |
| Metallic primary action | `--io-metal` | Gold gradient with obsidian text |
| Overlay | `--io-overlay` | Obsidian at 91% |
| Error / success / disabled | `--io-error`, `--io-success`, `--io-disabled` | Semantic reserved roles; disabled controls also retain native semantics |
| Loading | Raised surface, secondary text, native `aria-busy` | Actual state, no implied background agency |
| Documents | `--io-document`, `--io-document-ink` | Light storyboard/finish previews and corporate inquiry form |
| Depth | `--io-elevation`, `--io-illumination`, `--io-material` | Static gradients, modest shadows, localized lighting |

The shared luminous compatibility token is calibrated to #47765A for >=3:1 standalone nontext contrast against obsidian. Living Jade remains exactly #386049 for material depth. Secondary text is not suitable on an opaque Living Jade background (3.79:1); selected surfaces use transparent jade over canopy and primary text. Gold text belongs on obsidian/canopy/imperial surfaces, not opaque jade. Preserve semantic error colors and document ink.

Measured text contrasts against environment / navigation / raised surfaces: Pearl Sage 15.03 / 12.91 / 10.18; Misted Sage 10.03 / 8.61 / 6.79; Ascendant Gold 11.81 / 10.14 / 8.00; error text 11.22 / 9.64 / 7.60. These are token calculations, not a whole-page accessibility audit.

## Implemented route code

- `/app/aethelios`: dark compositor, toolbar, history/dialog materials, refined empty state/suggestions, preserved transcript capacity and compact input contract. No AI or conversation lifecycle edits.
- `/app/work`: dimensional Mission Command hero, real company rooms, job starters, links to existing missions/commitments/Studio, honest Architect planning entry. No fake progress, activity or coding capability.
- `/app/studio`: dimensional hero/project navigation, dark tool/composer surfaces, readable status/error states, precise selected tabs. Paper is reserved for document previews.
- `/app/ecosystem`: new connected Intelligence/Health/Lifestyle/Membership destination. Launch lineup is explicitly informational. Existing billing catalog still includes Reserve; no attempt is made to map Architect onto that paid entitlement. Membership management remains authoritative.
- Shared shell applies to other member routes, but those routes have not received individual composition reviews.

Corporate changes are in a separate source workspace recovered from upstream commit `4169c1e86b9235d6d50158d72529326347c7f4bf` on `feat/corporate-headquarters`. Corporate storytelling, navigation, Technologies/Health/Lifestyle division architecture, destination validation and temporary existing wordmark are retained. No logo is invented. The corporate source snapshot omits three historical binary screenshots; upstream review must apply only the scoped diff, not replace repository history.

## Research and deliberate decisions

Read the installed version-matched Next documentation before editing: `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, `01-app/03-api-reference/05-config/02-typescript.md`, and `01-app/03-api-reference/05-config/01-next-config-js/useTypeScriptCli.md`. Next supports root global CSS and warns about stylesheet order; this change replaces the authoritative member stylesheet and removes obsolete layers.

Contrast uses WCAG relative luminance: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html and https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html. Only the installed framework documentation was retrieved in this network-restricted session; external sources above are follow-up reading, not claimed fetched research.

Use static CSS lighting instead of new WebGL environments. No dependencies, new animation loops, continuous rendering or per-pointer lighting handlers are introduced. Existing optional orb rendering/fallback/lifecycle remains unchanged. Existing viewport keyboard measurement, input focus restoration, dialog behavior and context permissions remain unchanged. Reduced-motion removes CSS motion; solid appearance removes atmospheric materials on key environments; forced-colors restores system materials. Responsive Work cards collapse at 700px; Ecosystem divisions stack at 1000px and pricing moves from four to two to one columns. Member bottom navigation uses four equally sized destinations.

## Review status and next phase

Code implementation is reviewable, not visually accepted. See `imperial-obsidian/VALIDATION.md`. Required next pass: actual before/after renders, founder review against the written direction, long conversation/send/save checks with real local identity, uploads/generation checks, phone/Fold/DeX keyboard/safe-area checks, contrast audit of nested controls and reduced-motion/forced-color browser runs. No route is claimed fully visually verified.

Public arrival/entrance and installed-app steel icon assets still need a separately reviewed Obsidian pass. Broader Work missions/tasks/decisions and supporting member environments currently inherit foundation materials but need route-level review. No production merge or deploy is authorized.
