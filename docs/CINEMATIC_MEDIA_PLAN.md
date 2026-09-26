# Gent Ascend — cinematic media direction

## Story

A life deliberately built. The arc follows one day, with care and responsibility linking each scene: Louisiana dawn → training → grooming → dressing/coffee → purposeful work → people/community → evening reflection. Keep the story personal, with products appearing within real rituals. Reserve footage should show the actual space and professional care when ready.

## Capture and placement

| Placement | Shoot | Composition | Delivery |
|---|---|---|---|
| Opening hero | Louisiana sunrise, live oak, first light, a deliberate start | Dark left space for title; landscape master plus vertical framing | 8–15 second silent loop and sharp still; longer story opens only by deliberate playback in a later slice |
| Ritual chapter | Training hands, water, towel, beard/hair care, dressing, coffee | Close detail, medium context, one unhurried action per shot | 4–8 second loops; actual approved products |
| Collection detail | Bottle, label, texture, dispensing, application | Controlled light; exact packaging and proportions | Product photos first; brief ritual clip per product |
| Intelligence/OS | Real device use, a thoughtful pause, return to the day | Readable genuine screens; no private records | Screen capture or real device film with synthetic demonstration data labeled |
| Reserve gateway | Arrival, actual interior, consultation, Katie's craft, departure | Professional interactions; atmosphere plus human attention | Still plus short loop. Never imply concept interiors are the actual location |
| Founder/about | Neil in his environment, hands at work, direct founder story | Quiet, candid, grounded in Louisiana | Portrait, environmental still, optional interview with captions |
| Closing | Family/community, evening, reflection | Observational, respectful, no staged status display | Still/short loop; permission from identifiable participants |

Male casting follows the founder direction: full head of hair, large full well-groomed beard, composed professional presence. Collaborator portrayals stay professional. Avoid stock alpha imagery, fake testimonials, invented facilities, or medical outcomes.

## Replacement contract

`src/platform/public-world.ts` holds the hero media entry. `MediaScene` accepts poster, alt, credit, video, mobileVideo and focalPoint. Replace the still and optional film sources without rewriting the layout. The component can also be placed within an isolated, positioned section media wrapper for Reserve, ritual and founder scenes.

The current hero uses a 2000×1126 WebP (~357 KB), optimized from an AI-generated concept still. Video is optional and currently unset. Muted inline video starts only in view when reduced motion is off, pauses outside view/hidden tabs, and retains its poster if playback fails. The pause control works without video. Provide posters before introducing film. Load only the hero poster eagerly; below-fold media must remain lazy. Do not preload all section films. Verify contrast and focal crop at 344, 390, 768 and 1440 px.

Set a practical target of <=2.5s LCP, <=200ms INP and <=0.1 CLS at the 75th percentile once field data is available. Local screenshot checks do not establish field performance. Keep title and essential navigation usable before JS/video. Reduced-motion users get the same story with still imagery. Caption meaningful spoken footage and retain readable written equivalents.

## Asset provenance

`public/media/louisiana-dawn.webp` was made with the built-in image generation tool on September 26, 2026 and optimized with Sharp. It is a concept environment, not a verified photograph of a specific Louisiana location. The visible credit says “Louisiana dawn · concept study.” Existing official brand artwork was reused without alteration.

Generation prompt:

> Use case: photorealistic-natural. Asset type: ultra-wide cinematic website hero background for Gent Ascend Collective, a refined men's lifestyle ecosystem rooted in Louisiana. Create a breathtaking film still of a huge ancient Louisiana live oak at dawn, sprawling organic limbs with subtle Spanish moss, a quiet path into the distance, soft low golden sunlight through atmospheric mist, dark deep emerald and obsidian shadows. Natural, grounded, richly textured, shot on large format cinema lens, restrained film grain, excellent realism. Composition: panoramic 16:9 or wider, enormous oak trunk and glowing light mostly in RIGHT HALF; left 45 percent dark uncluttered atmosphere and shadow for later white website type overlay. No buildings, no people, no text, no logo, no border, no watermark. Understated luxury editorial cinematography, warm human atmosphere, no fantasy temple, no sci-fi.

The homepage also accepts `publicWorld.reserveMedia` and `publicWorld.ritualMedia` using the same `SceneMedia` contract. Reserve film replaces the architectural composition; ritual film appears before the product previews. Leaving either unset preserves the finished static presentation.
