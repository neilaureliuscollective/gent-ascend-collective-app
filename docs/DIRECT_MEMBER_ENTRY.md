# Direct member entry — Phase One

Founder-authorized scope, 2026-10-04. Base: `6abfd6d` in the canonical Gent Ascend repository.

## Inspection and decision

Root `/` redirects to public `/experience` in production. `/experience` owns the optional cinematic threshold. The PWA already starts at `/app`. `/enter` previously displayed an extra continuation gate to recognized accounts; password sign-in also sent existing beta/founder accounts back to welcome when priority was blank. `/app` already composes `readCommand`, `readDailyCommand`, `DailyDashboard`, saved-record projection, versioned approvals, daily writes and the shared energy field. Talk at `/app/aethelios` already owns conversations, Council, consent, memory and streaming. Shell owns persistent navigation; commerce has its existing `/app/collection` world. Welcome remains available for invitation/access setup, rather than a home prerequisite. No independent travel workspace is exposed as a working new feature.

Decision: evolve `/app` rather than add another home. Verified identity redirects only entry routes (`/`, `/experience`, `/enter`) to `/app`; refreshed cookies and private/no-store survive. Public visitors keep their existing acquisition/auth behavior. Session-aware entry responses are private/no-store; the sidebar’s optional public exploration link uses the existing `/experience/world` route so it remains useful after root becomes direct entry. Existing beta/founder sign-in no longer depends on priority completion; unclaimed invitation setup and paid-member capability routing remain intact.

## Targeted research and plan

Official references reviewed 2026-10-04:
- Oura's Today view emphasizes timely, personally relevant information rather than every metric: https://support.ouraring.com/hc/en-us/articles/42987005571859-How-to-Use-the-Oura-App and https://ouraring.com/blog/new-oura-app-experience/.
- ChatGPT emphasizes starting a conversation directly: https://help.openai.com/en/articles/12677804-what-is-chatgpt-faq.
- Installed Next 16.3.5 client-boundary and Link guides checked before implementation.

Applied plan: verified direct entry → remove member overlay/replay → local-time greeting and home conversation input → saved next move and clear world links → retained source field and deeper day tools → ownership, navigation and mobile verification. Research informs hierarchy, not copied visual designs or speculative health intelligence.

## Implemented boundaries

- The original member arrival component is removed. No automatic screen, dismissal or member replay control.
- Home uses the snapshot timestamp and saved member timezone for the greeting. Now uses only existing sourced daily/goal/review records, with unchanged explicit confirmation and uncertainty locks.
- The home input is a transient React handoff through the existing persistent Shell to Talk's existing composer. It does not call a model, create a conversation, send private context, write memory or auto-send. The member sends from Talk. Resuming an existing conversation retains its normal route.
- No draft is put in URL/history, cookies, browser storage or the database. Reloading discards the unsent handoff. The session-bound workspace response carries an optional `ownerId` solely to reject transferred text after account changes; it confers no authority. Initial and subsequent Talk reads clear a mismatched/expired-session handoff.
- The home composer keeps its continuation action above bottom navigation on focused phone viewport resize, without hiding navigation or overriding accessibility zoom.
- World links precede deeper context: Grooming, Training, Ascend Collection, Aethelios & Council, My world. Persistent navigation remains intact. These are links to existing worlds, not an equal-weight card grid or new systems.
- Existing green/gold chamber, bounded energy renderer, source inspection, motion controls, reduced motion, lifecycle suspension and deeper workspace remain. No dependency, route, database migration or model/provider change.

## Verification

See the latest Phase One section of `STATUS.md` for observed final results. Browser fixture data and intercepted AI responses are synthetic and are not evidence of live Supabase or model access. Real authenticated production/device acceptance remains separate. This work is prepared on its feature branch, without main promotion or production deployment.

Phase Two: use real saved grooming/training context to refine which next move appears, then validate the complete loop with signed-in members on physical iPhone/Fold devices.
