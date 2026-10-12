# GPT-Live evaluation: finalization safety — 2026-10-12

The existing public pilot continues to use OpenAI Realtime WebRTC. GPT-Live remains an evaluation adapter until account access, acoustic performance, pricing and device acceptance are measured.

Reviewed OpenAI [session management](https://developers.openai.com/api/docs/guides/live-conversations) and [session creation](https://developers.openai.com/api/reference/resources/live/methods/create). The guide requires keeping transports open until `session.closed`, retaining cumulative usage, and stopping new work after requesting closure. It also documents expiry, but this review did not establish a configurable server duration cap that replaces our independent cleanup requirement.

The adapter now rejects new context updates and delegations after close starts, while draining captions and usage until finalization. A mismatched session cannot alter usage or confirm closure. Events after confirmed finalization cannot mutate the result. Provider creation and hangup reject HTTP redirects. Regression tests cover these boundaries; synthetic events are not provider acceptance or measured latency.

Hosted testing is still blocked on an isolated Supabase target. The connected account exposes the canonical Gent production project and a separate founder project, neither suitable for the test environment. The advertised branch cost-estimate tool returned UNAVAILABLE (not present in tools/list). No branch, paid resource, environment setting, migration or scheduler was created or enabled. The existing OpenAI secret remains configured in Vercel.

Three release workstreams remain: (1) protected hosted test environment, (2) actual voice/tools/device/usage acceptance, (3) production gates and controlled rollout. Founder voice testing becomes possible after the first workstream, not after this adapter correction.
