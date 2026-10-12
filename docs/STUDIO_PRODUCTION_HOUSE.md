# Aethelios Studio — production house, phase 1

Founder approved execution on October 12, 2026. Canonical application only. This phase creates useful personal/business production tools while preserving the existing direct OpenAI, session-bound Supabase and Imperial Obsidian foundations.

## What ships in this candidate

- Project brand kits: name, voice, safe colors, curated typography and an original logo chosen from the project's owned references. Kits persist in the existing project brief JSONB; no migration or new service. Brand direction informs subsequent image requests. An original logo is composited in Finish rather than asking a model to recreate trademark artwork.
- Talk-to-Studio preparation keeps the reviewed brief and first image direction when creating a project. A generic starter asks for one image, matching the actual request.
- Direction, Create, Library, Campaign and Finish remain rooms in the same Studio. Campaign reuses the existing owned storyboard and completed-image links. Unfinished frames are shown and block film rendering instead of silently disappearing.
- Finish exports an actual five-file ZIP: square, portrait and landscape PNGs; an editable layout recipe; and usage notes. Recipe import validates bounded JSON and requires the original completed image in the current project. Import prepares an editable draft; saving is explicit. Current saved project brand settings apply.
- Motion pilot renders real downloadable video from saved images, scene titles/captions and optional user-supplied audio. It uses canvas capture and MediaRecorder on the member's device. It does **not** synthesize AI footage, call a video provider or publish externally. Output is local until downloaded, not saved to Supabase. It supports one to eight scenes, two/four/six seconds each, square/portrait/landscape, optional gentle zoom (off by default), visible progress and cancellation. Unsupported devices receive a clear error; image and brief exports remain usable.
- Image creation exposes the existing creation entitlement and checks missing provider configuration before consuming a quota reservation. OpenAI access failures have a redacted, truthful explanation. An uncertain database acknowledgement after upload never deletes possibly committed image bytes or reports an automatic retry. Exact owner/project/version re-read can recover an already committed receipt; unresolved writes remain pending for refresh/manual operational reconciliation.

## Boundaries and performance

Personal project reads/mutations stay person-scoped and exclude company projects. Logo attachment verifies person, project and reference ownership with the user's session; existing RLS, original-image API and stale-write guards remain. Quota remains the existing 12-request rolling day and single pending generation. There are no new paid-tier promises, generated testimonials, automatic memory writes or automatic publishing actions.

Media code loads only on an explicit render. Video is bounded to 48 seconds, 720–1280 pixels, 24 fps and 30 MB; source image dimensions/bytes and soundtrack size/duration/channels/rate are bounded. Rendering aborts on cancellation, leaving the room, a hidden tab, unavailable media or a timeout. Tracks, animation frames, object URLs and AudioContext resources are released. There is no microphone access or continuous ambient video. Formats depend on browser codec support; there is no universal MP4 guarantee. WebM output may need conversion for some publishing platforms. Native video and ZIP processing need physical Safari/Samsung Fold/DeX acceptance before broad launch claims.

The finished canvas intentionally uses curated locally available typography; this phase does not upload arbitrary fonts or supply a general timeline/NLE, editable PSD/SVG or collaborative canvas. Imported layout recipes preserve the saved source identifier, not embed/export private originals. Brand colors are user content, separate from the approved application palette.

## Reuse and pending work

Existing OpenAI Responses image generation/refinement, private references, owner-scoped image versions, scenes, finishes, access contracts and Supabase Storage remain the working core. No replacement backend, dependency, migration or speculative provider adapter. Open PR #80's creation integration and PR #62's Mission-to-Studio work contain independent staging/migration gates; this candidate is based on released main and does not merge them. Architect #83 also remains separate. Wider Saved Work/company website publishing is not represented as released.

## Research and next phases

The product direction is a creative production house: a personal/business brief becomes a reusable brand direction, editable visual work, coordinated campaign and distributable deliverables. Inspiration is workflow and continuity rather than copied competitor visuals. Next valuable phases are durable AI-generated footage, consented voiceover/music and subtitles, shared brand-library/project assets, product photography/campaign preparation using real catalog sources, and approved publishing integrations. Do not market a generic conversational image box as a complete video studio.

Official sources reviewed October 12, 2026:

- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation) and [image tool](https://developers.openai.com/api/docs/guides/tools-image-generation): keep the existing Responses integration and application-owned source files. Model availability still needs real account acceptance.
- [OpenAI video generation](https://developers.openai.com/api/docs/guides/video-generation): future AI footage needs asynchronous creation/status/content retrieval, permissioned provider access and cost acceptance; do not shoehorn long-running jobs into the existing synchronous image request. Durable owner-bound jobs, cancellation/idempotency, downloaded-content persistence and quota reconciliation are prerequisites.
- [Canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) and [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder): support a browser-native film from an origin-clean canvas and runtime-negotiated format. This is a useful native pilot with a distinct contract from generative video.
- Existing architecture/evidence: [AETHELIOS_STUDIO_V1.md](AETHELIOS_STUDIO_V1.md), [AETHELIOS_STUDIO_PLACEMENT.md](AETHELIOS_STUDIO_PLACEMENT.md), [IMPERIAL_OBSIDIAN.md](IMPERIAL_OBSIDIAN.md) and [OBSIDIAN_INTELLIGENCE.md](OBSIDIAN_INTELLIGENCE.md).

## Validation and founder setup

Local lint, strict types, 442 unit/SQL-emulation tests and migration ledger passed. Optimized production build and focused CI/browser receipts are tracked in the PR. Local browser serving is prohibited by this execution sandbox; CI runs the real built application with synthetic owned API responses and the actual browser PNG/ZIP/MediaRecorder implementations. Those fixtures are **not** live Supabase Auth, Storage or OpenAI acceptance. The browser suite verifies phone/unfolded/desktop widths, saved brand direction, editable recipe import, playable/downloadable video, cancellation and released media tracks. Python independently inspects the exported ZIP/PNG/video bytes in CI. Historical broad browser failures remain tracked separately; no gate is disabled.

No new credentials are needed for the native motion/export rooms. Existing image generation requires a server-only OPENAI_API_KEY in the intended Vercel environment, permission for the existing image models, a compatible Responses model, and the existing Studio migrations/private bucket/RLS. Do not send credentials in chat. An ordinary authenticated founder/member session must test: create project, upload original reference/logo, generate/refine, save/reopen brand and finished layout, produce/download film, and confirm another account cannot read the originals. A present key or successful deployment is not proof of provider acceptance.

Production merge/deployment is separate from this reviewed implementation candidate. No hosted migration or external merchant/provider configuration was performed.

### October 12 follow-up research correction

[STUDIO_NARRATION.md](STUDIO_NARRATION.md) supersedes the earlier future-Sora suggestion: the official model/deprecation ledger confirms Sora 2 and Videos API shut down September 24, 2026. The still-visible video guide is historical. Native motion remains implemented; the next candidate adds active OpenAI narration and scene subtitle exports while an independent footage provider remains a future accepted integration.
