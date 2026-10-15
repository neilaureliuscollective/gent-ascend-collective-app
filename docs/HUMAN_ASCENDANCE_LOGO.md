# Aethelios Human Ascendance in-app logo — 2026-10-15

Founder-supplied square lockup: metallic ascending A, celestial star, Earth horizon, **AETHELIOS** wordmark and **THE HUMAN ASCENDANCE** inscription. This is the in-app and website identity. It does not replace the installable application icon.

## Asset contract

- `public/brand/aethelios-human-ascendance-20261015-master.png`: untouched 1254×1254 founder original.
- `public/brand/aethelios-human-ascendance-20261015-lockup.webp`: full lockup for identity moments.
- `public/brand/aethelios-human-ascendance-20261015-crest.webp`: compact mark (A, star, Earth only) for headers and the member shell.
- `src/app/opengraph-image.png`: 1200×630 social card from the same lockup.

`node scripts/human-ascendance-brand-assets.mjs` reproduces the WebP and Open Graph files from the master. It does not write PWA, Apple or browser icons.

Install identity remains `public/brand/aethelios-official-20261015-*`, `src/app/icon.png` and `src/app/apple-icon.png`. See [AETHELIOS_OFFICIAL_INSTALL_ICON.md](AETHELIOS_OFFICIAL_INSTALL_ICON.md).

## Placement

Shared through `src/platform/brand.ts`.

| Surface | Artwork |
| --- | --- |
| Public header, member sidebar/mobile brand, Lifestyle hero mark, 404/error | Compact crest |
| Public homepage hero, enter, arrival flight, account, welcome, Command emblem, about, ecosystem, website footer, Open Graph | Full lockup |

The retired circular petrol emblem (`aethelios-aether-20261007.webp`) is no longer imported by the UI. Square artwork is not circular-cropped.

## Research

Inspected current routes, `brand.ts`, shell/header/footer, arrival, enter, account, Command, Lifestyle, Ecosystem, loading/error, Open Graph, manifest and install icon scripts on 2026-10-15. Next.js App Router Image (`next/image`) supports explicit dimensions and `sizes`. W3C C39 supports respecting reduced-motion; this change introduces no new motion. Open Graph uses the App Router `opengraph-image` file convention from installed Next 16.3.5.

## Production

PR #142 merged as `af29723`. Live https://www.gentascend.com `data-dpl-id=dpl_Dq6DwWY2sPfbtxLsr2CnY6qAZ7oR` serves the lockup and crest. Install icons remain the 2026-10-15 official gold-A files.

## Limits

Physical-device launcher refresh is unchanged and remains an OS/browser step. This work does not alter authentication, membership, Studio, Talk or installed-app metadata. Isolated Production for `af29723` was canceled when later main `bbda46f` assigned; the live artifact still contains the logo merge.
