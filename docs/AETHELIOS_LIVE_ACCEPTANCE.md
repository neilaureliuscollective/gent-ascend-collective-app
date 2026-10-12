# Aethelios Live — Phase 5A measurement foundation

Implemented October 12, 2026, locally on the existing voice branch. This completes the first instrumentation slice of Phase 5, not provider/mobile acceptance or launch. Realtime/WebRTC remains the gated runtime; GPT-Live is still an evaluation adapter. No new service, subscription, migration, production deployment or cinematic asset change.

## Findings and implementation

The previous browser measures reused one global speech-stop timestamp for every transcript/output. A delayed ASR completion could therefore be measured against another turn, typed turns could inherit a stale speech timestamp, repeated output-start events could inflate samples, and a zero-valued clock origin was discarded. Those were measurement defects; they are not evidence of the cause or magnitude of real audible delays.

Replaced those global Performance entries with one bounded local VoiceDiagnostics instance per controller/session attempt. ASR latency uses matching `item_id`; output timing binds a response ID at `response.created` and consumes it once. Typed turns have their own metric. Interrupted/cancelled replies and uncorrelated output do not produce false speech samples. Correlation IDs remain private in bounded memory; exports omit them. Each metric retains its latest 60 samples; reset occurs on a new admission attempt, while End preserves the last report and freezes its client duration. The actual configured model comes from authenticated server admission, not a browser guess.

The shared Live surface now offers **Voice diagnostics → Download voice diagnostics**. It creates a local JSON file containing configuration, event-timing samples/percentiles, client failure/disconnect counters and allowlisted numeric WebRTC health. No audio, transcripts, conversation/session/account identifiers, record content, URLs, browser/device names, track labels, ICE addresses or credentials are included. Nothing is uploaded or persisted automatically. Existing orb stats reads refresh the numeric cache; export can request a current snapshot. No additional periodic polling loop is added. Cached stats include their age and missing values stay null. Download behavior still needs real iOS/Android validation.

`npm run live:report -- <diagnostic.json> [more files]` validates bounded strict exports offline and recomputes p50/p95 from samples. It separates model/voice configurations and never produces a passing launch verdict. Supply exactly one final export per attempt; without identifiers repeated exports cannot be deduplicated. Keep device/browser/network/scenario cohorts in separate input batches. Files themselves cannot prove they came from a real provider rather than a fixture. The current schema accepts the shipped Realtime pilot only; GPT-Live comparison needs a separately validated bridge to its different events before equivalent metrics can be reported.

## What the measurements mean

| Exported metric | Boundary | Limit |
| --- | --- | --- |
| `connection_event_ms` | Start click to data-channel open | Includes permission/admission; does not prove audio audibility. Label already-authorized and first-permission cohorts separately. |
| `speech_stop_to_output_event_ms` | Received provider speech-stop to received output-start | Response association is inferred from the next response creation; concurrent backend replies can be ambiguous. Excludes actual VAD/acoustic/network boundaries. |
| `speech_stop_to_transcript_event_ms` | Matching item's received speech-stop to completed ASR | Final-text event latency, not first partial text or transcript accuracy. |
| `typed_to_output_event_ms` | Typed-send to correlated output-start | Keep separate from speech latency. |
| `local_cutoff_handler_ms` | Local interruption handler duration | Not interruption detection, playback drain or audible silence. |
| RTC health | Audio packets received/lost, jitter, nominated pair RTT, cumulative average jitter-buffer delay | Snapshot/cumulative transport diagnostics, not mouth-to-ear latency. Supported fields differ by browser; missing/invalid data is unavailable. |

The authoritative conversation/tool/usage ledgers remain server-owned. Client End/duration/counters do not prove provider hangup, crash-safe expiry, saved results or billed cost. No cost is calculated from undifferentiated token totals or client elapsed time. GPT-Live final provider duration and backend/tool usage must be priced separately; Realtime requires actual modality/cache-aware provider usage and transcription charges. No current allowance or model selection was changed.

## Official research

Reviewed October 12:

- [OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription): reconcile final transcripts by item identity and benchmark actual audio, accents, language and microphone conditions rather than assuming latency from configuration.
- [OpenAI voice cost guidance](https://developers.openai.com/api/docs/guides/voice-latency-cost): GPT-Live voice duration and delegated backend costs are separate; cumulative duration snapshots replace previous snapshots, not additive charges. Realtime conversation costs depend on per-response modalities/context. The new report deliberately leaves billing unverified.
- [MDN getStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats): asynchronous RTCStatsReport availability/content depends on connection details. Select safe fields rather than serializing raw reports.
- [MDN audio jitter](https://developer.mozilla.org/en-US/docs/Web/API/RTCInboundRtpStreamStats/jitter): jitter is in seconds; exported jitter/RTT/buffer measurements are converted to milliseconds.
- Installed Next.js 16.3.5 client-component/route-handler guides read before edits. Browser export stays in a client island; provider configuration/key and authenticated admission remain server-side.

## Reproducible real acceptance run

Use an approved non-production database and authenticated founder/beta account, with existing additive migrations applied, explicit transcript consent, the existing OpenAI key and verified preview hosting controls. No harness bypass or service-role member access. This environment has no configured credentials; no remote database was modified.

1. Establish a working production build and browser test server, then run actual two-account Auth/RLS/save/readback checks. Verify all existing pilot gating and server hangup independently. Keep the two-minute cap; if the full workflow exceeds it, explicitly resume voice and verify saved task continuity rather than silently extending access.
2. Run the scenarios below in the same order for Cedar and Marin on each account-available allowlisted Realtime model. Keep history/context, request/output lengths, browser/device, microphone and network conditions comparable. Include failed attempts. Use a separately validated GPT-Live client-delegation path with the same backend tools/results for a later controlled comparison; do not route public traffic to it based on documentation alone.
3. After each attempt, End, inspect cleanup acknowledgment and server/provider termination, export one final diagnostic file and record scenario outcome separately. Verify transcript/action/image version ownership with two real accounts. Client diagnostics supplement those checks, not replace them.
4. For audible metrics use consented synthetic/public conversations and an external acoustic recording/loopback measurement with a common clock for speech end, first audible reply, interruption onset and silence. Do not infer acoustic timestamps from provider/browser events. Compare complete and interrupted final transcripts against the spoken script and count omissions, revisions and incorrect names/numbers.
5. Reconcile actual billed voice/transcription/backend/image/search usage, including failed/uncertain tasks and retries. Record cost per active conversation minute and successful task. Measure battery on physical devices before setting commercial/device targets.

| Scenario | Expected behavior and evidence |
| --- | --- |
| Greeting, long pause, subject change, correction | Natural turn completion, no restart, readable transcript. Include accented speech, names, numbers and background noise. |
| Interruption during generation and after generation while buffered audio plays | Stop audible playback promptly; no stale speaking state or continued old sentence. Test double-talk and typed switch. |
| Public research while discussing another subject | Human-reviewed paid task; conversation remains responsive; sources/results become readable only after saved completion. |
| Create image, revise the selected version | Separate explicit cost approvals; exact base version, provisional versus final image labels; Studio handoff and End-independent saved work. |
| Selected-part coworker review → personal daily action | Exact recipient/context sharing; blank editable user commitment; explicit confirm; canonical receipt and two-account denial. |
| Minimize, navigate Studio/daily, expand | One transport; no microphone restart or conversation loss. OS app switching/screen lock are separate foreground-stop tests, not background-support claims. |
| Permission denial, Bluetooth/headphone changes, incoming call, offline/low bandwidth | Honest paused/error state, local media release and verified server cleanup. Intentional resume returns to saved conversation without duplicate replay. |

Physical matrix: Samsung Galaxy Chrome and Android PWA, iPhone Safari and iOS PWA, desktop, Fold/DeX. Test speaker/headphones/Bluetooth, first permission and revoked permission, device lock and app switching separately. Native background audio remains a future architecture decision if required.

Retain provisional targets from the foundation: already-authorized connect p50 ≤3s/p95 ≤6s; **externally measured audible** reply p50 ≤0.8s/p95 ≤1.5s; interruption-to-audible-silence p95 ≤250ms; final transcript after acoustic speech end p95 ≤1s; intentional same-conversation reconnect p95 ≤5s. Zero cross-account records/duplicate writes. Initial disconnect review needs at least 100 representative attempts with explicit denominator/failures; this alone does not establish population reliability. The offline report cannot pass these acoustic/security/cost gates.

## Observed validation and blockers

Lint/typecheck pass; **74 files / 484 unit/SQL tests pass**. Historical ledger: 28 files unchanged and verified. The report CLI ran successfully on an explicitly synthetic local diagnostic file, kept `launchAcceptance: unverified` and recomputed its percentiles. No synthetic values are reported as real latency. The diagnostic-download browser case is discovered by Playwright but remains unrun: fresh loopback listener returns `EPERM`.

Fresh `npm run build` fails at the unchanged MediaPipe prebuild download (`EAI_AGAIN storage.googleapis.com`). A normal permitted `curl` attempt also fails to connect to the configured proxy. No checks/assets were bypassed. `npm run test:ai:live` fails explicitly because `OPENAI_API_KEY` is not configured and sends no model request. Real Supabase/hosting/provider/acoustic/mobile/billing/battery acceptance remains blocked. No deployment, successful browser/build run, measured live latency or ChatGPT parity is claimed.

Next is **Phase 5B actual protected-preview/device acceptance**, using this evidence path. Restore the permitted build/network/loopback execution environment and configure the existing non-production Auth/database/OpenAI credentials, then run the real scenarios before tuning VAD, upgrading the voice runtime, widening access or adding further feature slices. Production still requires independently proven expiry/hangup and all recorded release gates.

Phase 5B first-slice audit now confirms `OPENAI_API_KEY` already exists in Vercel Preview/Production. Do not recreate it. The Live branch/activation flags and matching Gent database's Live schema are not rolled out; local key absence is a separate execution-environment limitation. A founder-only hosted preflight is implemented but not deployed. See [AETHELIOS_LIVE_HOSTED_PREFLIGHT.md](AETHELIOS_LIVE_HOSTED_PREFLIGHT.md) for actual remote metadata/catalog findings, safe checks and the integration-preview next step.
