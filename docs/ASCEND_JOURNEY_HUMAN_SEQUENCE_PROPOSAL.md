# Ascend Journey — human sequence proposal

Research and planning only, September 27, 2026. No experience implementation is authorized by this document. It responds to the founder's physical Fold review.

## Decision

Produce one complete Threshold → Man → Aethelios transition with a consistent human subject and a directed environment. Keep native scroll, GSAP, semantic HTML, chapter navigation, commerce exits and the existing member Aethelios renderer. Replace the single standing-man photograph and label fades with a few authored shots and composited spatial layers. Do not extend this grammar to the other chapters until the first sequence passes a physical Fold review.

The current Man scene has one portrait and one landscape still of a man seen from behind. Scrolling scales the image 1.08→1, moves six labels 25px, changes a shade opacity and reveals a line. No pose, expression, camera angle or situation changes. Automated tests proved numeric motion but not meaning. This is an art and media limitation, not a missing animation library.

## The visual sequence

The sequence must communicate with copy hidden and sound off. The man is capable and composed; his life has competing claims on his attention. Avoid a distressed caricature, floating topic chips, fake dashboard or long motivational monologue.

| Beat | Visible action | Scroll behavior |
| --- | --- | --- |
| Threshold | Obsidian space, distant warm source, camera approaches an opening. Direct Shop and member exits remain. | Short establishment, then a substantial camera move. |
| Human | Same believable bearded subject; a wide silhouette resolves into face, hands or three-quarter view. | Subject and camera framing change, not merely the scale of one still. |
| Fragmentation | Three or four lived moments surface through architectural openings or reflections: preparation, work/responsibility, health/recovery, people/purpose. | Distinct states with time to register; a fast scroll can still pass through. |
| Recomposition | He makes a small deliberate action. Competing light and space align; Aethelios forms from that same system, and the camera moves toward LifeOS. | A clear transformation and held reveal, with coherent reverse scroll. |

Exact action, casting and copy are decided in a storyboard/animatic review. The scene must not imply Aethelios automatically reads private domains or acts for him.

## Production and technical route

**Recommended final media:** directed human footage or an offline cinematic render with one consistent subject, wardrobe, environment and lighting. A controlled shoot is the best route to credible skin, beard, expression and movement; architectural layers and intelligence light can be composited later. Concept imagery can validate framing but should not be sold as final live action. A shoot is a recommendation, not a claim that funding or talent is secured.

Before engineering, prepare 6–8 storyboard frames and a short moving animatic in closed-Fold, open-Fold and desktop framing. Source a consistent wide, medium and close shot; portrait and landscape masters; clean poster frames; and depth/mask/light passes where useful. Type, navigation and exits remain accessible HTML above the media. Also prepare coherent still keyframes for Still/reduced motion.

Use a few compressed, muted, inline motion plates for living human moments. Scroll selects and blends shots and drives camera/depth transforms; the existing bounded Aethelios WebGL appears near its reveal. Do not continuously seek a full video on every scroll pixel by default: seeking is asynchronous and must be tested for stalls. A small pre-rendered image sequence can provide exact scrubbing for one transition if the Fold handles its download and decode cost. Full real-time 3D character modeling is deferred. [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [image sequence helper](https://gsap.com/docs/v3/HelperFunctions/helpers/imageSequenceScrub/), [media seeking](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event).

Keep one native document scroll. No wheel/touch capture, mandatory film, forced snap or autoplay sound. The closed Fold gets close portrait framing and sequential reveals; the open Fold can show subject and environment together. Eagerly deliver a crisp first poster, load later plates only as the scene approaches, and pause/unload invisible media. Preserve the first frame if playback fails. Muted inline media, poster/preload behavior and reduced-motion stills need Chrome, Samsung Internet and Safari checks. [WebKit inline video policy](https://webkit.org/blog/6784/new-video-policies-for-ios/), [web.dev video performance](https://web.dev/learn/performance/video-performance), [lazy video loading](https://web.dev/articles/lazy-loading-video).

## Build sequence after approval

1. **Creative gate:** storyboard, 6–8 keyframes and timed Fold/desktop animatic. Founder judges the human and emotional arc before expensive production engineering.
2. **Media proof:** source/create one consistent subject and shot set. Compare short motion plates with one bounded image sequence on the actual Fold. Select the delivery method from visual continuity, load, decode and reverse-scroll behavior.
3. **Integrated vertical slice:** build Threshold → Man → Aethelios on an isolated preview branch. Keep navigation, Shop, account, Still and reduced motion. Retire the old still/labels only when the replacement is complete.
4. **Acceptance:** record normal and fast swipes on Fold closed/open, Chrome/Samsung Internet, iPhone Safari and desktop. Check refresh mid-scene, reverse scroll, fold/unfold, tab return and GPU fallback. Compare the old and new previews side by side before extending the visual grammar elsewhere.

## Acceptance gates

**Meaning:** With copy obscured and sound off, a new viewer should describe a man with competing responsibilities whose world becomes clearer. If they report “a photo, labels and an orb,” the scene fails even if every animation test passes.

**Motion:** A normal thumb gesture must cause an obvious change in subject, camera or environment; each state holds long enough to register without trapping someone who scrolls quickly. No black frame, subject jump, text collision or stalled decode.

**Performance and business:** Aim for good field Core Web Vitals (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1), track media bytes and decode stalls, and profile on the actual Fold. These are targets, not measured results. Shop, member entrance and chapter links must remain immediately reachable. [Web Vitals](https://web.dev/articles/vitals), [Chrome Android remote debugging](https://developer.chrome.com/docs/android/overview), [Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames).

## Pressure test

| Approach | Decision |
| --- | --- |
| Increase the current scale, fades, particles, labels or pin length | Reject: louder motion on the same still does not create a human story. |
| Real-time 3D human | Defer: expensive character art and believable movement, plus mobile render risk. |
| One long scroll-scrubbed video | Prototype only: arbitrary seeking may stall or jump on phones. |
| Directed human shots + composited space + existing Aethelios | Recommended: stronger emotion with bounded device load and retained interaction. |

NRK's scroll-storytelling case study describes motion that establishes mood and advances narrative meaning. This proposal applies that principle to Gent Ascend rather than adding decorative movement. [NRK / Chrome case study](https://developer.chrome.com/blog/nrk-casestudy).
