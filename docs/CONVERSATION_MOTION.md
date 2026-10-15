# Aethelios conversation motion

October 15, 2026. Dedicated motion workstream on Talk Elevation. Review branch only — no production merge, hosted migration, credential change or paid call.

## Stack

| Layer | Reference | Head |
| --- | --- | --- |
| Production main | Studio #132 | `804c8770754aced1837e82dffa4a416c24baa595` |
| Talk foundation | PR #131 `cursor/talk-creative-conversation-5b08` | `ae406d6d0e913cfaf2104958bb508ebf9fe0f944` |
| Talk Elevation | PR #135 `cursor/talk-elevation-5b08` | `948a9b95f179e7719fb7a3c11904666c33fdfb6d` |
| This workstream | `cursor/aethelios-conversation-motion-0a11` | stacked on #135 |

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
- Creating an image: real creation/image event only.
- Responding: first real text replaces waiting copy; the answer is the focus.
- Saving / Saved / Save unconfirmed remain distinct.
- Stopping then Stopped. Late events cannot revive a finished or stopping request.

No fabricated research stages, private reasoning, percentages, typewriter backlog or decorative delay. Reading a document and Running a build have no provider event in this tree and are not shown.

## Surfaces

Conversation and welcome use the compact emblem + recessed graphite track + emerald filament. Expanded Live keeps the existing large guiding presence. Compact voice uses the same filament language at 88–120px. Work/Studio task strips keep the compact guiding mark.

The composer owns Send/Stop. Duplicate waiting banners and footer activity copy are removed. Artifact placeholders receive the emerald edge when their operation starts; Ready only when the object is accessible.

## Verification (this workstream)

- `tsc --noEmit` pass
- eslint on touched TS/TSX pass
- `vitest run` 1089 pass
- `playwright.motion.config.ts` 26/26 pass
- Fixture `fluid-conversation` cases 15/15 pass. The VisualViewport `/app/aethelios` case needs the Next app server and was not run here.
- Production `next build`, hosted Auth, physical Fold and paid Live were not run.

Synthetic acknowledgement-render 10.6ms and first-render 85ms on the local fixture. No animation delay on submit. Labeled demo clips: `playwright.demo.config.ts`.

## Limits

- Synthetic fixture sequences are labeled and are not live provider proof.
- No dedicated 24px emblem asset.
- Reading a document / Running a build unwired.
- Hosted Talk, paid voice and production merge remain unauthorized.
