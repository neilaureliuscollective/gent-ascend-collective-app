# Aethelios conversation motion

October 15, 2026. Dedicated motion workstream on Talk Elevation. Review branch only — no production merge, hosted migration, credential change or paid call.

## Stack

| Layer | Reference | Head |
| --- | --- | --- |
| Production main | Studio #132 | `804c8770754aced1837e82dffa4a416c24baa595` |
| Talk foundation | PR #131 `cursor/talk-creative-conversation-5b08` | `ae406d6d0e913cfaf2104958bb508ebf9fe0f944` |
| Talk Elevation | PR #135 `cursor/talk-elevation-5b08` | `948a9b95f179e7719fb7a3c11904666c33fdfb6d` |
| This workstream | `cursor/aethelios-conversation-motion-0a11` · PR #139 | finishing pass after `79f5895f19ad2e2c310246cb2fc797bd483edb1f` |

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

One `ConversationAnnouncer` (`role=status`, polite) speaks operational transitions once. Persistent visual notices (image generation unavailable, a prior Reply saved.) stay on the reading line and do not replace Sending / Preparing / Saving. Inline response status stays `aria-live=off`. Company Room no longer drops its announcer while a sent request is active. Tokens, amplitude samples and animation frames are not announced.

Header identity uses the same official gold-A at 24 CSS px (`LivingSignal` toolbar). There is still no dedicated 24px conversation crop; the 192px official file remains the honest fallback. The application icon is unchanged. Narrow Talk lets the title shrink and ellipsize; below 360px the redundant New control moves into Tools & context. Composer keyboard focus is the gold shell ring. Compact Live controls are shown from microphone / playback / session state.

## Continuation (after `9c39944`)

Keeps the compact 24px A, filament, removed sticky banner, audio CSS wiring, Still/reduced-motion and offscreen pause. Fixes three verified gaps: artifact terminalization, approval ≠ creating, and one polite announcer. Visual cohesion uses the official A in the Talk header, quieter outlines, shell-owned composer focus, and state-derived voice controls.

## Finishing pass (after `79f5895`)

Preserves the compact approved A, emerald activity signal, artifact terminalization, approval wording, measured audio, state-aware voice controls, reduced-motion/Still and the Talk dock. Two verified repairs only:

1. Narrow header: shared `.talk-title` min-width is 0, not 8rem. Visible toolbar controls stay inside 320 / 344 / 390 CSS px. New remains in the toolbar from 361px up and is reachable from Tools below 360px.
2. Announcer: `conversationAnnouncerText` prefers the current request. Persistent informational copy is visual-only until a confirmed save or uncertain/error outcome.

The motion fixture now mounts `ConversationViewport` (`.talk-page`) and smoked-glass so composer focus can be compared with the real `/app/aethelios` route. The real smoked-glass `--io-text` (`#F2F2EE`) is what painted the near-white inner field; keyboard focus stays on the gold shell.

## Verification (this continuation)

- `tsc --noEmit` pass
- eslint on touched TS/TSX pass
- `vitest run` conversation/motion units 9/9 in this file (includes persistent-notice coverage)
- `playwright.motion.config.ts` 35/35 after header, announcer and composer-focus assertions
- Actual Next `/app/aethelios` 200 on local `:3100` (signed-out / disconnected workspace). Visible header controls stay inside 320 / 344 / 390 / 690 CSS px, including 24px text-zoom and 690×420 keyboard-open. 320–344 hide the redundant New control; 390 and Fold keep it. Focused composer: textarea outline none, gold 2px shell. No local Auth session, so send/stream was not exercised on this route.
- Labeled synthetic fixture clips (VP8 webm, ffprobe playable) at `/opt/cursor/artifacts/videos/`:
  - `motion-narrow-header-keyboard.webm` 5.4s
  - `motion-submit-activity-saved.webm` 4.9s
  - `motion-image-approval-cancel-fail.webm` 5.1s
  - `motion-voice-states.webm` 5.6s
  - `motion-reduced-motion-still.webm` 5.6s
  - `next-talk-narrow-header-keyboard.webm` 4.4s (signed-out Next Talk)
- Production `next build`, hosted Auth, physical Fold, paid Live and live microphone were not run.

Synthetic fixture sequences are labeled and are not live provider proof.

## Limits

- Synthetic fixture sequences are labeled and are not live provider proof.
- No dedicated 24px emblem asset.
- Reading a document / Running a build unwired.
- Hosted Talk, paid voice and production merge remain unauthorized.
