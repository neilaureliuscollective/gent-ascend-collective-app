# Living Estate + founder crest — September 26, 2026

Founder approved the four-step environmental plan and new supplied crest. Scope: homepage environment and shared brand identity. Auth, private data, AI contracts and commerce activation remain unchanged.

## Art direction and scene plan

Arrival: existing Louisiana pavilion and oak image with ambient light and mist; native scroll threshold retained.
Ritual: existing campaign imagery with ambient illumination.
Collection: emerald stone gallery, fluted bronze/stone pilasters, engraved laurels and celestial chart; transparent packaging visualization with plinth/shadow and real product selector.
Intelligence: observatory architecture, star chart and new graduated armillary instrument. Green faceted core, brass bands/cardinal beads, static pedestal, slow time-based rotation plus scroll orientation. No personal data or implied sensing.
Reserve: separate warm walnut/emerald salon concept. Removed incorrect Gent crest representing Reserve. Explicit concept label; not documentary venue photography. Independent Reserve site unchanged.
Legacy: Louisiana oak scene retains human story and subtle atmospheric motion.
Invitation: architectural gallery treatment, full founder seal and illuminated entrance action.

Each scene has foreground copy, environment, light/mist and restrained star layer. Copy stays real accessible HTML. Native scroll stays authoritative. No gesture hijack, forced introduction, or purchase simulation.

## Identity placements

- Full original new crest: public navigation, shared workspace shell, Command identity, profile/account entrance, homepage member ceremony.
- Header/sidebar: circular clipping removes square black corners; adjacent live wordmark remains readable.
- Complete master preserved at public/brand/gent-ascend-master-20260926.png; older masters preserved.
- Generated star/laurel companion: Apple touch icon, opaque 192/512 PWA icons; maskable symbol fits central safe circle. Existing minimal star favicon remains consistent with the new crest's star.
- No full crest on every content card and no master-brand stamp presented as the Reserve's logo.
- Versioned icon URLs and offline cache v2. Existing installations may refresh icons on the platform's schedule; no claim of immediate installed icon update.

## Asset provenance and prompts

Built-in image generation used (not CLI/API). Final optimized assets tracked in this repository. Generated artwork is concept/packaging visualization, not final manufacturing artwork. Full founder crest is resized only, never generatively redrawn.

Prompt set:
1. Companion: simplified eight-point gold compass star, paired gold laurels, deep emerald enamel; no text/figure; opaque green square; central safe area.
2. Observatory: widescreen emerald marble classical columns, bronze/laurel detail, celestial dome at right, empty circular dais, darker left copy space, Louisiana oak glimpses; no text/people/orb.
3. Gallery: emerald stone product room, fluted pilasters, bronze laurels, left alcove and console, quiet engraved chart on right; no products/text.
4. Sanctuary: intimate Louisiana men's salon concept, emerald chair at right, walnut/bronze arched mirror and warm lighting, quiet left wall; no signage/people.
5–9. Product edits: remove only background/floor from each supplied Vitalis, Obsidian Wash, Obsidian Crème, Ascend and Hydros reference; preserve bottle/label/text; true alpha. Original packaging references retained. Generated cutouts visually reviewed but not pixel-identical source extractions; final flat label artwork remains authoritative.

Files: public/media/world/{gallery,observatory,sanctuary}.webp; five *-cutout.webp; public/brand/ascend-star-v2.webp; founder crest-v2.webp. Identity derivatives reproducible with scripts/estate-identity-assets.mjs.

## Engineering

SceneAtmosphere uses IntersectionObserver and document visibility to pause independent CSS ambient loops. Still mode and system reduced motion disable all new ambient/entrance animations. Environments lazy-load using Next Image; existing opening LCP asset unchanged.

Three.js imports near viewport, capped DPR 1.5, approximately 30 rendered frames/s maximum; no React state per frame. Environment reflections from Three RoomEnvironment/PMREM. Geometry/material/environment/render resources disposed on unmount, Still mode or context loss. Static CSS fallback available without WebGL. No full-screen post-processing or real-time shadow maps.

GSAP adds modest environment depth moves using existing scoped/reverted timeline lifecycle. Chapter bar reduced to 44px minimum; phone horizontal chapter scrolling preserves touch targets and direct destinations.

## Research (accessed September 26, 2026)

- https://tympanus.net/codrops/2026/07/15/the-architecture-behind-trionn-coordinating-gsap-three-js-lenis-and-web-audio/ — coordinated ambient/scroll/interaction architecture, not copied stylistically.
- https://www.metmuseum.org/essays/architecture-in-ancient-greece — relationships and proportions across architecture.
- https://threejs.org/manual/pages/shadows.html — cost of shadow rendering; prefer authored lighting here.
- https://web.dev/articles/maskable-icon — opaque adaptive icons, central safe circle radius40%, separate purposes.
- https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html — pause ongoing decorative movement.
- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html — reduced-motion alternative.

## Release boundaries

This is layered 2.5D scenery with a real-time armillary, not a fully traversable 3D building. Real film and physical Reserve photography can replace concept assets. No final product CAD models, scanner, real-time voice or new commercial capabilities. Browser emulation cannot establish physical Fold GPU/battery behavior or installed icon refresh. Existing V1 invited-user release gates remain outstanding independently of this visual milestone.
