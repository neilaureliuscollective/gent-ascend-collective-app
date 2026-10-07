# Public Aethelios · Aether Petrol

Founder-approved visual direction, 2026-10-07. Applies only to `neilaureliuscollective/gent-ascend-collective-app`. Supersedes all earlier public green/plum palette instructions. No authentication, database, billing, model, memory, or mission execution changes.

## Implementation plan and audit

Inspected root instructions, architecture, the existing Next CSS guide, shared global/theme/material CSS, route CSS, Talk/Council/Missions/Studio, SVG fallbacks, WebGL renderers, metadata, manifest, and installed icons. The previous green was embedded across 33 stylesheets, not just one token. Migrate the shared design system first, then presentation declarations by role, then renderers/assets and responsive verification.

| Role | Approved color |
| --- | --- |
| Midnight Obsidian | #06090D |
| Deep Midnight | #091217 |
| Aether Petrol | #145463 |
| Deep Aether | #0C3542 |
| Luminous Aether | #287E8C |
| Gold / warm highlight | #C4912F / #D8B56A |
| Lunar White / Silver Mist | #F4F5F2 / #A8B0B4 |
| Muted | #737D82 |
| Surface / elevated | #0B1216 / #10191E |
| Quiet border | rgba(255,255,255,0.08) |
| Aether border / glow | rgba(40,126,140,0.28) / rgba(40,126,140,0.18) |
| Gold glow | rgba(196,145,47,0.12) |

`src/platform/visual/aether-palette.json` is the source. Run `node scripts/generate-aether-tokens.mjs` after palette edits; commit the generated CSS. Shader constants and browser metadata consume the same JSON. Historical `--ascend-green-*`, `--green`, and `--surface-green` names are compatibility aliases, now petrol. They do not select another theme. Shell uses `aethelios-aether`.

## Disposition

- Near-black green backgrounds → Obsidian/Midnight; reading panels → Surface/Elevated; colored depth → Deep Aether; emphasis → Petrol; decorative activity → Luminous Aether. Existing alpha coverage retained with token-based color-mix.
- Muted green reading text → Silver Mist; primary neutral text → Lunar White. Bright green decorative light → restrained Luminous Aether or silver. Small text does not use Petrol/Luminous as a foreground.
- Ordinary borders and panels are quiet; selected navigation has a distinct petrol background, luminous edge, and light text. Primary controls use dark material, not solid gold. Council is neutral, and Studio chrome uses the same palette.
- Error, invalid, conflict, warning, and success semantics are excluded from the presentation migration. Error borders in forms remain intact. Domain content, product rendering (`product-stage.ts`), generated Studio compositions (`studio-finish.tsx`), and historical source artwork are not recolored: those are content, not application chrome.
- Both current orb shaders use a near-black core, petrol atmosphere, controlled edge light, and a silver specular highlight. Gold orbit rings are subdued. Static SVG/CSS fallbacks match. Existing bounded rendering, reduced motion, visibility pause and disposal remain. Historical explanatory orb artwork is also aligned without reintroducing it into Command.
- Crest recolored using built-in image generation, preserving the existing A/circle/laurel/star composition. Prompt: change only green enamel to #145463/#0C3542, restrained #287E8C light, near-black #06090D background; preserve gold, composition and AETHELIOS lettering. Versioned assets live in `public/brand/*aether-20261007*`; manifest, Apple icon, app icon, and shared identity updated. Original artwork remains archived. Installed-device icon refresh still depends on OS/PWA caching.
- Existing mobile navigation was underneath fixed Talk. A narrow CSS correction raises the existing three destinations and reserves their measured height; no new navigation architecture. The longer OS descriptor wraps in the desktop rail.

## Accessibility and verification

Normal text uses Lunar White/Silver Mist with at least 4.5:1 contrast across Obsidian, Midnight, Surface, Elevated and Deep Aether. White labels on Petrol also exceed 4.5:1. Muted #737D82 is only suitable for normal text on Obsidian; use Silver for small text on elevated panels. The focus ring has a silver separation so it remains visible over petrol. Selected controls retain structural/state distinctions and aria-current. Forced-color overrides and reduced-motion fallbacks remain.

Observed gate results and remaining limits are recorded in STATUS.md. Screenshots and component/browser fixtures validate presentation, not real account persistence or live-model activity. Physical Samsung Fold, TV, installed PWA cache, real Supabase authentication and production deployment require separate verification.
