# Official Imperial Obsidian install icon

Founder-approved 2026-10-10 adaptation of the supplied official logo: remove AETHELIOS and THE HUMAN ASCENDANCE lettering; retain ascending A, laurels, compass stars, orbital geometry, globe and concentric metallic gold framing. This is a raster interpretation for installation, not a replacement of the in-app master artwork.

## Asset contract

`public/brand/aethelios-imperial-obsidian-20261010-master.png` is the opaque 1024px standard master. The matching maskable master has extra obsidian-green environmental padding. `node scripts/current-app-icons.mjs` reproduces manifest any 192/512, maskable 512, Apple 180 and browser 64 exports. Do not bake rounded corners into these square exports. Next app/icon.png and app/apple-icon.png metadata conventions produce the corresponding head links.

New manifest filenames are versioned; old install URLs redirect to them. Service-worker fallback cache v6 refreshes its static icon without reloading pages or private drafts. Installed launcher icon updates remain controlled by the browser/OS. Existing install guidance includes Refresh an older app icon; removing the home-screen shortcut and reinstalling may be necessary, without deleting application accounts or records.

## Research and checks

W3C manifest: https://www.w3.org/TR/appmanifest/#icon-masks . Essential maskable art belongs within the central circle of radius 40% of image width. Standard and maskable assets are distinct. The generated maskable crest is deliberately padded. Installed Next 16.3.5 metadata app-icons documentation was read before integration.

All PNG export dimensions and opacity checked. Standard 192px artwork visually inspected. A pixel check evaluates gold artwork outside the maskable safe circle. Lint/typecheck and deployment build results are recorded in the release receipt. Physical-device launcher refresh and full browser installation are not claimed tested in the restricted execution environment.
