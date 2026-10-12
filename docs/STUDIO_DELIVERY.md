# Studio Delivery — October 12, 2026

Next useful phase on unmerged Footage #96 → Narration #95 → production-house #94. The earlier provider pilot still requires application credentials, staging migration and live acceptance. Complete a usable business handoff from existing saved media before extending paid generation. No production release, new migration, provider configuration, paid generation or automatic publishing.

## Research and choice

Retrieved October 12: [MDN readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams) supports bounded chunk reads and cancellation; [object URL cleanup](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static) informs the existing download helper's cleanup; [Runway outputs](https://docs.dev.runwayml.com/assets/outputs/) reinforces copying media into private owned storage rather than handing off expiring vendor URLs. Read installed Next 16.3.5 server/client-component guidance. Applied React best-practice review: browser-only export, lazy loading, cancellable effects, real loading/error status, native labeled controls and unchanged current Obsidian materials.

Owned-image animation remains a valid next phase, but adds paid source-transfer consent, signed image-content snapshots and provider acceptance requirements. This slice connects the existing media rooms into an immediately useful delivery workflow with no further provider dependency.

## Implemented

- Delivery room in the same Studio workspace. Explicitly select up to eight completed saved images, AI footage clips or narration files. Unavailable provider schemas do not prevent existing-image delivery. Media list failures are disclosed; no fabricated assets.
- Review selected files, current storyboard copy, scene timing and a self-review checkbox before download. Approval binds to the exact local project/title/scenes/selection/timing/selected metadata snapshot; edits or refreshed props invalidate it. This records member confirmation, not independent legal clearance, factual verification or backend publication acceptance.
- One actual ZIP containing selected original media, campaign Markdown, a versioned manifest, README and optional scene-timed VTT/SRT. ZIP preserves separate assets; it does not assemble, trim, mix or synchronize a film. Caption timings come from scene copy and reviewed two/four/six-second intervals, never invented word alignment.
- Manifest includes file byte counts and SHA-256 checksums, clear synthetic audio/video provenance and uncertain saved-image provenance. It does not automatically include application IDs, storage paths, provider IDs/URLs, secrets or private source prompts. Campaign copy contains the user's reviewed storyboard text; treat the downloaded archive as private until intentionally shared.
- Reuses existing authenticated owner-scoped image/audio/video GET endpoints and private buckets. Delivery constructs only fixed same-origin routes from strict UUID/type inputs; never accepts arbitrary URLs. No service-role client, anonymous share link, public bucket, model context, external upload or publishing action.
- Sequential bounded streaming: maximum eight assets, 10 MB/image, 3 MB/audio, 30 MB/clip, under 49 MB combined media and 50 MB archive content. Audio/video container checks reuse existing validators; image signatures determine supported PNG/JPEG/WebP extensions. Signature checks are not full image decoding or independent content review. The existing STORE-only ZIP writer gains a separately bounded delivery profile; its default five-file image-pack contract stays unchanged. Duplicate filenames and traversal paths are rejected.
- Cancellation/unmount/timeout prevents a partial download. Missing, malformed or oversized selected assets fail the entire package; no silent omission. Each read has an abortable signal; whole export has a two-minute ceiling. Busy state disables edits and offers cancellation. Progress counts verified copied files rather than inventing percentages. Browser memory remains bounded but may require fewer assets on constrained physical devices; no server archive retention or compression pipeline is introduced.

## Verification and release

Meaningful unit tests cover approval, strict sources, duplicate/path rejection, real MP4/caption packaging, bounded reads, cancellation and honest missing-file failure. Focused browser tests build a genuine image/MP4 handoff at 344px, reset consent when timing changes, download the ZIP and reject missing saved images without download. CI independently opens the ZIP, checks CRCs, file list, media headers, SHA-256 hashes, byte counts and caption timing. Fixtures are synthetic and intercepted APIs are not live Auth/provider acceptance. Existing Studio, Lifestyle and Obsidian regressions are separate gates; exact outcomes are recorded in the PR.

No new credentials or migration are needed specifically for Delivery. Existing image persistence must work. Narration and Footage still need their own verified migrations/provider activation before real saved audio/video can appear. No mocked data appear in the product.

Production approval remains separate. Hosted two-account isolation, real provider output, physical Safari/Fold/DeX large-file behavior and screenshot inspection remain open. Screenshots captured by CI do not prove visual inspection. Selection/review is intentionally local and resets on leaving the room; no durable release audit is claimed.

Next: verify the current provider stack on staging, then add owned-image animation with source hashes and a true saved-clip campaign timeline. Delivery is a portable handoff, not a substitute for that editing work.
