# Fluid Intelligence — audit and review candidate

October 12, 2026. Canonical repository: `neilaureliuscollective/gent-ascend-collective-app`. No merge, production deployment, hosted migration, provider activation, voice/model setting or billing change is authorized by this implementation.

## Verified source and prior development

GitHub main `26bf4657a04077a7917c1724e2dbfbb4a34fb3e5`, tree `6f78d395807819ec99ae7308f51d07630b0ea5d8`, includes #108 (active-answer motion), #110 (guiding emerald presence), and #112 (Imperial Emerald II). #90 remains an unmerged draft with conflicts; its historical status is not the status of every Live file. Main already contains `LiveController`, OpenAI Realtime WebRTC admission, transcripts, artifact approvals, background-work guards and diagnostics. #111 Architect Origin is also an unmerged draft. Neither pending stack was imported.

The supplied clean checkout was `0af812f`. Git transport cannot connect to the configured environment proxy. The merged #110/#112 file union was obtained at the exact main SHA using the authenticated GitHub connector. The reconstructed local baseline's Git tree equals main's tree exactly. Publication uses main as the parent and only the initiative delta; the local provenance snapshot is not represented as original upstream ancestry.

## Ownership map and lifecycle

| Surface | Active owner / reuse |
| --- | --- |
| Member Talk `/app/aethelios` | `AureliusWorkspace`; `ConversationViewport`; shared `TalkInput`; `ConversationTurn` |
| Work/company conversations | `CompanyRoom`, same viewport/input/message primitives; session-bound company route and immutable brief snapshot |
| Council / compact home conversation | Existing Talk workspace and Council selection; guarded specialist routing |
| Studio | Existing synchronous creation/version/approval components; shares observed intelligence motion, not text streaming transport |
| Founder Office | Saved-record attention, mission/task/approval services; no generic chat replacement |
| Architect | Existing routes preserved; pending Origin #111 remains separate |
| Text server | `/api/aurelius/chat`, `/api/company-talk/chat` → `prepareReply` → AI SDK 7.0.107 `ToolLoopAgent` / direct OpenAI Responses → `replyStream` |
| Voice | Workspace-scoped `LiveConversationProvider` → `LiveController` → session-bound `/api/aethelios/live` → WebRTC audio/data channel |
| Motion | Observed operation adapters → GuidingPresence / IntelligenceResponse; existing appearance, reduced motion, visibility suspension and measured RTC audio levels |

Text lifecycle: submit → local pending turn (not saved) → server session/authority/scope checks → atomic reservation with quotas → history/context/summary assembly → accepted response and initial waiting event → observed reasoning/search/text events → animation-frame text coalescing → atomic finish/readback → saved event → workspace refresh. Auxiliary title generation runs in Next `after` following the response, using existing quota reservation and owner-bound RPCs. A title failure cannot change an already saved reply. No duplicate backend or model migration.

A pending turn is a local submission acknowledgement, not proof of server acceptance or persistence. Composer content clears only after successful response headers; the accepted request remains identifiable for reload. Interrupted or uncertain saves retain the existing replay lock. A newer draft survives acceptance, completion and cancellation. Original text is restored after an accepted interrupted stream only if there is no newer draft. Draft navigation handoff remains transient, person-bound memory inside the existing provider, never URLs/cookies/localStorage containing conversation text.

## Confirmed findings and changes

1. First-answer persistence acknowledgement previously awaited an optional title model call with an 8-second configured timeout, despite the answer already being saved. It now acknowledges the answer independently and schedules the same auxiliary work afterward.
2. Talk waited for server headers before displaying the submitted message. It now displays a local pending turn immediately and removes it if acceptance fails. Both text routes flush an observed waiting event immediately after preparation, so provider waiting no longer suppresses the first stream event for motion-capable clients. Legacy protocol clients remain compatible.
3. Talk retained submitted content and disabled the input throughout generation. It now clears at acceptance, remains editable during text generation, preserves a newer draft and restores failed text safely. Work uses matching acceptance/draft rules for streamed conversation; its synchronous deliverable operation keeps its own guarded lifecycle.
4. Input resize listeners were removed/reinstalled on every keystroke, and post-paint sizing could visibly jump. Saved-answer Markdown is separately memoized so unrelated composer updates do not reparse unchanged answers (render counts remain unmeasured). Value sizing now runs before paint; stable viewport listeners batch resize events to one frame. Input remains bounded to 44–200px and at most 24% of usable viewport height (with a 44px accessibility floor), with internal scrolling. Shared input optional expansion remains available, but is never required to collapse ordinary composition. Expand target is 44px. Touch Send/Stop activation retains an already focused editor by cancelling pointer focus transfer; it never calls focus/blur. Keyboard and mouse activation keep native focus behavior. No focus/blur is forced on send, acceptance or streaming.
5. Company stream parsing discarded a final event lacking a newline. Talk and Work now share bounded UTF-8/NDJSON decoding, trailing-frame consumption and reader cancellation/release.
6. Live disconnected ICE states ended immediately even when recoverable. A five-second recovery window now preserves the same admission/transport, silences output during disruption, shows Reconnecting, and ends/releases safely on timeout or failure. It does not automatically purchase another session. Speech detection and processing follow real speech/response events. Stale playback-stop events cannot override a newer response. Existing interruption cancellation, transcript fences and cleanup/restart locks remain.

Potential bottleneck retained deliberately: `prepareThreadSummary` can perform up to six sequential auxiliary batches (each summary call has a 12-second timeout) before generation in long threads. Moving this carelessly could omit or stale private context. Development Server-Timing now separates session, authority, scope, reservation, history/context, summary and artifact assembly, making that cost measurable before a further context/persistence redesign. Current model routing stays unchanged: configured main model plus existing Council/specialist selection and optional separately configured title/summary models. No evidence supports replacing all requests with a smaller model.

## Instrumentation and measurements

In development only, set localStorage key `aethelios-timing` to `1`, then observe `aethelios:timing` CustomEvents. Payload is only an allowlisted milestone and elapsed milliseconds. It never accepts text, record IDs, prompts, credentials, private context or raw provider errors. Marks are bounded once per stage and per request: handler acknowledgement, committed pending-message DOM, accepted headers, first stream event, first text delta, first committed response DOM, saved event and end. Commit timestamps come from layout effects after React updates the DOM; they are not proof of display scanout or semantic usefulness. Disable by removing the key. Storage-disabled browsing fails closed for diagnostics.

Development text routes return Server-Timing phase durations; no diagnostics header is returned in production. Opted-in development Talk requests also receive content-free timing frames for first observed provider event/text, observed tool start/end, persistence start/end and stream end, relative to server stream start. These are dispatched with `source: server`; production and legacy clients receive none. This separates server/provider processing from client arrival timings without recording contents; provider timing still includes the SDK and server event handling. Network transport and provider wait remain partly combined in client acceptance-to-text timing. Existing LiveDiagnostics exports content-free connection-event, speech-stop-to-output-event, transcript-event, typed-output and cutoff-handler p50/p95 plus RTC jitter/buffering. Output events are not acoustic measurements. Physical audio recordings are needed for first audible response and interruption acknowledgement.

| Measure | Baseline evidence | Revised evidence / limit |
| --- | --- | --- |
| First reply saved acknowledgement | Source includes synchronous title generation, configured 8s timeout | Title removed from save critical path; measured live reduction unavailable |
| Local send display | After accepted headers | Pending state queued synchronously before fetch; sub-100ms target requires browser/device measurement |
| Provider-first-event blocking | No activity frame until model reports activity | Initial waiting event after preparation; deterministic delayed-provider unit test verifies no invented text |
| Composer listener churn | Resize listener pair replaced on every value change | Stable listeners; one queued viewport frame; native keyboard timing unavailable |
| Stream paints | Existing `frameText` coalesces deltas | Preserved; no fake typing delays added |
| Main baseline unit gates | 708 tests passed locally | Revised receipt below |
| Warm useful output in 1–2s; mobile FPS; rerender counts; layout shift; actual voice latency | No provider/device credentials or usable browser server | Unavailable, not claimed improved numerically |
| Bundle impact | No new dependency | Shared small decoder/timing modules; normal production bundle comparison blocked by existing asset download failure |

## Acceptance and release gates

New tests cover immediate pending display during delayed acceptance, failed-submission retention, accepted clearing, newer-draft preservation during streaming/cancel, streamed response/save, multiline limits at 344/390/720/768/1440px and desktop submission. New coverage also verifies scroll-follow opt-out across a 40-turn synthetic transcript, unmount cancellation, and simulated VisualViewport resize/offset/pinch-zoom handling. Existing suites cover long replies/history, navigation cleanup, reduced motion, motion transitions, auth/isolation, quotas, approvals and persistence. Unit transport cases cover split UTF-8, final unterminated saved event, malformed/oversized frames and consumer cleanup. Live unit tests cover connection cleanup, transient/sustained recovery, permission retry, actual-event processing, interruption and stale playback events. Synthetic tests are not live model or native keyboard evidence.

Local checks: lint and strict typecheck pass; all 717 unit/SQL tests pass across 117 files; migration ledger passes for all 37 owned migrations. Full final receipt and hosted checks follow. Normal production build and standard e2e preflight fail at existing `prepare-mirror.mjs` download (`EAI_AGAIN storage.googleapis.com`); direct component Playwright fails to bind its server (`EPERM 127.0.0.1:3102`). Real Auth integration cannot start without the ignored local development configuration. No fabricated credentials, test bypass or replacement provider was introduced.

Physical acceptance remains required: Galaxy Z Fold folded/unfolded and rotation, Android Chrome/Samsung keyboard, iPhone Safari keyboard and zoom, installed PWA safe areas, mobile audio-route changes, measured interruption, real network loss, microphone denial/retry, long-thread/context quality and real founder evaluation. Emulated widths never prove native keyboard behavior.

Risks: Next after relies on platform request lifetime; optional titles may arrive after the first refresh and remain fallback titles if auxiliary work fails. Transient voice recovery intentionally silences output and can miss audible material during disruption; transcripts are still provisional and existing server persistence rules apply. Draft handoff is memory-only and does not survive full reload. No provider endpointing/VAD/voice/cost changes were made without measured evidence. No auth, ownership schema, quota, memory-write, commerce, Studio approval, founder privilege or specialist-boundary rewrite.

Next review boundary: verify this candidate's hosted CI/browser/Auth gates, inspect phone/Fold/desktop screenshots, collect controlled authorized provider/device baselines using the new diagnostics, then tune context preparation or endpointing only where evidence supports it. Keep production disabled until founder release authorization.

Final local verification (candidate source): `npm run lint`, `npm run typecheck`, `npm run db:ledger` and `git diff --check` pass. Full Vitest: 117 files / 717 tests passed (14.72s, synthetic unit/SQL execution). Production build, browser and real Auth gates remain blocked for the infrastructure reasons above and require hosted acceptance; physical-device and live-provider gates remain open.
