# Aurelius Collective — immersive Life OS proposal

Status: proposed for founder approval; no visual implementation authorized in this research turn.
Research date: 2026-09-21. Baseline: Aurelius 1B, commit a6f31d5.

## Founder decision in one minute

Opening Aurelius should feel like entering a beautifully engineered personal space. Deep obsidian gives way to a soft purple horizon; warm light catches the edges of smoked glass controls. A sculptural dark Aurelius core carries a fine gold rim and restrained orbital detail. The interface has material depth, modern typography and precise responses to touch. Your current direction, a useful next step and the conversation you can resume sit immediately within reach.

Once you begin reading or writing, the environment becomes quieter. The same intelligence presence, materials, spacing and motion rules carry through every domain. This is the proposed foundation for the whole Life OS.

Next phase: **Aurelius 1C — visual system and immersive shell**. Rebuild the visual primitives, navigation, Command and conversation workspace; apply the same language to existing context, memory, profile, goals and empty states. Add one bounded 3D focal element with an excellent static fallback. Retain all existing service and ownership contracts. No GitHub reconnection is needed for local implementation.

## Diagnosis of the existing build

Inspected the actual shell, navigation, Command, conversation components and global CSS, alongside the existing browser screenshots. The issue is broader than adding blur:

- Georgia dominates display text, while Arial carries the interface. Large serif headings, letterspaced micro-labels and numbered navigation give the product an editorial/institutional character.
- Similar purple rectangles and gold borders recur across most surfaces. There is limited distinction between background, content and interactive controls.
- The wide sidebar, page title, secondary conversation library and duplicate conversation selector consume attention before the user's task.
- The gradient sphere lacks a distinctive silhouette and coherent state language.
- Conversation height is derived from viewport subtraction and minimum heights. The previous 768px failure demonstrates why the redesign must reserve task space first, including short screens and the software keyboard.
- The stylesheet has accumulated sequential overrides. The next build should consolidate materials, typography and responsive rules into shared primitives instead of appending another visual patch.

This is a source/layout audit, not a performance benchmark. There are no measured real-device frame, battery or field Core Web Vitals results for this build yet. Existing functional tests are not evidence of rendering performance.

## Research and what it means here

| Evidence                                                                                                                                                                                                                                        | Design consequence                                                                                                      | Limit of the evidence                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Google's expressive-design program reports studies involving over 18,000 participants. Deliberate size, color, shape and grouping improved visual search in tested interfaces; unfamiliar or unlabeled arrangements also reduced usability. [1] | Give Aurelius and the next useful action a clear visual hierarchy; keep familiar navigation labels.                     | These are Google's tests, not proof that our new design will produce the same results or retention.              |
| Apple's Liquid Glass guidance separates the floating control layer from content and warns against glass-on-glass stacking. [2]                                                                                                                  | Use smoked glass for dock, launcher and transient controls. Give reading and data surfaces a much more opaque material. | Native Apple optics are a reference for hierarchy, not a web API we can reproduce automatically.                 |
| Color research describes context-dependent effects and methodological limits. [3]                                                                                                                                                               | Preserve the brand's obsidian/gold/purple; make color roles consistent and test the result.                             | There is no established universal hex code that produces trust, luxury, motivation or retention.                 |
| Self-Determination Theory emphasizes autonomy, competence and relatedness in motivation. [4]                                                                                                                                                    | Let people choose their direction, see real progress and feel supported.                                                | Application to this interface is a design hypothesis; aesthetics alone do not satisfy these needs.               |
| Lally and colleagues studied repeating a chosen behavior in a stable daily context. One missed opportunity did not materially derail formation in that study. [5]                                                                               | Support a small repeatable return ritual and forgiving continuity after absences.                                       | This was a behavior study, not a trial of AI apps or a promise of habit formation within a fixed number of days. |

The intended return loop is: **open → understand what matters → take a useful step → recognize what changed → leave with clarity**. Measure usefulness and voluntary return, rather than minutes trapped in the app. No punitive streak resets, random rewards, infinite feeds, fabricated urgency or messages implying that the AI needs the user's attention.

## Visual specification

### Atmosphere and material

Use a shared four-level scene: near-black environment, softly illuminated background, substantial content surfaces, floating navigation/controls. Light comes from a consistent upper-side direction; edge highlights and shadows agree across components.

The background is a restrained purple light field with a faint warm horizon. It is an abstract spatial environment, with no starfield, particle storm, Roman statue, endless tunnel or animated video behind text. Approximate visual allocation: 80% neutral dark material, 15% purple atmosphere, 5% gold emphasis. These are art-direction proportions, not measurable behavioral claims.

Content cards use a dark opaque fill, subtle inner highlight and broad low-opacity shadow. Glass controls use a darker tint, bounded blur and a thin illuminated edge. Selected items receive deliberate gold emphasis; most resting cards do not have gold outlines. No nested blur layers. Solid-surface fallback must look intentional when transparency is disabled or unsupported.

Proposed tokens retain the existing gold family while refining neutrals:

| Role               | Starting value | Rule                                            |
| ------------------ | -------------- | ----------------------------------------------- |
| Environment        | #08090D        | Primary obsidian ground                         |
| Content surface    | #15151D        | Opaque reference for reading                    |
| Deep purple        | #241330        | Broad atmosphere, low contrast                  |
| Purple light       | #6B438E        | Decorative glow; not body text                  |
| Action gold        | #D6AE62        | Primary action and selection                    |
| Metallic highlight | #F1D99E        | Narrow edge/reflection, restrained              |
| Primary text       | #F5F2EC        | Readable warm white                             |
| Secondary text     | #B6B2C3        | Legible metadata, not barely visible decoration |

Calculated WCAG relative-luminance ratios on the opaque #15151D surface: primary text 16.25:1, secondary text 8.77:1, gold 8.72:1. Purple light is only 2.44:1 and must not be used for meaningful small text or the sole control boundary. Actual glass composites, focus states and gradients still need rendered contrast verification. WCAG AA requires at least 4.5:1 for normal text and 3:1 for qualifying large text. [6]

### Typography and geometry

Propose self-hosted **Sora** for display and **Inter** for interface and long conversation text. Both have open font licensing; retain license files. [7][8] Limit font subsets/weights, provide metric-adjusted fallbacks and avoid remote font requests. Remove Georgia from routine app headings; preserve the product name without committing a new permanent logo.

Use confident medium/semibold headings instead of excessive light weight or huge titles. Body starts at 16px with comfortable line spacing. Main phone title approximately 28–36px; desktop 40–52px where useful. Tiny tracked uppercase copy becomes occasional supporting metadata, never the main wayfinding system.

Use an 8px spacing rhythm with 4px adjustments, 20–28px major surface radii, 12–16px smaller controls and pill geometry for the dock. Nested radii respect padding. Tappable controls target at least 44px, preferably 48px on phones. Use consistent SVG icons, each accompanied by a meaningful label where navigation would otherwise become ambiguous.

### Aurelius presence and 3D

Replace the small gradient ball with an original sculptural core: polished dark volume, soft purple internal depth, a thin champagne-gold rim and one or two precise arcs. It should be recognizable as a still silhouette. Avoid dense HUD rings or a game-character mascot.

Propose one lazy-loaded WebGL renderer on the Command/empty-conversation focal area, with no simultaneous background canvas. Its static SVG/CSS rendition appears immediately. The global launcher always uses the lighter rendition. Candidate implementation: a small Three.js scene, isolated behind a renderer interface; confirm package/API compatibility at implementation before installing. Do not add React Three Fiber, postprocessing stacks or a scene editor without evidence of need. Official Three.js manual pages could not be retrieved in this research environment; no claim of verified library APIs is made.

Use procedural geometry and a small precomputed light/reflection asset; no large external HDR environment, full-screen refraction, shadow-map stack or required video. The effect is decorative and must never control access to chat. Device failure/context loss removes the canvas cleanly and preserves the static core. MDN's guidance supports limiting pixel workload and GPU memory; exact budgets below are project choices. [9]

Represent actual request states: disconnected = steady muted rim; ready = still gold accent; request in progress = restrained movement; saved reply = one brief settle; stopped/error = explicit text and icon. No fake listening, biometrics, emotional detection or percentage-complete animation. Provider state does not imply consciousness or verified correctness.

The future body twin can occupy a larger visual region using the same lighting/material family. It remains a separate renderer of authorized body data, not part of this phase's decorative core or a fabricated scan.

## Screen direction

| Surface               | What the founder will see                                                                                                                                                                                           | Scope/data boundary                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command               | An atmospheric welcome with sculptural core, one clear Aurelius action, current direction and next step. A resume-conversation entry when authorized history exists.                                                | Use actual profile/goal/history. Empty states invite action; no invented daily insight or readiness score.                                         |
| Aurelius conversation | A spacious readable transcript, refined floating composer and contextual controls. The large core recedes when a conversation begins. History opens in a drawer or sits beside the conversation when width permits. | Preserve streaming, stop/recovery, saved acknowledgment and feedback. Remove duplicate full-workspace navigation rather than hiding its functions. |
| Memory and context    | A structured view of what is known, what the user confirmed and what will be included next. Rich surfaces with easy edit/forget actions.                                                                            | No knowledge graph or inferred fact engine added.                                                                                                  |
| Profile and goals     | The same material, type, field and validation language; one clear primary action per section.                                                                                                                       | Existing persistence/version checks remain unchanged.                                                                                              |
| My world / Progress   | Consistent destination design and honest available/coming-later treatment.                                                                                                                                          | No fake metrics, body scan or unimplemented module buttons.                                                                                        |
| Global navigation     | Floating smoked-glass mobile dock with Aurelius visibly central; a compact labeled rail on larger screens.                                                                                                          | Retain the existing four destinations and contextual Aurelius panel. New visual prominence does not add 25 tabs.                                   |

Phone layout prioritizes one useful action above the fold. Unfolded width adds context alongside the active task; desktop provides history and a broader work surface. Layouts respond to available width, text size and keyboard space rather than particular device models. Initial hero guidance: about 160–220px on phones, adjusted down on short screens; it must never push the composer or primary action out of reach. No required cinematic opening sequence.

## Motion and sustained use

Proposed timings: press feedback 100–140ms; selection changes 180–220ms; panels 240–320ms. Animate transform/opacity where possible. Do not animate layout dimensions, blur radius or huge shadows on each frame. These are starting design values, not scientifically optimal durations. Google documents the paint cost of blur and the benefit of profiling/compositing-friendly animation. [10]

Atmosphere may drift slowly in a 16–24 second cycle while the welcome is visible. A visible **Ambient / Still** control pauses it; persist only the display preference locally. Honor reduced motion on first paint. Pause decorative movement during composition, when hidden/offscreen, and in the focused reading state. Reduced transparency and increased contrast use solid materials. No device-orientation permission or accelerometer parallax.

Provide motion controls consistent with WCAG's requirements for automatically moving content and its guidance on interaction-triggered animation. The interaction-animation criterion is AAA; we voluntarily adopt that behavior in addition to our AA target. [11][12] A preference query is not a substitute for an accessible pause control where one is needed.

Continuity should feel personal: resume a conversation, recognize the user's chosen direction and surface something actually completed. Optional morning planning/evening reflection are future entry suggestions, not forced onboarding, scheduled notifications or new behavior-tracking infrastructure in this visual phase. No claims that a particular hue releases dopamine or that darkness improves health.

## Performance contract

The premium experience must remain responsive while typing, streaming and scrolling. Visual effects yield to those tasks.

| Gate                   | Proposed target or rule                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field Web Vitals       | LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile, mobile and desktop separately. Standard guidance, not results already obtained. [13]                                  |
| Immediate rendering    | Text, controls and static core render before optional 3D; reserved dimensions avoid layout shifts.                                                                            |
| Incremental visual JS  | Target ≤40KB gzip on the initial route excluding existing app code; optional 3D module target ≤200KB gzip, measured independently and loaded after useful content.            |
| Art/font payload       | Target ≤250KB compressed first-view decorative assets and ≤120KB combined initial font subsets; no autoplay video download.                                                   |
| GPU workload           | At most one canvas; initial DPR cap 1.5; reduce quality before sacrificing input responsiveness. No frame loop when hidden, paused or offscreen.                              |
| Interaction smoothness | Target 60fps on representative hardware for short UI transitions; decorative canvas can update at 30fps. Measure frame traces rather than promising a universal rate.         |
| Longevity              | Dispose GPU assets/listeners on unmount; test repeated navigation and context loss. Compare effects-on/off during a sustained chat session for heat and perceived smoothness. |
| Fallback               | Still mode and unavailable WebGL retain the same hierarchy and all functions. No user-agent device blacklist or unsupported battery-detection dependency.                     |

Budgets are provisional engineering constraints. Record bundle and performance baselines before code changes. If exceeded, simplify the effect or disclose the tradeoff; do not silently shift the budget. Local lab measurements cannot establish field percentile performance or thermal behavior on Neil's actual phone.

## Implementation sequence after approval

1. **Shared visual foundation.** Capture current responsive and performance baselines. Create semantic color/material/type/motion tokens, self-hosted fonts, Surface/Button/Field/Navigation primitives and one appearance preference. Consolidate the CSS; migrate the shell and representative form states. Review Command and Aurelius at phone, unfolded and desktop widths.
2. **Immersive Command and coherent workspace.** Recompose hierarchy, labeled floating navigation, conversation library and composer. Carry materials into memory, context, profile, goals and honest empty states. No changes to authentication, entitlements, prompts or schemas.
3. **Signature presence and motion.** Implement static core first, then a bounded progressive 3D enhancement and actual-state transitions. Add motion/transparency fallbacks, lifecycle cleanup and focused reading behavior. Keep the full visual silhouette even if a device receives the fallback.
4. **Acceptance and founder review.** Re-run functional gates and capture exact comparison screenshots/motion clips. Check keyboard, focus, reduced motion, solid surfaces, 200% zoom, short screens and keyboard-open layout. Inspect on a real phone before declaring device performance complete.

Proposed component boundaries: `components/visual/{ambient-background,aurelius-presence,surface,appearance-controls}`, `platform/visual` for renderer lifecycle only, centralized token CSS and component-local layout. These are presentation modules, not new business domains. Keep scene animation outside per-frame React state. Server rendering and existing session-bound reads remain intact.

Acceptance must include: all current meaningful tests; 360/390/768/1024/1440 widths plus a short phone viewport; fully visible primary task without clipping; screen-reader labels and focus return; readable contrast over every effect state; no duplicate full-workspace selectors; ability to stop and recover a streamed reply; no private data or writes in disconnected preview; production harness still denied; no scene-related leaks/errors over repeated navigation. Expand interaction tests only for changed behavior.

## Approval boundary and later vision

Approval covers the visual language, screen hierarchy, two-font typography, material system and one optional 3D focal element. It does not approve a different brand, a full body model, a new AI behavior, new clinical capabilities, paid asset subscriptions or production deployment. Auth/backend live acceptance remains open.

Later, the world can grow around the person through a real body twin, meaningful longitudinal progress and carefully scoped community. Each should inherit this visual grammar. The immediate goal is an unmistakable Aurelius environment that remains comfortable through daily use.

## Sources consulted

1. Google Design, [Expressive design research](https://design.google/library/expressive-material-design-google-research). Vendor research; interpreted with its stated context and limitations.
2. Apple WWDC25, [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/). Transcript inspected, including controls/content separation and accessibility. HIG materials page itself required JavaScript.
3. Elliot (2015), [Color and psychological functioning](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00368/full). Research review; not causal evidence for our exact palette.
4. Center for Self-Determination Theory, [Theory overview](https://selfdeterminationtheory.org/theory/).
5. Lally et al. (2010), [How are habits formed?](https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674). Abstract reviewed; no fixed habit-formation deadline inferred.
6. W3C, [Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
7. Sora authors, [Typeface repository and OFL](https://github.com/sora-xor/sora-font).
8. Inter authors, [Font family and licensing](https://rsms.me/inter/).
9. MDN, [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
10. Google web.dev, [High-performance CSS animations](https://web.dev/articles/animations-guide).
11. W3C, [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
12. W3C, [Pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).
13. Google web.dev, [Web Vitals](https://web.dev/articles/vitals).

Research-informed proposals are identified above; there is no claim that this design has already improved Aurelius retention, health outcomes, perceived luxury or runtime performance. Those require testing in the actual product.
