# Brand identity — founder logo, 2026-09-21

The founder approved the supplied **Aurelius Collective** seal and explicitly made its purple the reference for the application. Dictated “Aureus” is not a product rename. This direction authorizes Aurelius 1C and supersedes the provisional color values in the earlier visual proposal.

## Master and derivatives

- `public/brand/aurelius-master.png`: unmodified 1536×1536 founder attachment, including the detached wordmark and reflection. SHA-256 `4da43c75bdb146ae83a3f255a644ca918e93ff4aaaee2ee9df47838d834bae8a`.
- `public/brand/aurelius-seal.png`: 1254×1254 transparent seal derivative prepared with image generation from the master. Used in the hero and shell via responsive Next Image. It is a regenerated derivative, not a pixel-identical crop or a vector master. Original remains authoritative.
- `src/app/icon.svg`: native vector compact A/orbit/star mark derived from the brand vocabulary. Used at favicon sizes where the full inscription and figure are illegible. PNG 192/512 and Apple 180 renditions are rendered from this vector; maskable PNGs have an opaque obsidian background and central safe-area composition. These are digital app assets, not print-ready minting dies.
- Sora and Inter Latin variable WOFF2 assets and their OFL licenses are in `src/assets/fonts`. Files came from Fontsource 5.3.0; fonts are served locally through Next Font.

Seal preparation instructions: retain the circular composition, kneeling figure, A, celestial globe, gold metal, deep purple enamel and correct inscriptions; remove only the detached lower wordmark/reflection and surrounding background; sharpen edges for an isolated transparent digital asset without redesigning the emblem. The result was visually inspected for the wording and composition. Do not keep regenerating the brand across screens.

The figure is part of the approved emblem. It is not an assistant avatar, health model or reference to the founder's private Atlas AI. Keep the rest of the application modern and human; do not spread classical ornament into every interface control.

## Purple extraction and palette

The original contains textured lighting, not one flat purple. Sampled the circular enamel annulus, excluding gold and near-black neutral pixels with a purple hue filter. Approximate selected-pixel lightness percentiles:

| Sample                      | sRGB        |
| --------------------------- | ----------- |
| Shadow, 20th percentile     | #110214     |
| Median enamel               | **#150319** |
| Lit enamel, 80th percentile | #1A061E     |
| Highlight, 95th percentile  | #200C24     |

138,448 pixels qualified. These are reproducible working observations of this raster, not measured material specifications, a Pantone match or a single universal “correct” purple.

The key character is **very dark, red-biased aubergine**, not electric blue-violet. Use #150319 as the identity anchor. #200C24 carries lit depth; #582164 is an intentionally brighter related light color for restrained decorative illumination. Do not use the latter for small text.

| Semantic role        | Value   |
| -------------------- | ------- |
| Obsidian environment | #09070B |
| Purple enamel        | #150319 |
| Lit purple           | #200C24 |
| Purple illumination  | #582164 |
| Reading surface      | #180F1D |
| Action gold          | #DFBD7D |
| Gold highlight       | #F4DFB1 |
| Primary text         | #F5F1E9 |
| Secondary text       | #BCB2C2 |

Gold is simulated through controlled warm gradients, narrow highlights and shadows. Do not put metallic gradients inside reading text. The seal receives room and contrast; do not recolor it, stretch it, add a competing glow or claim a registration/trademark status we have not established.
