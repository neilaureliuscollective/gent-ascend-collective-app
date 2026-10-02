# Whole-Man World — first vertical slice

Founder approved implementation on October 2, 2026. This is an additive review slice, not a production promotion or replacement of domain services.

## Baseline and preservation

Verified origin/main at 1db7da767e3c7b54a1b06545b34948c183e80f0f. This branch starts at 114d98c, the preserved Interaction Phase 3 / Performance Phase 6 integration. Main is an ancestor. The original `feat/grooming-interaction-recovery` checkout contains seven modified tracked Grooming/shared-sheet files and two untracked Grooming components. They remain untouched there; they are **not** claimed as included or finished here. The committed Grooming version is retained. Reconcile that independent work before a combined release.

## Review path

`/experience` → `/experience/world` → `/experience/performance` → `/experience/performance/practice`.

Aethelios opens via the dock and continues to `/experience/aethelios`, reusing the real conversation workspace. Its API, quotas, founder bridge, ownership, saved conversations and explicit memory controls are unchanged. Private pages are dynamic and included in the proxy's private/no-store/session-refresh matching.

`GENT_WORLD_ENABLED=true` at build time redirects the public home to `/experience`. Default is off. The review routes remain reachable regardless of that switch; the switch is a homepage rollout control, not an access control. Existing public marketing, account, commerce and application routes remain available. Rollback the homepage by rebuilding without the flag.

## Implemented

- One persistent world shell: restrained navigation, orientation, Still control, explicit optional ambient sound, focus management and Aethelios access.
- Typed presentation registry for working destinations. Future Brotherhood/Legacy are identified as future, not fabricated routes. Physical Twin remains a future subsystem under Performance.
- Existing portrait/landscape portal artwork with finite GSAP camera/crest sequence. Route prefetch begins on entry-page mount; destination image decode runs alongside animation. No video download or graphics context is required for entering. A 2.2-second watchdog prevents the animation from blocking navigation; skip and reduced-motion paths navigate directly.
- Scoped React ViewTransition scenes for environment changes and destination selection. Task and chat surfaces are outside the scene snapshot boundary. Unsupported browsers retain normal links.
- Whole-Man observatory with the existing adaptive orb; native destination buttons, all-destinations dialog, and a useful session-only direction exercise.
- Performance environment uses the existing architectural LifeOS plate. Working members reuse PerformanceWorkspace. Signed-out visitors can record/finish a clearly labeled in-memory sample through the existing Training component. No forged identity, model calls, database writes or automatic draft import.
- Aethelios is optional and contextual, not a mandatory gate. No new personal-data sharing is implied by the environment.
- User-enabled, low-volume synthesized ambience, stopped in hidden tabs and while the intelligence surface is open. Playback requires a new gesture after reload. The mute choice is recorded, and no automatic sound begins on arrival. No microphone/voice integration or licensed audio asset is added.
- Static offline fallbacks cover experience routes; personal HTML/API responses remain uncached. The existing offline workout page remains available to members.

## Architecture and motion ownership

`src/platform/world/registry.ts` owns presentation metadata only. `WorldShell` owns global orientation/preferences. `Threshold` owns its disposable GSAP timeline. React owns route/content snapshots. CSS owns feedback. Existing domain services own authorization and persistence. No new dependency, schema or provider.

Entering is a finite cinematic event; day-to-day links and PWA/deep links do not require replay. Mobile composition is separately arranged. HTML carries all functional text, landmarks, controls and focus targets; images/canvas are decorative. There are no gesture-only controls. Use Still, reduced motion, forced colors and image/WebGL failures without losing destinations.

## Research checked

- React 19.3 stable ViewTransition: https://react.dev/blog/2026/09/09/react-19-3
- Installed Next.js 16.3.5 documentation: view-transitions, server/client components; current https://nextjs.org/docs/app/guides/view-transitions
- Streaming/loading: https://nextjs.org/docs/app/api-reference/file-conventions/loading
- GSAP lifecycle: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- Motion layout comparison: https://motion.dev/docs/react-layout-animations — no additional dependency justified for this slice.
- Media and graphics: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay and https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Accessibility: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide

## Release limits

This is not a completed six-world product. Guest AI responses, public self-signup, automatic guest-to-account draft migration, new Physical Twin behavior and state-driven environment personalization remain deferred. Account access remains invitation-controlled. Guest sample entries disappear on reload.

The inherited Performance/Studio migrations and hosted ledger must be reconciled before release. The ledger script checks a recorded snapshot, not today's live database. This slice introduces no migrations. Local fixture tests cannot prove real Supabase Auth/RLS, hosted AI responses, phone keyboard/safe-area behavior, Safari/PWA graphics, battery use or field Web Vitals. Those remain explicit release gates. Targets: p75 LCP <=2.5s, INP <=200ms, CLS <=0.1; not claimed as measured here.
