# Official Aethelios install icon — 2026-10-15

Founder-approved gold-A application icon: metallic ascending A, central celestial compass star, Earth horizon, and obsidian/emerald atmosphere. No wording or substitute artwork. This supersedes the 2026-10-10 Imperial Obsidian crest for installation, Apple touch, and browser icons. In-app crest, lockup, routing, authentication and application identity are unchanged.

## Asset contract

`public/brand/aethelios-official-20261015-source.png` is the approved 1254px square original. `public/brand/aethelios-official-20261015-master.png` is the opaque 1024px standard master. Baked iOS corner cutouts are filled with a full-bleed obsidian-emerald field so operating systems can apply their own masks. The matching maskable master scales the same artwork into the W3C safe circle on that same atmosphere.

`node scripts/current-app-icons.mjs` reproduces:

- manifest any 192/512
- maskable 192/512
- Apple 180
- browser 64

Do not bake rounded corners into these square exports. Next `app/icon.png` and `app/apple-icon.png` metadata conventions produce the corresponding head links.

New manifest filenames are versioned. Previous install URLs redirect to them. Service-worker fallback cache v8 refreshes its static icon without reloading pages or private drafts. Installed launcher icon updates remain controlled by the browser/OS. Existing install guidance includes Refresh an older app icon; removing the home-screen shortcut and reinstalling may be necessary, without deleting application accounts or records.

Manifest identity is unchanged: `id` `/`, `scope` `/`, `start_url` `/app`, name `Aethelios`, `display` `standalone`.

## Research and checks

W3C manifest: https://www.w3.org/TR/appmanifest/#icon-masks . Essential maskable art belongs within the central circle of radius 40% of image width. Standard and maskable assets are distinct. Chrome 144+ icon updates require changed icon URLs: https://developer.chrome.com/blog/improvements-to-web-app-updates . Installed Next 16.3.5 metadata app-icons documentation was read before integration.

All PNG export dimensions and opacity checked. A pixel check evaluates gold artwork outside the maskable safe circle. Physical-device launcher refresh and full browser installation are not claimed tested in this execution environment.
