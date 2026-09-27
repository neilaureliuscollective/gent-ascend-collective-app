# Threshold and LifeOS visual correction — 2026-09-27

Founder Fold screenshots showed a flat opening (three outlined rectangles, then a small crest) and a LifeOS field of thin circles with disclosure/action copy colliding at unfolded width. This branch changes only those two scenes and their related motion/layout checks. The approved Man sequence, Aethelios, ritual, Reserve, Collective, legacy, auth and commerce routes stay in place.

## Direction

The Threshold is now an authored obsidian/emerald mineral chamber with a physically lit circular passage. It begins with a legible environment and direct exits. Native scroll moves the camera closer; copy clears, the official crest appears in the opening, grows beyond the frame and reveals the path ahead. The crest is the unchanged official artwork. The passage is a concept environment, not a real location.

LifeOS now continues in the same world as a physical six-track instrument and warm illuminated route. The existing six-stage illustrated example, manual controls and truthful product language remain. A bounded image camera move runs across the held section while the stage advances. On Fold/phone, the text, disclosure, actions and six-step rail occupy reserved separate space. No new canvas, realtime 3D human, video decoder, smooth-scroll library or sound system was added.

Four generated environment concept plates were optimized to WebP (115/137 KB threshold landscape/portrait; 143/170 KB LifeOS landscape/portrait). HTML text and links sit above media. Still and operating-system reduced motion keep a readable static composition. Navigation, Shop and member entry remain direct.

## Technical rationale and acceptance

The existing GSAP ScrollTrigger already provides native-scroll scrubbing and refresh measurements; the visual motion is bounded to transforms/opacity. Official [GSAP documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and [web.dev animation guidance](https://web.dev/articles/animations-and-performance) support that approach. Responsive portrait assets reduce crop damage on a closed Fold; [Chrome foldable guidance](https://developer.chrome.com/blog/viewport-segments-api-shipped) describes additional segmented layouts, but this implementation does not assume that API is present.

Inspect first frame, crest reveal, passage, and LifeOS at stage 1 and 5 at 344, 768 and desktop widths. Reverse scroll must restore the matching state. Test short viewport, Still, reduced motion, direct chapter links and footer/rail separation. Browser automation checks geometry and transforms; physical Fold Samsung Internet frame pacing and founder aesthetic judgment remain release gates. Production has not been promoted.
