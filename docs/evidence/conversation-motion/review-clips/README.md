# Conversation motion review clips

H.264 / yuv420p / `+faststart` MP4. Playable in GitHub’s file viewer, QuickTime and Chromium. These replace the earlier VP8 WebM Cursor links, which the reviewer could not open. The Intelligence motion CI artifact previously uploaded PNGs only; the same clips are now in this folder and uploaded as `conversation-motion-review-clips`.

Product animation timing is unchanged. Each clip holds a ~2s settled opening, ≥2.2s dwell per readable label, and a ~2s settled ending.

| File | Surface | What it shows |
| --- | --- | --- |
| [review-text-send-response-saved.mp4](review-text-send-response-saved.mp4) | Synthetic fixture | Type → Send → Preparing a reply → response → Saving → Saved |
| [review-artifact-approval-complete.mp4](review-artifact-approval-complete.mp4) | Synthetic fixture | Waiting for your approval → Creating an image → Image ready → Saved |
| [review-artifact-stop-and-failure.mp4](review-artifact-stop-and-failure.mp4) | Synthetic fixture | Completed image stays ready; in-progress stops; after reload, failure marks unfinished work unconfirmed |
| [review-voice-listening-playback-end.mp4](review-voice-listening-playback-end.mp4) | Synthetic fixture | Labeled measured envelope: listening 0 then 0.8, speaking, playback blocked, session ended. **Not** a paid Live or microphone session |
| [review-persistent-notice-second-request.mp4](review-persistent-notice-second-request.mp4) | Synthetic fixture | Persistent “image generation is unavailable” stays visual; second send announces Preparing / Saved |
| [review-reduced-motion-still.mp4](review-reduced-motion-still.mp4) | Synthetic fixture | `prefers-reduced-motion: reduce` plus Still; send → Saved |
| [review-next-talk-narrow-header.mp4](review-next-talk-narrow-header.mp4) | Real Next `/app/aethelios` | Signed-out 200 at 344 CSS px. Header fits (Live, A, Conversations, title, Tools). New conversation is in Tools. Gold composer shell. Short-height keyboard-open. **Not** an authenticated or paid-provider proof |

Fixture pages are labeled “Synthetic API events only” / “Labeled synthetic sequences — not a live provider.” Paid Live and authenticated send/stream were not run.
