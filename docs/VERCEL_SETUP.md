# Fresh Vercel setup

Updated 2026-09-22 for the new official repository and direct OpenAI. Actual hosted Supabase and paid model acceptance remain open. No Vercel deployment or remote database change was performed during preparation.

## GitHub first

Official repository: https://github.com/neilaureliuscollective/gent-ascend-collective-app

This is the founder-selected destination for the existing application. Import this repository into Vercel with the repository root as the root directory. The existing source, artwork, migrations and tests are preserved. No product-transformation features are included in this deployment preparation.

## Vercel import settings

| Setting           | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| Framework         | Next.js                                                 |
| Root directory    | Repository root                                         |
| Production branch | main                                                    |
| Node.js           | 24.x (also constrained by package.json)                 |
| Install command   | npm ci                                                  |
| Build command     | npm run build                                           |
| Output directory  | Framework default; do not set a static export directory |

`vercel.json` records the framework/install/build settings. GitHub Actions runs the broader quality gates. A successful Vercel build alone does not replace Auth, database or live-model verification. Enable deployment protection for the private founder site using the controls available on the Vercel plan; keep application sign-in and RLS as well.

## Required before the first main-branch build

Vercel calls the main-branch environment **Production** even while this product is in private testing. Set these in its Production environment scope:

| Variable                             | Value                                        |
| ------------------------------------ | -------------------------------------------- |
| APP_ENV                              | production                                   |
| AURELIUS_DEV_HARNESS                 | false                                        |
| NEXT_PUBLIC_SUPABASE_URL             | URL of the dedicated hosted Supabase project |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable key from that same project       |

The production configuration deliberately requires the Supabase pair. Add them before pressing Deploy. Do not copy `.env.example` wholesale: its `APP_ENV=local` is for local use. Do not set `NODE_ENV` manually. Never upload local developer tokens, founder seed passwords or a service-role key to Vercel.

**Founder sign-in correction (2026-09-24):** Production was deployed with stale
public Supabase configuration for project `ashhohitbvfcfspcoojt`, while the
confirmed founder account and access grant are in `volpzkfsnmtztrovexcw`.
The production Auth client and session proxy now select the latter project's
public URL and publishable key from `src/platform/supabase/connection.ts`.
Local and preview still use their configured environment. Reconcile the two
Production Vercel environment variables with this dedicated project before
removing that code-level selection; changing them requires a redeploy.

Preview branches use `APP_ENV=preview` and a separate staging Supabase project. A preview without either Supabase variable renders only the shell; a partial pair is invalid. Never attach disposable previews to real customer data. Redeploy after changing environment variables.

## Hosted database and founder account

Use a fresh dedicated Supabase project for private testing. Apply all four migrations before creating the founder Auth user. On an authenticated operator workstation, verify the project ref and run:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Review that only the intended four migrations are pending, then:
npx supabase db push --linked
```

Do not run a hosted reset, `--include-seed`, `dev:setup`, or `supabase config push`. Local seed users and local Auth settings must stay local. Keep hosted public signup disabled while access is founder/invitation-only. Set the hosted Auth Site URL to the eventual HTTPS app URL.

Create Neil's real email/password user through Supabase's trusted Auth administration, with the email confirmed administratively. This avoids waiting on SMTP. The migration's Auth trigger provisions the person and membership automatically. Copy that user's UUID and run this narrowly scoped grant in the trusted SQL editor, replacing the placeholder:

```sql
update public.membership_accounts as membership
set beta_access = true, updated_at = now()
from public.persons as person
where membership.person_id = person.id
  and person.auth_user_id = 'REPLACE_WITH_FOUNDER_AUTH_UUID'::uuid
returning membership.person_id, membership.beta_access;
```

Verify exactly one row is returned. Sign in at `/you` using that account. This is normal hosted Auth, ownership and beta entitlement; it requires no Stripe payment or onboarding completion. `/dev` must return 404 on Vercel. Do not expose the local harness to get into the hosted app.

## Connect Aethelios directly to OpenAI

Add `OPENAI_API_KEY` privately in the Vercel project environment variables. Use an API key from the OpenAI project/account containing the founder's existing API credits. No `AI_GATEWAY_API_KEY`, Gateway credits or BYOK setup is required. Do not prefix the OpenAI key with `NEXT_PUBLIC_` and do not commit it.

The optional `AURELIUS_AI_MODEL` is `gpt-6-astra` by default (without `openai/`). This internal variable name is retained for compatibility; the public intelligence is Aethelios. Verify that your OpenAI project has access to the selected model. The app builds without an OpenAI key; model replies remain unavailable until configured. Add the key before the first deployment, or redeploy after adding it.

The provider adapter calls `https://api.openai.com/v1/responses` directly and disables response storage with `store: false`. The AI SDK is application code, not Gateway routing. Supabase remains the application's conversation and memory store. Existing quotas, confirmation controls and redacted error handling remain intact.

## Verify after deployment

1. Confirm the deployed commit matches GitHub main and inspect the build result.
2. Check `/dev` returns 404 and anonymous AI requests return 401.
3. Sign in at `/you`; save/reload a profile and goal.
4. Save/correct/forget a synthetic memory; confirm persistence after reload.
5. Send one synthetic model prompt; verify streamed text, saved history, stop and sign-out.
6. Check another test account cannot read the founder's history, memories or profile. Review logs for accidental content/credential exposure.

Begin founder daily evaluation only after those real-service checks. Voice, web search and app-store packaging remain later work.

## Official references checked

- [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel build settings](https://vercel.com/docs/builds/configure-a-build)
- [Direct OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai)
- [OpenAI model](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)
