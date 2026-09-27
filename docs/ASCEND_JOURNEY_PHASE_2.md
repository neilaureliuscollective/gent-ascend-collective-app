# The Ascend Journey — Phase 2

Founder authorized September 27, 2026. This is the LifeOS public storytelling slice on top of Phase 1. No private product capability, database, account flow, commerce transaction or model behavior changes.

## Experience

The static six-label diagram becomes one illustrative day moving through the Ascend Loop. A crowded day becomes a chosen health priority, a concrete pre-work action, a recorded result, a reflection and an adjustment. The story is authored presentation data, explicitly labeled, not a member record. Aethelios is presented as context and decision support; the person chooses, confirms and records his own actions. The scene keeps direct OS and member links, while persistent Shop navigation remains available.

## Technical decision

Reuse native scroll, GSAP ScrollTrigger and the Phase 1 public shell. The desktop scene holds its composition across roughly four viewport heights, and stage changes happen on six discrete scroll thresholds. Buttons also select any stage directly. This uses a lightweight CSS instrument with transform and opacity changes rather than a second WebGL canvas or six separate cards. At widths of 900px and below, or heights of 720px and below, the scene flows normally and stage controls remain touch and keyboard operable. Still/reduced-motion also use natural flow with no choreographed scroll or stage entrance animation. No audio or new rendering dependency.

The authored example reflects current member routes: baseline/profile, goals, Aethelios, Command actions, evening review and Progress. It does not imply automatic action writing or an implemented autonomous adaptation engine. The existing public Aethelios orb remains in the preceding scene. The old public loop animation/CSS are removed, not layered under the replacement.

## Gates and limits

Check the six stages by scroll and by button, reverse scroll, chapter anchor, direct exits, focus/pressed state, Still and reduced motion at closed phone, open Fold/tablet and desktop sizes. Physical Fold/Samsung Internet and Safari review remains required to judge pacing and GPU/thermal feel. Field LCP, INP, CLS and conversion need instrumentation after preview review. A browser emulation is not physical-device validation. Future ritual, Reserve, Collective, legacy and auth transitions remain separate slices.

The older founder browser assertions for post-login `/` were corrected to the current `/app` redirect. This is a test expectation fix, not an auth change.

Draft PR #14 CI passed application and database jobs on September 27, 2026: lint, typecheck, 84 unit/SQL tests, production build, public browser interactions, local Supabase integration and founder browser flows. This closes automated gates for the slice, not physical-device or field-performance acceptance.
