# Ascend Journey — motion recovery and next art direction

## What the founder observed

On the phone preview the chapter changes were visible, but scrolling felt like a normal page. This was a real implementation defect in the experience: the opening timelines, LifeOS progression, and ritual hold were gated behind a 901px and 721px media query, while mobile CSS explicitly removed sticky scene geometry. A Fold in either posture did not get the authored motion. Desktop also relied too much on small opacity and translation changes after the opening. Build and visual checks had not asserted meaningful intermediate scroll states on phones.

## Corrective slice in this branch

- Native scrolling remains the controller. Threshold, Man, and Aethelios are held compositions on phone, open Fold, and desktop. The light, mark, figure, signals, resolution and intelligence field each transform over measured scroll distance. A chapter link still jumps directly to its scene; there is no captured wheel or compulsory film.
- LifeOS now advances through the same six real stages during a held mobile composition. The phone view uses one story and a tactile numbered rail instead of six boxed controls. A manual stage selection scrolls to its corresponding position; Still and OS reduced motion retain a fully readable, manually controlled layout.
- The ritual holds its two photographic beats in one stage on mobile as well as desktop. Inactive links are inert, the active destination remains available, and the outgoing text is hidden during the image transition.
- The mobile Still control is compact so it does not cover the stage rail. It retains its accessible name and remains a direct escape from motion.

## Research and design decision

GSAP ScrollTrigger [documents](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) scrubbed native-scroll timelines, refresh and responsive setup. The existing GSAP dependency already solves this bounded problem. We avoid a second scroll library, document-level scroll normalization and a fresh 3D scene. [Chrome's viewport guidance](https://developer.chrome.com/blog/whats-new-css-ui-2023) explains why `svh` provides a stable small-viewport scene when the mobile browser chrome changes. [web.dev's animation guidance](https://web.dev/articles/animations-and-performance) favors transform and opacity for scroll animation; the new scene timelines animate those properties. Reduced motion and Still remove the hold and preserve content in document flow. The existing Aethelios renderer remains visibility aware, and we do not add another canvas or texture load.

## Verification gate

At 344×660/740, 768×900, and 1440×900 verify: scene stage remains in place while scrolling; emblem opacity/scale, human resolution and Aethelios opacity/scale change at intermediate positions; LifeOS advances and reverses; ritual advances and reverses; no horizontal overflow; header, chapter index, Shop, account and scene exits remain operable. Also verify Still, OS reduced motion, anchor arrival and back navigation. A production build and browser automation are necessary but cannot establish Fold GPU frame pacing, thermal behavior, sunlight legibility or touch feel. Founder review on the physical Fold is the acceptance gate.

## Next aesthetic pass after physical review

This repair proves choreography; it does not declare the whole eight-scene vision complete. The opening still uses an existing flat crest asset and simple depth planes. The public Aethelios reuses the member renderer but needs a better authored reveal, lighting and visual relationship to the person. Later collection and information surfaces still contain card language. The next art pass should create one high-fidelity Threshold → Man → Aethelios transition first: art-directed source imagery and emblem materials, depth and occlusion, fewer labels, a clear person-to-intelligence handoff, and precise timing measured on hardware. Then carry the proven visual grammar through Reserve, Collective and Legacy. Product detail and checkout stay direct destinations. Do not solve this by adding unbounded particles, another orb, or autoplay video.

## Preview release discipline

Publish this as a separate draft branch and protected preview. Do not promote the stacked phase branches to production from this correction. Compare the new preview on the founder's Fold in both postures before expanding the visual pass. If the live device reports a dropped/stalled stage, capture viewport, browser, motion setting and scene, then tune that measured bottleneck rather than disabling mobile choreography again.
