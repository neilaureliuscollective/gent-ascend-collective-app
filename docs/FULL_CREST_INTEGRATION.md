# Official full crest integration

Scope: in-app and website only. Official name is Gent Ascend Collective, as inscribed in the attachment. No installed-app icon files or manifest changed.

Preparation used the built-in image-generation edit tool. Prompt: remove only the exterior black square; preserve exact full crest, opaque green interior, gold metal, A, stars, globe, laurels and all inscriptions; output actual alpha transparency with clean edges, no external glow, no redesign or recoloring. The output was inspected and exported as quality-92 WebP with alpha quality 100. The supplied master is retained untouched.

Placements follow the existing brand architecture: entrance flight, public threshold and closing invitation, member sign-in, shared public header, member sidebar/mobile header, Command hero, welcome, account/profile and website footer. Readable wordmarks accompany compact seals. The large full crest is reserved for identity moments, not ordinary controls or cards. Aethelios and Legacy Reserve keep their separate identities.

The existing entrance uses the new alpha silhouette for its finite sweep. Normal composition replaces screen blending so the dark green crest interior does not dissolve into backgrounds. No new motion, canvas or dependencies are introduced.

Observed checks: lint, Next type generation/TypeScript, production build, migration-ledger check and diff whitespace check pass. Unit suite: 217 pass, 6 fail in existing performance progression database tests; the same six failures reproduce on untouched main at eba810c, including check-in date-range failures. No domain or database code changed here.

Asset check: WebP is 1254×1254 with alpha; all four corners have alpha 0, interior remains opaque. Generated output lettering and crest composition were visually inspected. Source and WebP are square; UI retains explicit intrinsic dimensions and responsive sizes. No new client runtime or dependency added. React review: server-rendered footer, empty alt for decorative repeated marks, descriptive alt for standalone crest, link accessible names retained.

Browser/viewport verification could not run: no Chromium executable is installed and the Playwright browser download returned a truncated/non-ZIP response. Phone, Fold and desktop visual/interaction acceptance remain unverified; do not call this release-ready or claim all checks passed. Existing entrance regression expectation was updated from screen to normal composition; its motion/replay/skip assertions are retained, but unrun.

No production deployment performed. Independent app-icon/manifest paths remain unchanged.
