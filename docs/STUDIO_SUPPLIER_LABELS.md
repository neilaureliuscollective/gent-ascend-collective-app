# Studio supplier labels

Implementation branch: `codex/studio-supplier-labels`, based on main `f8887d3976ae8f328583a21923fe289d7ef6e9b0`. Work in progress; acceptance receipt below will be updated before review.

## Ownership audit (2026-10-15)

Inspected merged Studio #132 (`e9e8711`) and production receipt #138 (`1c95870`), all open PRs, and all 13 remote branches matching Studio; no label branch or active label owner found. Open #95–98 are the historical narration/footage/delivery/polish stack. Main already carries the later editable production implementation. No source from Talk #131/#135/#139, Architect #130 or navigation #144 is edited or merged here.

Verified gaps on main: `createDesign` ignores saved brand, Product label assigns placeholder 100×70 mm, document has no supplier profile/protected regions, page accepts only project/version handoff, preflight blocks missing assets/fonts only, PDF rasterizes SVG logos. Existing PDF glyphs are already outlined, despite embedding unused fonts. Reuse existing DesignWorkspace, Fabric adapter, history, save+freeze RPC and export jobs.

## Contract and use

Design → Create supplier label. Import `studio-supplier-profile/v1` JSON and matching original template/facts files (SHA-256), an approved SVG, product name/direction or `studio-label-brief/v1` JSON. Choose deterministic layout (explicitly not AI) or approve one request through the existing direct OpenAI SDK/configuration. No model calls were made during development.

The profile is an explicit designer-prepared mapping, **not an Illustrator parser**. Download the actual SKU template from Supliful. Record category, SKU, source/revision/hash, trim dimensions, outward bleed, safe and artwork boxes, matrix reservation and exact protected copy. Coordinates are millimetres from trim top-left. For templates already including bleed, subtract the documented bleed from media dimensions to record trim; exporters add it exactly once. Complex facts tables should be imported as outlined protected SVG regions; text regions are only for exact plain text layouts. No actual supplier SKU template or approved user-uploaded SVG was supplied to this task.

`tests/fixtures/labels/` is an exact synthetic fixture profile with matching source files and an original geometric test logo. It is not Supliful product data or the approved Aethelios brand master. Never manufacture from it. These files document the schema and allow reproduction without invented ingredients/claims.

Talk handoff is narrowly a versioned JSON file: schema, productName, direction, source kind/reference/revision. Studio imports it for review; source metadata is user supplied, not an ownership attestation. No automatic model call or creation on navigation. The Talk owner can author this payload without changing runtime integration in this branch.

Each created design pins profile, facts, brief, saved brand and generation mode. Protected layers and page geometry are immutable; new template/fact revisions require a new design. Existing history, save conflicts, frozen revisions and private assets are preserved. The additive SQL trigger also prevents changing/removing profile metadata and supplier layers through direct RPC updates. Apply only to an authorized environment after existing Studio migrations.

SVG import now parses XML with bounded `saxes` and rejects scripts, events, references, stylesheets, encoded CSS URLs, DTDs, malformed XML and excess depth/count. No arbitrary remote asset import is introduced. Label PDF supports solid-color paths/basic shapes and transforms as vectors; unsupported gradients, clips, SVG text and styles require explicit expansion and are blocked, never silently rasterized. Editable Studio text becomes outlined PDF glyphs. General Studio raster export behavior is preserved.

## Official supplier research, retrieved 2026-10-15

- https://help.supliful.com/en/articles/5579874-how-to-customize-your-first-label — RGB/sRGB PDF, outlined text, embedded images, High Quality Print, under 10 MB, document bleed settings. No universal DPI rule established.
- https://help.supliful.com/en/articles/14949630-label-template-updates — SKU-dependent size/content changes, safe boundary and bottom-left matrix-code reservation. Supplier generates the matrix; do not create it.
- https://help.supliful.com/en/articles/9263056-how-to-work-with-templates-that-have-bleed-areas — template may already include bleed; do not add it twice.
- https://help.supliful.com/en/articles/6930104-all-label-templates — exact templates are per-product downloads.
- https://help.supliful.com/en/articles/5414297-label-design-requirements — 6pt white / 7pt dark guidance is not universal legal approval.
- https://help.supliful.com/en/articles/8727396-label-content-requirements-for-dietary-supplements and https://help.supliful.com/en/articles/8727371-label-content-requirements-for-personal-care-and-beauty-products — category-specific content must come from approved supplier facts.

Technical preflight is distinct from supplier approval. This is RGB artwork, not CMYK/PDF-X/foil. Marketing mockups stay separate. Exact source/profile review, supplier approval, real model quality and hosted Auth/Storage/worker acceptance remain separate gates.
