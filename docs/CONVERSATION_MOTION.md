# Aethelios conversation motion

October 15, 2026. Dedicated motion workstream on Talk Elevation. Review branch only — no production merge, hosted migration, credential change or paid call.

## Stack

| Layer | Reference | Head |
| --- | --- | --- |
| Production main | Studio #132 | `804c8770754aced1837e82dffa4a416c24baa595` |
| Talk foundation | PR #131 `cursor/talk-creative-conversation-5b08` | `ae406d6d0e913cfaf2104958bb508ebf9fe0f944` |
| Talk Elevation | PR #135 `cursor/talk-elevation-5b08` | `948a9b95f179e7719fb7a3c11904666c33fdfb6d` |
| This workstream | `cursor/aethelios-conversation-motion-0a11` · PR #139 | continuation after `9c399440cfd8563c6db560926226f3eb00531562` |

Talk remains unmerged. This branch documents the stack and keeps inline voice dock, single transcript, conversation continuity, artifact targeting and release-diagnostic repairs from #131/#135. It does not merge those branches and does not duplicate their implementation.

Last inspected elevation head before this work: `948a9b95f179e7719fb7a3c11904666c33fdfb6d`. Refreshed 2026-10-15.

## Starting findings

- `IntelligenceResponse` hardcoded `size="large"`.
- `GuidingPresence` was 104–144px inside a padded response row (`min-height: 88px`) with glow, divider and sticky waiting/generating/saving treatment.
- The large mark could remain after Saved.
- Shared motion files were unchanged between deployed main and the inspected Talk elevation head.
- Compact, reduced-motion, Still and offscreen/background pausing already existed and are reused.
- RTC levels were sampled onto `--live-audio-level`, but `LiveSurface` did not pass them into the rendered operation. Compact CSS targeted retired `.im-artwork`. `GuidingPresence` now inherits `--live-audio-level` when it has no measured `--level`. Compact Live uses `LivingSignal` / `.im-filament` and `.identity-envelope`.

## Identity asset

Stable mark: approved official gold-A `/brand/aethelios-official-20261015-192.png` at 24 CSS px.

**Missing asset:** there is no production-quality 24px conversation crop in the repository. Install masters remain 192/512 (plus 64px browser and 180px Apple). The 192px official file is the honest existing fallback, scaled. Do not invent a redrawn A.

## Motion language

Gather → articulate → settle, interruptible, scoped by request/operation id.

- Sending: transport pending only.
- Preparing a reply / Working: accepted, no richer event yet.
- Searching the web: real `web_search` activity only.
- Waiting for your approval: image proposal / `approval` only. Generation has not started.
- Creating an image: image `running` / `generating` only.
- Responding: first real text replaces waiting copy; the answer is the focus.
- Saving / Saved / Save unconfirmed remain distinct.
- Stopping then Stopped. Late events cannot revive a finished or stopping request.

No fabricated research stages, private reasoning, percentages, typewriter backlog or decorative delay. Reading a document and Running a build have no provider event in this tree and are not shown.

## Surfaces

Conversation and welcome use the compact emblem + recessed graphite track + emerald filament. Expanded Live keeps the existing large guiding presence. Compact voice uses the same filament language at 88–120px. Work/Studio task strips keep the compact guiding mark.

The composer owns Send/Stop. Duplicate waiting banners and footer activity copy are removed. Artifact placeholders receive the emerald edge when their operation starts; Ready only when the object is accessible. Stop, failure and unconfirmed save terminalize in-progress placeholders as stopped / failed / uncertain and leave completed artifacts alone. Late events from an older or already-terminal request cannot restart them.

One `ConversationAnnouncer` (`role=status`, polite) speaks operational transitions. Inline response status stays `aria-live=off`. Company Room no longer drops its announcer while a sent request is active. Tokens, amplitude samples and animation frames are not announced.

Header identity uses the same official gold-A at 24 CSS px (`LivingSignal` toolbar). There is still no dedicated 24px conversation crop; the 192px official file remains the honest fallback. The application icon is unchanged. Narrow Talk hides the conversation subtitle before the Aethelios title. Composer focus is on the rounded shell, not a white inner textarea rectangle. Compact Live controls are shown from microphone / playback / session state.

## Continuation (after `9c39944`)

Keeps the compact 24px A, filament, removed sticky banner, audio CSS wiring, Still/reduced-motion and offscreen pause. Fixes three verified gaps: artifact terminalization, approval ≠ creating, and one polite announcer. Visual cohesion uses the official A in the Talk header, quieter outlines, shell-owned composer focus, and state-derived voice controls.

## Verification (this continuation)

- `tsc --noEmit` pass
- eslint on touched TS/TSX pass
- `vitest run` conversation/motion units 18/18
- `playwright.motion.config.ts` integration including approval, cancel/partial, failure, announcer 19/19 after the announcer assertion was aligned with sticky search
- Labeled fixture demo clips (VP8 webm, ffprobe playable):
  - `motion-text-tool-activity.webm` 5.4s
  - `motion-artifact-approval-cancellation.webm` 5.2s
  - `motion-voice-states.webm` 7.5s
  - `motion-keyboard-fold-layout.webm` 5.3s
- Actual Next `/app/aethelios` 200 on local `:3100` (signed-out / disconnected workspace). Header uses the official 24px A; 390px keeps the full Aethelios title by shortening Live first; composer focus is the rounded shell. No local Auth session, so send/stream was not exercised on this route.
- Production `next build`, hosted Auth, physical Fold, paid Live and live microphone were not run.

Synthetic fixture sequences are labeled and are not live provider proof.

## Limits

- Synthetic fixture sequences are labeled and are not live provider proof.
- No dedicated 24px emblem asset.
- Reading a document / Running a build unwired.
- Hosted Talk, paid voice and production merge remain unauthorized.
