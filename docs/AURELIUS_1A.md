# Aurelius 1A — First working intelligence

Authorized by the founder on 2026-09-20. The core product priority is Aurelius himself; metric/routine work moves behind this milestone.

## Experience shipped in code

Open Aurelius anywhere, or use the full conversation workspace. Send a message; see a streamed, formatted answer; stop if needed; return to saved conversations; delete a conversation. Review the profile/goal context available to him. Turn personal context off per message. Explicitly save, correct and forget memories. Flag replies for founder review. No payment or SMTP requirement is added to local Founder mode.

An OpenAI API key and a functioning Supabase database are real dependencies for actual persisted conversation. The shell, profile, saved context and memory do not need a model key; unconfigured AI shows an honest connection-pending state. Browser/SDK fixtures never become an app identity bypass or fake live mode.

## Activate on the existing official checkout

1. Use Node 24 and Docker; npm ci. Run npm run dev:setup. Apply the new local migration with npx supabase migration up --local, or deliberately npm run db:reset for clean synthetic data. Never reset hosted data.
2. Put OPENAI_API_KEY in ignored .env.local, using a dedicated OpenAI project key with provider-side usage controls. AURELIUS_AI_MODEL optionally overrides the verified default gpt-6-astra. Do not put the key in client code or chat. dev:setup rewrites .env.development.local, so keep AI settings separate.
3. Run npm run check; npm run test:integration; npm run test:founder. These do not require paid model generation.
4. Run npm run test:ai:live for one synthetic, potentially billable model connection request. This is deliberately excluded from ordinary CI and fails clearly without a key. It tests connectivity, not intelligence quality.
5. npm run dev; open http://127.0.0.1:3000/dev; use the local founder token and Founder scenario. Open Aurelius. Test saved conversations, context, memory and cancellation. Review flagged replies in the console.

The remote execution environment has no Docker or OpenAI key. Actual Supabase and live-model gates remain open; do not claim the founder can already use a hosted app. No production/preview deployment has been created. A phone-installable private preview requires protected hosting, a separate staging Supabase project, real beta-granted Auth and verified HTTPS/PWA behavior; the local harness must not be exposed for phone access.

## Acceptance

- Real founder entry works without payment/email/onboarding.
- A synthetic real model conversation streams, saves and survives reload with the expected model and current prompt version.
- Explicit memory changes affect the next new conversation; forgotten memory is absent from retrieval.
- Profile/goal inclusion is visible and optional; conversations remain owner-isolated.
- Concurrent/duplicate requests, missing keys, malformed input, interruption and database-save failure produce honest states.
- Mobile composer remains visible; keyboard/focus, dialog closure and Markdown safety work.
- Founder evaluates useful conversations using the rubric before any claim of ChatGPT-level usefulness.

## Next phase

Finish connection/real persistence acceptance, then founder daily use. Improve personality, answer quality, continuity and live research based on that evidence. Add voice and additional life data when they materially strengthen Aurelius. Do not default back to generic dashboard expansion.
