# Whole Man World Phase 2 — spatial mobile experience

Founder authorized research, planning and implementation on October 2, 2026. This extends Draft PR #33. It does not promote production.

## Diagnosis and decision

The saved first slice connects real routes correctly, but its mobile composition is still a vertical page: title, small orb, horizontal tabs, repeated destination copy and an always-visible reflection form. Its scene barely responds to selection. Changing colors or adding more bordered surfaces cannot resolve this.

Build an atmospheric spatial navigator with four stable, labeled destinations, a large central Aethelios presence and one selected destination action. Keep the standard HTML navigation and domain services under the visual layer. Present reflection in the existing accessible sheet. Preserve direct entry, sound choice, Still, reduced motion, graphics fallback and the existing Performance task.

## Research and comparison

Primary sources checked October 2, 2026. The limitations column is our product judgment about suitability for Gent Ascend, not a claim that we conducted usability trials of these products.

| Reference | Useful principle from the source | Limit for this product | Implementation decision |
| --- | --- | --- | --- |
| [Apple: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) | Material, light and response work together; controls form a separate layer above content. | Reproducing glass everywhere would compete with the dark scene and its labels. Native optical effects are not a browser library. | Solid, legible controls over atmospheric scenery; warm highlights and immediate press feedback, without stacking blurred panels. |
| [Apple: immersive experiences](https://developer.apple.com/design/human-interface-guidelines/immersive-experiences/) | Depth, scale and controlled attention support immersion; users retain control. | Spatial-headset conventions cannot be copied directly to a narrow touch screen. | A stationary phone composition with selectable destinations, no camera permissions or gesture-only controls. |
| [Linear: calmer interface](https://linear.app/now/behind-the-latest-design-refresh) | Navigation should recede; hierarchy and restrained separators reduce competition. | A dense work interface alone would not supply Gent Ascend's environmental identity. | One action at a time, four stable labels, existing small dock, details only when requested. |
| [Oura: app design](https://ouraring.com/blog/new-oura-app-experience/) | Separate immediate decisions, detailed signals and long-term context. | A health-first hierarchy would narrow the whole-man mission. | Performance stays one destination alongside Grooming, Direction and Creation. No invented readiness scores or biometrics. |
| [Endel](https://endel.io/) | A coherent generative visual can reinforce a focused environment. | Sound-led sessions are not the full life navigation model. Personalization requires actual inputs. | Restrained ambience remains opt-in; motion indicates selection, never fabricated AI activity. |
| [Active Theory: Prometheus](https://medium.com/active-theory/prometheus-2d3c05b88ec0) | Rendering multiple scenes concurrently can cause stuttering; constrain scene workload. | A full 3D marketing experience would increase daily-use load and complexity. | Reuse one adaptive orb. Architectural art and CSS transforms provide additional depth without another graphics context. |
| [Active Theory: CHILE20](https://medium.com/active-theory/adidas-chile20-4744a75f5968) | Progressive detail levels keep texture costs bounded. | Full material/texture pipelines are unnecessary here. | One compressed initial plate, optional selected-destination imagery, browser responsive sizing. |

## Technical research and build architecture

- [web.dev animation guide](https://web.dev/articles/animations-guide): continuous effects use transforms and opacity. No animated full-screen blur, layout properties, shadow field or JavaScript particle loop.
- [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): stop ambient animation in hidden documents; also pause out of view and during any modal. Existing orb has its own lifecycle and adaptive resolution.
- [MDN saveData](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData): where supported, skip the enhanced orb and additional scene images when Data Saver is enabled. Feature detection, not assumed universal support.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) and [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): preserve Still/reduced motion; use at least 44px destination targets, labels, visible focus, pressed state and a selected-destination announcement. No swipe requirement.
- Installed Next.js 16.3.5 docs for view transitions and Server/Client Components were read. Existing route transitions remain. Destination selection uses Next's native history integration and CSS response; no full-screen snapshot is triggered for every selection.
- Request-time server rendering includes the URL-selected world and preload hint in the first response; `connection()` prevents a JavaScript-only loading shell. Entrance warmup requests the same optimized image variant used by the scene.
- `registry.ts`: presentation metadata only. Four existing routes, no new authorization or data layer.
- `whole-man-world.tsx`: URL-selected world, accessible native buttons and links, directory, and retained-draft reflection sheet. Unknown selections default to Performance. Selection survives refresh and navigation back.
- `world-atmosphere.tsx`: scene art, selection image readiness, data-saving preference, visibility/modal lifecycle and reuse of `AureliusPresence`. The complete UI remains usable before images decode or when they fail.
- `world-atlas.css`: separately composed phone/tablet/desktop scene, bounded rings/light, clear foreground contrast and forced-color fallback. Normal document scrolling remains available on short screens and when text grows.
- Ambient sound now suspends for any open dialog. It never restarts automatically after a modal or hidden tab.

## Implementation sequence

1. Preserve the validated base in an isolated worktree; confirm local tree equals PR #33's saved tree.
2. Generate and optimize a new background with quiet space for live controls. Keep typography and navigation in HTML.
3. Replace the stacked observatory composition; wire selections to the registry and real links.
4. Move session-only reflection into the existing sheet and retain its draft across opening/closing. Preserve `#direction` entry from Aethelios.
5. Verify selection, phone targets, refresh/back, reduced motion, forced colors, data saver, imagery/graphics failure, modal pause, sound/privacy, and the existing guest workout.
6. Save code, research and screenshot evidence on the existing draft branch. Hosted release remains separate.

## Asset provenance

`public/media/world/whole-man-chamber-v2.webp` is an original environment generated with the built-in image-generation tool for this phase. Production rendition: 1000 × 1500 WebP, quality 82, 155,976 bytes. It is architectural concept art, not a photograph of an existing facility. Original master remains in the generating conversation. No brand logo was generated or replaced.

Generation prompt: “Production background plate for Gent Ascend Collective's interactive mobile Whole Man world, no UI baked in. Premium cinematic futuristic private observatory/sanctuary; polished obsidian, deep green #0B3B32 ribs, precision gold #C4912F inlays; central recessed dais and empty atmospheric space for a separately rendered orb; concentric architecture, subtle volumetric light, reflective stone floor; portrait 2:3, dark quiet top/bottom for text; no text, labels, numbers, logos, orbs, interface panels, people, statues, machinery, purple, cyan or blue.”

## Limits and next useful phase

This is environmental navigation, not a claim of live whole-life intelligence. Lines are decorative destination relationships. No new user records, scores, integrations, voice service or AI calls are created. Private Grooming, Direction and Studio retain existing account gates and workspaces; they are not fully redesigned worlds in this phase. Guest reflection stays in component memory and is lost on refresh.

Next: one real saved daily priority surfaced in this environment with source/freshness and return-to-task behavior, followed by a dedicated Grooming world. First close the inherited hosted migration/account checks and test the visual response on physical iPhone/Fold before any production promotion. Do not add artificial metrics to make the scene look active.

## Verification

- Production build (Next.js 16.3.5 / Turbopack), strict TypeScript and ESLint passed.
- 143 existing unit/SQL-emulation tests passed; recorded migration ledger check passed. No migration added or applied.
- 14 production-browser scenarios passed with local Chromium. Phone/Fold-like/desktop widths 344, 360, 390, 768 and 1440; a 320 × 568 viewport with 150% root text also retained navigation.
- Covered finite entrance, route focus/history, selection/action/URL coherence, refresh, modal draft retention and focus return, primary controls clearing the dock, motion pause/Still, Data Saver, forced colors, unavailable images/WebGL, sound opt-in, private no-store responses and guest sample workout with no API writes.
- Direct server-response check confirms scene heading, selected route and environment asset are included before hydration. Initial imagery: 155,976-byte WebP source with Next responsive optimization. No new package or graphics renderer. This is not a measured field LCP/INP/battery claim.
- Inspected screenshots after route transitions completed: [phone](evidence/world-phase2/world-mobile.webp), [Fold-like](evidence/world-phase2/world-fold.webp), [desktop](evidence/world-phase2/world-desktop.webp). These are real built UI captures; backgrounds are labeled concept art above.
- Runner initially denied compiler child processes; rerunning the authorized build with subprocess permission succeeded. No dependency, compiler or application permission bypass was introduced.
- Real phone GPU/battery, installed PWA, hosted authenticated two-account behavior and inherited migration reconciliation remain release gates. The browser tool CLI was unavailable; the repository's existing Playwright/Chromium runner performed the browser verification.
