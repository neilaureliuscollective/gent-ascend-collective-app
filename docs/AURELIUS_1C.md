# Aurelius 1C — brand-led immersive shell

Date: 2026-09-21. Founder approved the visual phase by providing the official logo, identifying its purple as the reference, and asking to start building. Implemented locally; no push or deployment.

## Delivered

- Preserved original logo; prepared transparent seal, formal lockup and simplified app icons with provenance.
- Sampled aubergine palette, self-hosted Sora/Inter, shared materials, glass navigation, gold actions and responsive Command composition.
- Updated Aurelius conversation, context, memory and existing profile/goal presentation. Removed duplicate full-workspace history selector while retaining the compact panel selector.
- Globe-inspired immediate SVG plus an optional, dynamically loaded Three scene. Persisted Still/solid controls; OS accessibility preferences win. Input/dialog/visibility/offscreen pause and resource cleanup.
- PWA manifest PNG/maskable and Apple icon assets. This does not itself host the app or establish installation/offline support.
- Kept session-bound services, ownership, developer harness, prompts, membership and database contracts unchanged. No synthetic metrics added to presentation.

## Observed verification

| Gate                                          | Result                                                                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint / strict TypeScript / production build | Passed                                                                                                                                                                             |
| Unit, SQL and SDK mock-provider tests         | 53 passed                                                                                                                                                                          |
| Browser suite                                 | 30 passed; synthetic API fixtures where applicable                                                                                                                                 |
| Migration chain                               | Existing three migrations pass in PGlite; no schema changes in this phase                                                                                                          |
| Layouts                                       | 360, 390, 768, 1024, 1440 widths; short 390×740 and 1024×768; no tested horizontal overflow                                                                                        |
| Existing behavior                             | Saved history, stop/error/save acknowledgment, memory confirmation/edit/delete, context opt-out, preview no-write, dialog Escape/focus return and production harness denial passed |
| Appearance                                    | Preferences survive reload; reduced motion overrides Ambient; solid navigation; unsupported WebGL fallback; 200% text remains navigable/composable                                 |
| Renderer audit                                | Mounted in headless Chromium; simulated context-lost/restored events restore fallback/scene; three Still/Ambient cleanup cycles leave one or zero canvases as expected             |
| Human visual review                           | Command, conversation and unfolded layouts inspected; original and derived logo reviewed                                                                                           |

`npm run check` and `npm run test:e2e` reproduce the primary gates. `node scripts/visual-audit.mjs` follows a production build and writes screenshots/resource evidence under ignored `test-results/visual-audit`. `PLAYWRIGHT_CHROMIUM_PATH` may select the local Chromium executable.

## Payload evidence

Local production server, headless Chromium, no throttling, software GPU. Resource Timing `encodedBodySize` values, not field performance metrics. Baseline was the preceding 1B home at 390×844. The current Still run uses that viewport; Ambient was measured at 390×960, with the same scripts/assets. Scene module compression independently checked.

| Measure                                 | Observed bytes |            Budget |
| --------------------------------------- | -------------: | ----------------: |
| Baseline 1B home JavaScript             |        139,685 |         Reference |
| 1C Still home JavaScript                |        147,170 | Increment ≤40,000 |
| Initial increase                        |      **7,485** |              Pass |
| Optional scene increase                 |    **133,447** |    ≤200,000; pass |
| First-view optimized logo images, phone |         22,472 |    ≤250,000; pass |
| Combined local font files               |         81,908 |    ≤120,000; pass |

Desktop image payload is separately recorded in the audit resources when available; no claim that the phone number covers every DPR. The large transparent master derivative is not downloaded at native resolution for every rendered logo; Next Image serves appropriate dimensions. No autoplay video or external scene textures.

## Limits and deliberate differences

- No field Web Vitals, physical foldable/iOS keyboard, sustained GPU/battery or real screen-reader session has been measured. Browser text enlargement is not proof of every browser's native zoom behavior. Device acceptance remains open.
- Context-loss events were simulated to test the handler; this is not an actual GPU fault/driver test. Canvas count after toggles is not a GPU heap profiler.
- Shared CSS primitives retained semantic native controls; no speculative generic component framework or UI package was added.
- Existing conversation library is the history-resume path. A separate last-conversation shortcut on Command is deferred until live founder behavior informs it.
- No rendered health twin. The celestial globe is brand imagery, not a diagnostic or body representation.
- Real Supabase reset/Auth/PostgREST/founder flows and paid live-model smoke remain unrun in this environment. Same blockers as 1A/1B: no Docker or live credentials. No claim of ChatGPT parity.

## Research used in implementation

Research reasoning and behavioral-design references remain in the visual proposal. Current official implementation references consulted on 2026-09-21:

- Next.js [local font optimization](https://nextjs.org/docs/app/getting-started/fonts): local variable fonts and asset delivery.
- Three.js [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): WebGL2, pixel ratio and disposal; [BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html): resource lifecycle.
- web.dev [maskable icons](https://web.dev/articles/maskable-icon): opaque background and safe-area composition.

## Next

Founder visual/device review, then real-service activation and daily Aurelius evaluation. Reconnect the new GitHub account when ready, sync preserved history, configure protected Vercel/Supabase/Gateway access, and run actual integration/founder/live-model gates. Do not fill the wait with unrelated dashboard modules.
