# Founder Office — research and implementation decisions

Research date: 2026-10-11. Official online documentation and installed version-matched sources informed this phase. Installed versions: Next 16.3.5, React 19.3, TypeScript 6.0.3, AI SDK 7.0.107, `@ai-sdk/openai` 4.0.72, Supabase JS 2.116.0 and SSR 0.12.7. No dependencies were added.

## Direct OpenAI and shared orchestration

[OpenAI text/Responses documentation](https://developers.openai.com/api/docs/guides/text), [Agents SDK tools](https://openai.github.io/openai-agents-js/guides/tools/), and the installed `node_modules/@ai-sdk/openai/docs/03-openai.mdx` / `node_modules/ai/docs/` were inspected. The existing direct Responses provider and bounded `ToolLoopAgent` are capable of this useful slice. Preserve the founder’s direct OpenAI credits decision; do not introduce Gateway billing or a second agent SDK/runtime just for three named roles.

Coworkers and public Entities share the existing specialist registry, independent contribution/synthesis runner and owner-bound turn receipts. Model identity never grants permission. Server grant checks precede reservations, company context stays isolated, and structured generation preserves human decisions. `generatedWorkContent` requires explicit task/approval arrays for OpenAI’s strict schema; historical stored payloads remain compatible through optional reader fields. JSONB object-key order is not treated as a decision change.

No new model ID was assumed: retain configured `AURELIUS_AI_MODEL`. Model routing changes beyond explicit roles require measured quality, latency and cost evidence. Current account token observations exclude auxiliary, media and voice usage and are not a bill.

## Auth, memory and private data

[Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [the current changelog](https://supabase.com/changelog) were retrieved. The changelog Markdown endpoint returned an unsupported-content-type error through the browsing tool; the HTML index was used instead. Do not claim a full changelog-breaking-change audit.

Retain verified claims, person ownership and the caller’s session-bound Supabase client. No user metadata, email match, membership tier, client flag or forged header creates founder authority. Grant/membership lookup ordering is repaired; personal data and customer isolation still require the same owner predicates. No new tables, exposed views, security-definer functions or storage grants were added.

Reuse explicit memory, profile, company briefs and immutable work versions. Personal memory remains opt-in model context, and portfolio context deliberately excludes it. No automatic promotion, embedding vendor, competing database or broad “remember everything” ingestion is introduced. Company source notes/figures are explicit inputs. Model suggestions cannot change task completion or approval decisions. Founder UI is keyed to the authenticated owner so account changes discard transient state.

## Connections and approvals

[OpenAI MCP approvals](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) and [GitHub App installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation) informed the boundary: a future connector needs narrow authorized capabilities and scoped, expiring credentials. The application does not inherit this Codex session’s tools or authorization. No arbitrary URL proxy, privileged database tool or global GitHub token was added.

The useful credential-free path is fixed public inspection of the one canonical repository and application. Source reads are pinned to the observed commit, bounded and never forwarded with session cookies. Failed observations remain unknown. Approval decisions bind to exact immutable proposal content; they do not create an execution grant. A future consequential executor must independently verify founder authority, approved snapshot, target, capability, limits, revocation and an idempotent execution receipt.

## Durable work

[Vercel Workflows](https://vercel.com/docs/workflows) and the Agents SDK approval mechanisms describe durable execution. This phase does not need a second scheduler just to persist and resume useful work. Existing atomic `company_create_job` / `company_save_work` / `company_review_work` transactions and completed-turn recovery cover on-demand preparation, ambiguous acknowledgment and revision conflicts.

Task plans and approval requests therefore live inside the same immutable deliverable JSONB. Graph validation rejects cycles, missing dependencies and premature completion. A real unattended worker, long-running lease recovery, recurring scheduling and provider-side voice-session accounting remain future accepted slices, not decorative “running” states. See the compatibility-reader rollback requirement in the release document.

## Voice: current OpenAI options versus ElevenLabs

[OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [GPT-Live delegation](https://developers.openai.com/api/docs/guides/live-delegation), [server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls), [GPT-Live migration](https://developers.openai.com/api/docs/guides/live-migration), and [ElevenLabs Agents overview](https://elevenlabs.io/docs/eleven-agents/overview) were inspected. No ElevenLabs runtime was found in the canonical source; there is no measured slower incumbent to retain or replace here.

| Option                                             | Fit for this application                                                                                                                                          | Required proof                                                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI GPT-Live over WebRTC with client delegation | Strong candidate: native conversational transport with the existing app preparing authorized context and returning persisted work results through shared services | Project model access, trusted server session setup, bounded session accounting, complete transcript/receipt reconciliation, interruption behavior and real device acceptance |
| OpenAI Realtime WebRTC                             | Viable alternative with documented browser transport and server controls; compare actual workload performance rather than guessing                                | Same authorization, privacy, accounting and persistence checks; measured turn/interrupt quality                                                                              |
| ElevenLabs Agents / speech arrangements            | Possible voice option, but no connected incumbent exists in this repository and an additional conversational runtime must not split permissions/memory            | Authorized configuration, shared backend/tool contract and a measured latency/quality/cost comparison                                                                        |

Prefer browser WebRTC to an unnecessary chained transcription → model → separate speech path, but do not select by brand or voice identity alone. Client delegation is worth evaluating because trusted app services already own permission checks and saved work. Do not expose project keys, trust browser-supplied session configuration, or mark unsaved spoken claims as executed work.

Acceptance must measure first audible response, transcript delay, interruption cutoff, tool/approval behavior, receipt availability after close/reopen, bounded cost and privacy boundaries. No live key/session/device test was available here, so no voice endpoint, enabled microphone policy or production-readiness claim is shipped. Device keyboard dictation remains an honestly described text input option.

## Responsive experience and release

Installed Next documentation for Server/Client Components, Route Handlers, CSS and `useTypeScriptCli` was read. Reuse Imperial Obsidian tokens, the shared Shell, existing composer/viewport controls and official crest. No new 3D environment or invented founder branding.

[Samsung’s foldable web guidance](https://developer.samsung.com/conference/sdc22/sessions/flexible-and-private-web-experience-on-samsung-internet) supports responsive layout and progressive posture enhancements; a particular viewport width is not a physical Fold test. Acceptance fixtures cover 320/344/768/900/1440/2560px and keyboard behavior, but local browser execution was blocked by server binding. No physical-device claim is made.

[Vercel deployment guidance](https://vercel.com/docs/deployments) and [Git integration](https://vercel.com/docs/git/vercel-for-github) require distinguishing deployment metadata, tested staged production artifacts and promotion. A non-main Git push can create an automatic preview, so changes remain local until deployment is authorized. Production, preview, migrations and token changes were not performed.
