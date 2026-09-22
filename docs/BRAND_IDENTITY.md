# Gent Ascend Collective — official identity

Founder-authorized migration, 2026-09-22. This supersedes all earlier purple/Aurelius Collective visual directions, including the historical 1C–1F documents. The existing repository and technical identifiers remain stable.

## Brand architecture

- **Gent Ascend Collective**: master brand and men's advancement ecosystem; **Gent Ascend** is the compact display name.
- **Aurelius**: the intelligence within Gent Ascend. Existing API routes, data tables, environment names, saved preferences and assistant identity retain Aurelius.
- **Aethelos**: the composed gentleman archetype in the official crest. He stands with self-command; he is not Atlas, Zeus, a warrior or the AI.
- **Legacy Reserve**: separate grooming/wellness product and commerce brand. Do not rename it to Gent Ascend.

Purpose: help men become more capable across presentation, wellbeing, performance, discipline, character, work, relationships, community and legacy. Confident and grounded; no macho slogans or mythology inside ordinary product controls.

## Authoritative artwork

`public/brand/gent-ascend-master.png` is the untouched founder attachment, 567.png. The standing gold figure, green mantle, laurels, celestial geometry and inscriptions remain intact. `scripts/brand-assets.mjs` produces deterministic renditions from these exact pixels; no generated or redrawn figure.

- `gent-ascend-lockup.webp`: optimized complete crest/wordmark, account entrance.
- `gent-ascend-crest.webp`: crest-only framing, responsive shell and profile identity.
- `icon-192.png`, `icon-512.png`, `src/app/apple-icon.png`: exact crest on obsidian, padded for the central maskable safe circle.
- `src/app/icon.svg`: reduced eight-point star and ring from the crest's celestial geometry, for very small favicon sizes where inscriptions are illegible. This is not a replacement primary logo.

Do not stretch the crest or replace it with the Aurelius orb. Use Aethelos only at brand/identity moments. Earlier master and seal remain in `docs/brand-archive/` for historical provenance, never imported by the current UI.

## Exact working palette

Obsidian: #050706, #0A0C0B, #101311, #151917.
Green: #071F1A, #092A24, **#0B3B32**, #0E4A3D, #146B58.
Gold: #9D6E1F, **#C4912F**, #D6A84B, #E4BF6A.
Reading text: #F5F1E9; secondary: #B9BCB5.

Tokens are centralized in `src/app/globals.css`; public name, description and asset paths in `src/platform/brand.ts`. Brighter gold supports readable small labels; primary gold anchors metal, active edges and app identity. Green provides focal depth while most reading surfaces remain obsidian. Purple is no longer customer-facing.
