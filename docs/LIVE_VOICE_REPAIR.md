# Focused Live voice repair — 2026-10-15

Base: `06dfb332d54b8f756e7a1bac18f495d26f02eb58`. The original checkout was clean at `1010c60`; this repair uses its own branch from the explicitly requested base. Local worktrees and checkout skills were inspected; no additional repository-local skills were present. The direct GitHub pull collection listed 57 open PRs, including Architect #130/#146, navigation #144, Studio #147 and overlapping Live integration #90. The earlier issue-search result claiming zero open PRs was incorrect. No parallel branch was rewritten or integrated. Shared STATUS is updated additively.

## Behaviour

- The existing server `currentIdentity` helper supplies the verified auth user ID through the shell. First-use audio/OpenAI/transcript acknowledgement uses the versioned device-local key `aethelios:live:audio-transcript.v1:<auth-user-id>`. It contains only the acknowledgement version. There is no remembered identity for anonymous/unconfigured previews. Blocked storage falls back to user-scoped page memory.
- Only pressing Start after checking acknowledgement saves it; Cancel on first use does not. Later explicit Live presses start/retry directly. Reading saved acknowledgement, reload, navigation, and changing users never start audio. Account changes remount the controller and release the previous transport.
- Voice options retains the existing disclosure, checkbox/select presentation and lets the user separately opt into selected personal context or task proposals for that start. Both optional flags reset on open/start/cancel and remain false on one-tap starts. Each consequential task still requires its existing exact approval. No server capability, authorization, usage reservation, quota, microphone permission, foreground/route cleanup, or transcript-save rule is loosened. No CSS, orb or motion changes.

## Production diagnosis and protocol evidence

The supplied 16:55:13 UTC receipt establishes successful calls POST, database attach and sideband open, followed by a provider error during seed admission after 2634 ms. The prior service discarded the underlying structured error, so the exact rejected constraint cannot be recovered or proved from that receipt. This change does not claim to have reproduced or resolved a provider-specific payload rejection.

Each seed now has an independent client `event_id`. A returned `error.event_id` is matched only against generated seed events. Diagnostic fields are explicit allowed code/type values and item parameter paths, matched event ID/index/role/text length, seed count and pending count. Unknown values/IDs are null; unrestricted provider messages, raw context, SDP, response bodies and credentials are never logged. Existing outer admission duration/correlation remains. Close/error/timeout/send failures remove seed listeners and still trigger existing provider/database cleanup. All matching seed item acknowledgements are required; unknown, duplicate and unrelated events cannot complete admission.

A proven lifecycle defect was also repaired: sideband handshake open/error/close listeners remained after successful open, causing later cleanup closes to emit false sideband-startup failures. All handshake listeners now detach on success/failure/timeout, with a service regression test.

Official OpenAI references checked 2026-10-15:

- [Realtime client events](https://developers.openai.com/api/reference/resources/realtime/client-events): conversation.item.create supports history; success returns conversation.item.added; assistant text content is output_text. The existing output_text mapping is retained.
- [Realtime error correlation](https://developers.openai.com/api/docs/guides/realtime-conversations#error-handling): client event_id links server rejection to the event.

No billing, websocket header or item-ID-limit theory was adopted. Existing call/seed item identifiers and websocket authentication are unchanged.

## Bounds and tests

Application/artifact context stays pinned, with fail-closed pre-provider limits of eight messages, 32,000 characters per message and 48,000 combined application characters. The most recent twelve history messages fit within 64,000 combined seed characters and the same per-message limit. Oversized application context produces a safe context-stage failure before calls POST; it is never silently truncated. These are application budgets, not claimed provider limits.

Service tests now use the actual buildMessages implementation and complete user_text/assistant_text turn shapes. The seed test exercises real application context plus user/assistant history, cancelled turns, empty final prompt filtering, partial/duplicate/unrelated acknowledgements, correlated/unmatched rejection, close, transport error, synchronous send error and timeout. Budget tests cover pinned overflow and bounded history. Browser fixtures cover first-use Cancel, retained acknowledgement across reload, explicit retry, no automatic POST, per-user isolation and separate optional choices, alongside existing microphone release and lifecycle races.

## Verified results and limits

- 157 tests in 23 Live/protocol unit suites passed.
- All nine Chromium Live browser fixture journeys passed (phone, desktop and simulated unfolded Fold). Transport/Auth/provider are synthetic; this is not physical-device or paid provider acceptance.
- ESLint and strict TypeScript passed. Optimized `next build` passed. Migration ledger and diff whitespace checks passed; no migrations changed.
- Standard `npm run build` was attempted but its unchanged Mirror prebuild download failed with `EAI_AGAIN storage.googleapis.com`. Running `npx next build` separately verifies the application build only.
- Full units: 1,152 passed, one skipped, four failed in two existing environment-dependent suites. All four failures reproduced on untouched base `06dfb332`: three Studio export tests cannot mkdir `/opt/cursor`; one Architect host isolation test gets EACCES opening `/opt/construct-runner.mjs`. Test-generated unrelated evidence was restored.

[Compact validation receipts](evidence/live-voice-repair/validation.txt). Production provider acceptance and the exact cause of the historical rejection remain unverified. No paid calls, hosted SQL/configuration/credentials, merge or deployment occurred.
