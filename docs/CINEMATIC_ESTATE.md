# Gent Ascend cinematic homepage — September 26, 2026

Founder approved implementation after the cinematic-world research. This supersedes the homepage's editorial-card composition in CINEMATIC_EMERALD.md. Existing public routes and private OS remain intact.

## Storyboard and implemented composition

1. Arrival: original imagined emerald pavilion, Louisiana live oak and dawn. Left-aligned brand definition and direct entrance; portrait framing moves copy below the brightest light.
2. Threshold: native scroll drives a restrained push into the same environment. Hero copy gives way to the world proposition, then an emerald veil connects the cut to ritual. Still/reduced-motion removes the extended scroll space.
3. Ritual: original Vitalis campaign environment with matching stone/light. Front reference preserves the packaging direction; a product selector then shows all five founder-supplied references without pretending those photographs are 3D models.
4. Intelligence: emerald and gold orbit sculpture. Three.js loads near view, renders on scroll/resize only, and disposes on Still mode, route departure or context loss. CSS sculpture is the fallback. No private data, fake conversation or live intelligence claim.
5. Reserve: stylized architectural reveal, explicitly labeled as a brand study rather than actual interior photography. Links into the existing Reserve introduction.
6. Legacy/invitation: existing Louisiana oak composition provides quiet contrast; private invitation and products remain directly reachable.

## Asset provenance

- `public/media/world/arrival.webp`: original built-in image generation, source `exec-f260d27d-5146-431c-acdb-900d8b89b9d3.png`.
- `public/media/world/ritual.webp`: built-in image generation using the founder Vitalis reference, source `exec-e5dfb3b3-2cf3-4439-9149-77eb42217e3c.png`. Campaign visualization, not documentary product photography. Small lettering/geometry must be reviewed against final flat artwork before merchandising approval.
- `vitalis.webp`, `ascend.webp`, `hydros.webp`, `obsidian-wash.webp`, `obsidian-creme.webp`: optimized copies of supplied packaging references 532, 533, 534, 535, 536 respectively. No pricing, stock or purchase claim.
- Existing `/media/louisiana-dawn.webp`: concept imagery retained.

### Generation prompts (built-in tool)

Arrival: Original photorealistic cinematic architectural environment for Gent Ascend. Wide landscape. View inside a refined dark emerald limestone pavilion toward a majestic Louisiana live oak at dawn. Deep emerald textured portals, fine brushed brass, dark reflective floor, warm natural light. Vanishing point near 62%, shadowed left space for HTML copy. Believable materials, atmospheric depth. No text/logos/people/products/neon. Imagined brand environment, not an actual Reserve location.

Ritual: Composite using supplied Vitalis reference. Preserve black pump silhouette, emerald label, LR crowned laurel emblem and product wording. Bottle near right 65% on wet emerald stone, warm diagonal dawn light, subtle steam, black reflection, fine gold ledge. Shadowed left 40% for HTML. No extra products, floating objects, added text or gold hardware. Photorealistic campaign setting.

## Implementation contract

- Next server page owns content; WorldJourney owns GSAP/ScrollTrigger and cleans up through useGSAP/matchMedia. Native scrolling is retained; no forced snapping, wheel capture or splash/loading gate.
- `src/platform/estate-media.ts` holds poster, alt, credit, focal point and optional desktop/mobile films using the existing SceneMedia contract. Updating approved media requires no layout rewrite. MediaScene pauses films offscreen, while hidden, or under Still/reduced motion. Film errors/autoplay denial leave posters visible.
- Persistent public navigation and scene index provide direct destinations. Product selector uses real buttons, pressed state and live text updates. Preview-only availability remains explicit.
- Keep Three.js outside the initial homepage bundle. One intelligence renderer, capped DPR 1.5, no continuous idle loop. Semantic content is independent of graphics.
- Mobile composition is explicitly different: product scene art above copy, orbit above intelligence copy, shorter opening; unfolding/resizing refreshes ScrollTrigger measurements.

## Research decisions

- Active Theory, Santioni/Notturno production account, 2026-09-17: storyboard and color progression before effects; continuity between spatial scenes and text. https://lbbonline.com/news/the-notturno-experience-how-we-built-santioni-spirits-launch
- GSAP React cleanup, scoped hooks, Next client boundaries: https://gsap.com/resources/React/
- Native scroll timeline control: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Responsive/reduced-motion teardown: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- glTF/PBR color: consistent material, environment, and camera required: https://modelviewer.dev/examples/color
- Future exact merchandise assets: GLB + compressed textures using GLTFLoader/KTX2Loader. https://threejs.org/docs/pages/GLTFLoader.html
- Media scheduling: https://web.dev/learn/performance/video-performance

## Deliberate remaining boundaries

This is a hybrid 2.5D/3D web experience. Arrival is an original rendered composition with scroll-driven scale and staged text, not a fully modeled walkable estate. No fabricated claim of a virtual estate or finished film. Five products use supplied front references; final textured 3D merchandise requires flat artwork/container dimensions. The older optional Vitalis packaging study on its detail page is still explicitly conceptual and is not a final accurate SKU model.

No Shopify checkout, scanner, guest AI, new account permissions, membership billing, Reserve booking integration or database changes. No production promotion in this milestone. Physical Fold/iPhone GPU pacing, battery and touch acceptance remain unverified until tested on hardware. Core Web Vitals targets are goals, not measured production outcomes.

### Phone art correction

Browser inspection found that a landscape campaign source cropped the Vitalis pump on narrow phones. Added `ritual-mobile.webp` (built-in source `exec-3075189e-8e99-4371-8e2b-93d8e066cd0c.png`) and a `mobilePoster` picture source in SceneMedia. Portrait prompt: preserve supplied Vitalis packaging, entire bottle centered in upper half of 1024×1536 emerald-stone composition, warm upper-right dawn beam, ledge near middle, lower half shadowed empty green for HTML copy, no additional products/text/hardware. Optimized desktop/phone assets combined are approximately 1.1 MB; they are not all initial-load resources. This is an asset-size observation, not a Core Web Vitals result.
