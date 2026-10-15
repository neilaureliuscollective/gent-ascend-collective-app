> Superseded for the PUBLIC Aethelios visual palette on 2026-10-07: see [AETHER_PETROL.md](AETHER_PETROL.md). Earlier artwork/direction below is historical; accessibility and lifecycle safeguards remain.

# Gent Ascend Collective — official identity

Founder-authorized migration, 2026-09-22. This supersedes all earlier purple/Aurelius Collective visual directions, including the historical 1C–1F documents. The existing repository and technical identifiers remain stable.

## Brand architecture

- **Gent Ascend Collective**: master brand and men's advancement ecosystem; **Gent Ascend** is the compact display name.
- **Aethelios**: Digital Co-Founder, AI intelligence and scalable extension of the human founder's mission. The former public AI identity is retired. See AETHELIOS_IDENTITY.md for personality, portrait, capabilities and implementation. The human founder remains the source of mission, culture and lived experience.
- **Lifestyle**: Aethelios Lifestyle / Aethelios Human Ascendance is the current customer-facing product brand. **Legacy Reserve** is retired as a current brand name; keep the Shopify handle and historical records. Do not revive it as the live product brand.

Purpose: help men become more capable across presentation, wellbeing, performance, discipline, character, work, relationships, community and legacy. Confident and grounded; no macho slogans or mythology inside ordinary product controls.

## Current in-app identity — 2026-10-15

The founder-supplied Aethelios Human Ascendance lockup is the in-app and website mark: metallic ascending A, celestial star, Earth, **AETHELIOS** and **THE HUMAN ASCENDANCE**. Compact headers use the lettering-free crest beside the readable wordmark. Identity moments (homepage hero, enter, arrival, account, footer, about, ecosystem) use the full lockup. Square artwork is not circular-cropped.

- `public/brand/aethelios-human-ascendance-20261015-master.png`: untouched supplied original.
- `public/brand/aethelios-human-ascendance-20261015-lockup.webp` / `…-crest.webp`: UI renditions from `src/platform/brand.ts`.

The installable application icon is independent and remains the 2026-10-15 gold-A files without wording. See [HUMAN_ASCENDANCE_LOGO.md](HUMAN_ASCENDANCE_LOGO.md) and [AETHELIOS_OFFICIAL_INSTALL_ICON.md](AETHELIOS_OFFICIAL_INSTALL_ICON.md). The circular petrol emblem is retired from the UI.

## Official full crest — 2026-10-03

The founder-supplied `1737.png` supersedes the earlier standing-gentleman full logo for in-app and website identity. Its inscription is **GENT ASCEND COLLECTIVE**. Preserve the architectural A, central guiding star, globe, laurels, rings and motto. Preserve the existing independent installed-app icon, favicon, manifest and Apple icon; this change does not authorize modifying those assets.

- `public/brand/gent-ascend-master-20261003.png`: untouched supplied original.
- `public/brand/gent-ascend-full-20261003.png`: image-generation background extraction, inspected for correct lettering and actual alpha; opaque green/black interior remains.
- `public/brand/gent-ascend-full-20261003.webp`: optimized alpha-preserving UI rendition, shared through `src/platform/brand.ts`.

Use the complete crest at arrival (260px), sign-in (172px), Command hero, account identity, closing invitation and website footer (180px). Existing compact headers/sidebar retain their readable adjacent wordmark; the seal there is recognition, not a requirement to read microscopic inscriptions. Do not repeat it on task cards, product images or the Aethelios orb. No additional persistent animation: reuse the existing finite entrance choreography and reduced-motion controls.

Render with normal composition to keep green depth and metallic contrast. The entrance's previous `screen` blend removed a black matte but washed dark interiors; real alpha replaces that workaround. Its light sweep uses the new crest's alpha mask. Existing global obsidian/green/gold tokens remain correct and unchanged.

Research: Next.js Image documentation (https://nextjs.org/docs/app/api-reference/components/image) supports explicit dimensions, responsive sizes and selective preload; W3C C39 (https://www.w3.org/WAI/WCAG22/Techniques/css/C39) supports respecting reduced-motion preferences. Placement and scale are design judgments based on the actual route/component inspection, not claims prescribed by those sources.

## Archived authoritative artwork

`public/brand/gent-ascend-master.png` is the untouched founder attachment, 567.png. The standing gold figure, green mantle, laurels, celestial geometry and inscriptions remain intact. `scripts/brand-assets.mjs` produces deterministic renditions from these exact pixels; no generated or redrawn figure.

- `gent-ascend-lockup.webp`: optimized complete crest/wordmark, account entrance.
- `gent-ascend-crest.webp`: crest-only framing, responsive shell and profile identity.
- `icon-192.png`, `icon-512.png`, `src/app/apple-icon.png`: exact crest on obsidian, padded for the central maskable safe circle.
- `src/app/icon.svg`: reduced eight-point star and ring from the crest's celestial geometry, for very small favicon sizes where inscriptions are illegible. This is not a replacement primary logo.

Do not stretch the crest or replace it with the Aethelios orb. Use the official crest only at brand/identity moments. Earlier master and seal remain in `docs/brand-archive/` for historical provenance, never imported by the current UI.

## Exact working palette

Obsidian: #050706, #0A0C0B, #101311, #151917.
Green: #071F1A, #092A24, **#0B3B32**, #0E4A3D, #146B58.
Gold: #9D6E1F, **#C4912F**, #D6A84B, #E4BF6A.
Reading text: #F5F1E9; secondary: #B9BCB5.

Tokens are centralized in `src/app/globals.css`; public name, description and asset paths in `src/platform/brand.ts`. Brighter gold supports readable small labels; primary gold anchors metal, active edges and app identity. Green provides focal depth while most reading surfaces remain obsidian. Purple is no longer customer-facing.

## Current installed identity — 2026-10-15

The current installable application icon is the founder-approved gold-A emblem with celestial star and Earth horizon. Versioned standard and maskable PNGs, Apple touch icon and browser icon are generated from that source. Preserve stable app ID `/`, scope `/` and Command start URL `/app`. Older crest generators/assets are historical; do not run them over the current app metadata. See [AETHELIOS_OFFICIAL_INSTALL_ICON.md](AETHELIOS_OFFICIAL_INSTALL_ICON.md).

## Historical installed identity — 2026-10-04

The founder’s subsequent installed-app correction superseded the October 3 exclusion of icon changes. The architectural-A full crest then supplied versioned standard/maskable PNG installation assets. That crest is no longer the current home-screen icon. See releases/INSTALLED_APP_AUDIT_20261004.md.
