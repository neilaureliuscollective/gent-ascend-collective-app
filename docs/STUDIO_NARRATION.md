# Studio Narration — October 12, 2026

Research and implementation candidate on top of unmerged Studio production-house PR #94. Same canonical application, current Obsidian materials, existing direct OpenAI and session-bound Supabase. No production deployment, hosted migration, new provider subscription or real paid generation was performed.

## Research changes the next build

OpenAI's current model page and deprecation ledger say Sora 2 and the Videos API shut down on **September 24, 2026** with no one-to-one replacement. The still-accessible video guide is historical and cannot justify a live integration. This supersedes the earlier Studio roadmap's suggestion to add Sora. Sources: [Sora 2 model](https://developers.openai.com/api/docs/models/sora-2), [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations).

The speech model pages also mark the old dedicated TTS models deprecated, with January 6, 2027 shutdowns. Avoid adding a new dependency on them. This build uses the currently active **gpt-audio-1.5** Chat Completions API, requested text/audio modalities, built-in voice and WAV output. A constrained narrator prompt asks for the reviewed script verbatim; the provider's reported audio transcript must match normalized script words and finish normally before saving. This check cannot independently prove pronunciation or actual waveform content. Listening and founder acceptance remain required. Official sources: [Audio in Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions), [GPT-Audio-1.5](https://developers.openai.com/api/docs/models/gpt-audio-1.5), [audio workflow guidance](https://developers.openai.com/api/docs/guides/audio), [deprecations](https://developers.openai.com/api/docs/deprecations). Reviewed October 12, 2026.

Runway is a credible future footage option: its official current catalog lists active text/image-to-video models, and its task API supports asynchronous processing. A ChatGPT Runway connector is not a credential or commercial activation for this application. An app-specific server key, billing budget, publishing/usage terms and acceptance of the selected model must precede activation. Research: [current models](https://docs.dev.runwayml.com/guides/models/), [API reference](https://docs.dev.runwayml.com/api/). No Runway adapter or speculative jobs table was added in this phase.

## Implemented vertical slice

- A Narration room in the existing Studio, with short reviewed scripts, three curated built-in voices and clear/calm/confident delivery. Campaign copy can prepare the draft; long copy is rejected for manual shortening. Exporting a script does not run a model.
- A dedicated consent checkbox authorizes exactly one paid provider request. Changing title/script/voice/delivery clears approval. No automatic generation, regeneration, voice cloning, microphone or private member context. AI voice origin is disclosed in the room and saved clip library, with a reminder to disclose synthetic voice when distributing output.
- Durable owner/project narration records, retained source scripts, immutable request identifiers, and a separate enduring quota ledger. One pending request per person and three attempts per rolling day are enforced atomically with a per-owner lock. Failed attempts still count. Project deletion does not reset allowance. This is a conservative pilot allowance, not an advertised permanent paid entitlement or exact customer price.
- A separate private audio bucket, capped at 3 MB and WAV only. Provider response streaming is bounded before JSON/base64 decoding. Actual PCM16 WAV headers, rate/channels, chunk lengths and duration are checked; clips over one minute or changed/incomplete provider transcripts are rejected. The provider request has a 150-second deadline and route a 180-second ceiling, with a 4096-output-token bound. Existing OPENAI_API_KEY is server-only; store:false and no external publication.
- Private playback and WAV downloads use an owner-checked no-store stream, exact authenticated Storage path, personal project scope and RLS. No provider audio ID, signed public download URL, service-role client or shared cache.
- Completed clips can be explicitly selected for a Campaign motion film. Narration longer than the film is rejected before recording; it is not silently truncated. The existing browser renderer records the WAV soundtrack into its actual video output and releases tracks/context on interruption.
- Campaign VTT/SRT exports follow reviewed scene copy and the exact two/four/six-second scene timing. They are clearly labeled **scene captions, not speech alignment**. They contain no invented word timestamps or transcription claims. Review timing before publishing.

## Persistence and uncertainty

An upload or completion acknowledgement may be lost after the data commits. Such errors preserve private bytes and pending reservations. A fresh owner/project/request receipt can recover an already completed write. The UI does not automatically submit another paid request and locks an uncertain attempt until its saved receipt is confirmed.

A member can explicitly recover a pending narration after ten minutes, beyond the bounded request lifetime. Recovery checks the deterministic owned Storage path: valid existing WAV bytes receive a completed receipt; only a definite Storage 404 permits a failed receipt. Permission, network, malformed-file or uncertain database errors do not delete bytes or free the pending request. Recovery never calls OpenAI. Operations may still need to reconcile an unresolved record or an orphaned file; no automatic garbage collector is represented as implemented.

## Migration and activation checklist

The additive candidate is `supabase/migrations/20261012120000_studio_narration.sql`. It creates narration/usage tables, owner RLS, narrowly scoped reservation/completion functions and a separate private bucket. It does not change existing image quotas/buckets or pending creation-stack migrations. The functions use authenticated owner checks and empty search_path, revoke anonymous/PUBLIC execution, and expose table SELECT only to owners. Optional company scope is checked without requiring a pending company-column migration.

The Supabase CLI migration-generation command was attempted; the sandbox denied creation of its home configuration directory. The same failure persisted with an XDG configuration override. The migration filename was therefore created locally and checked for unique ordering, rather than falsely described as CLI-generated or applied. Existing hosted migration hashes remain unchanged. SQL execution in PGlite is a test adapter, not live Supabase Auth/Storage. Supabase changelog retrieval was attempted but returned an upstream error; current RLS documentation was retrieved.

Founder setup, without sharing credentials in chat:

1. Review and apply the additive migration to a protected staging database; verify the private bucket and two-account RLS/Storage isolation. Do not reset or seed a hosted database.
2. Use the existing Vercel server-only OPENAI_API_KEY with **gpt-audio-1.5** access. Set a suitable OpenAI project budget. No second key or provider account is required for narration.
3. After staging acceptance, set **STUDIO_NARRATION_ENABLED=true** in the intended environment. Default is off. Missing schema/configuration disables generation honestly while script preparation and scene subtitles remain available.
4. Using normal founder/member login, approve one short script; verify actual voice, words, pronunciation, latency, duration, provider cost, saved/reopened audio and narrated film. Test interruption/recovery and another account's denied access. Do not infer this from fixtures or a key being present.
5. Review physical Safari, Samsung Fold/unfolded/DeX playback/download and caption imports. Production migration/release needs separate founder approval.

## Verification

Local lint, strict types, unit/SQL tests, migration ledger and optimized build receipts are tracked in the PR. The focused browser suite adds reviewed-consent reset, real WAV playback/download, selected saved narration in a real MediaRecorder film, VTT download and honest unactivated behavior. Its API/provider data are labeled synthetic; actual WAV/video/container export code runs in Chromium. Independent Python inspection validates WAV channels/sample width/duration and scene caption timing. Live provider generation and hosted Auth/Storage acceptance are not claimed.

Next: founder narrative-quality evaluation; provider selection and an owner-bound, audited quote/job lifecycle for real AI footage; then word-level alignment, music/voice mixing and publishing integrations under explicit user approval. Keep the first-party image backend and pending creation work intact.
