# Design system — Gent Ascend

Founder-authorized 2026-09-22 migration. See BRAND_IDENTITY.md for exact palette and artwork provenance. Historical Aurelius 1C–1F visual colors are superseded; their interaction and performance safeguards remain in effect.

## Product composition

A private personal command environment: obsidian reading surfaces, deep green focal planes, narrow warm-gold edges and generous spacing. The working dashboard remains the entry point. Strong sans-serif carries tasks and navigation; restrained Georgia serif marks the daily intention, reflection, and account ceremony. Existing local Inter and Sora remain self-hosted.

Gent Ascend leads navigation, account entry, metadata, PWA and loading/error states. Aethelos is used in the shell and account identity, not on every card. Aurelius remains the AI surface and orb. The world page retains planned labels and clarifies Legacy Reserve's separate product identity without presenting a fake shop.

## Surfaces and tokens

Central palette/semantic tokens live in globals.css. Reading panels use 12–14px corners, restrained shadows and fine borders. Daily intention uses #0B3B32 fading into green-black; controls use controlled warm metallic highlights. No violet hue remains in active CSS or orb materials. Warm ivory/gray preserve reading contrast. Primary buttons have dark text on brighter gold.

## Responsive states

- Narrow cover/phone, <=600px: compact crest/wordmark, single-column daily work, anchored bottom navigation and accessible central Aurelius control. Extra compact adjustments below 360px.
- Unfolded/tablet, 601–1100px: intentional two-column dashboard, wider conversation canvas and two-column account composition; bottom navigation stays reachable.
- Desktop, >1100px: persistent sidebar with larger crest, working dashboard columns and conversation library.

Account entrance uses the complete official artwork, without hiding the sign-in form behind an introduction. Profile/goal/auth actions and their server contracts are retained. No artificial onboarding gate.

## Intelligence and motion

Both static SVG and optional Three.js orb now have an obsidian/deep-green core, internal green light and gold orbital geometry. Preserve adaptive resolution, bounded frame rate, cleanup, context-loss fallback, input/dialog pause and Still/solid/OS reduced-motion behavior. Dashboard stays canvas-free.

Listening/speaking remain explicitly labeled visual previews with microphone/audio off. Actual working/save/error states take priority. The branding change in the versioned prompt distinguishes Gent Ascend, Aurelius, Aethelos and Legacy Reserve; all prior capability, memory and safety boundaries remain.

## Verification

See STATUS.md and GENT_ASCEND_MIGRATION.md for observed checks. A browser viewport does not establish physical Fold performance. SQL fixtures do not establish live Supabase Auth. No deployment or live-model claims follow from this visual migration.
