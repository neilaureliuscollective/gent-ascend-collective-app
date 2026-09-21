# Fresh Vercel setup

Prepared 2026-09-21. The source builds; actual hosted Supabase and model acceptance remain open. Import the existing official repository, not a replacement. No deployment or remote database change was performed during preparation.

## GitHub first

Official repo: https://github.com/neilaureliuscollective/aurelius-collective-app

Founder changed the canonical GitHub account/repository on 2026-09-21. The existing checkout's origin now points here; all source and commit history are retained. The workstation folder remains ~/Desktop/aurelius-og. Reconnect the GitHub integration as neilaureliuscollective and authorize this repository before retrying the initial push. The previous push failure below occurred against the old destination; the new repository also currently reports no write access for this session.

The attempted `git push -u origin main` failed because this execution environment has no authenticated Git write credentials. The GitHub connector independently reports `pull: true, push: false`; the remote is still empty. Grant this integration write access to the official repository, or integrate the supplied Git bundle into the existing workstation checkout and push from an authenticated terminal. Do not paste a token into chat, overwrite local work, or force-push.

## Vercel import settings

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root directory | Repository root |
| Production branch | main |
| Node.js | 24.x (also constrained by package.json) |
| Install command | npm ci |
| Build command | npm run build |
| Output directory | Framework default; do not set a static export directory |

`vercel.json` records the framework/install/build settings. GitHub Actions runs the broader quality gates. A successful Vercel build alone does not replace Auth, database or live-model verification. Enable deployment protection for the private founder site using the controls available on the Vercel plan; keep application sign-in and RLS as well.

## Required before the first main-branch build

Vercel calls the main-branch environment **Production** even while this product is in private testing. Set these in its Production environment scope:

| Variable | Value |
| --- | --- |
| APP_ENV | production |
| AURELIUS_DEV_HARNESS | false |
| NEXT_PUBLIC_SUPABASE_URL | URL of the dedicated hosted Supabase project |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable key from that same project |

The production configuration deliberately requires the Supabase pair. Add them before pressing Deploy. Do not copy `.env.example` wholesale: its `APP_ENV=local` is for local use. Do not set `NODE_ENV` manually. Never upload local developer tokens, founder seed passwords or a service-role key to Vercel.

Preview branches use `APP_ENV=preview` and a separate staging Supabase project. A preview without either Supabase variable renders only the shell; a partial pair is invalid. Never attach disposable previews to real customer data. Redeploy after changing environment variables.

## Hosted database and founder account

Use a fresh dedicated Supabase project for private testing. Apply the three migrations before creating the founder Auth user. On an authenticated operator workstation, verify the project ref and run:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Review that only the intended three migrations are pending, then:
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

## Connect the brain

Current adapter: **OpenAI models through Vercel AI Gateway**. Add a server-only `AI_GATEWAY_API_KEY` with Gateway credits and a budget. `AURELIUS_AI_MODEL` optionally overrides the current default `openai/gpt-6-astra`; verify model access in your account before live testing. No model credential is needed for the initial build or saved workspace reads.

An `OPENAI_API_KEY` environment variable alone is not consumed by this implementation. To use an existing OpenAI key without changing the adapter, connect it in AI Gateway's BYOK settings and still supply the Gateway key to the app. BYOK currently requires purchased Gateway credits; failures may fall back to Gateway-funded credentials, and Gateway budgets do not cap BYOK spend. Review provider-side controls separately. The existing no-training Gateway option does not override your BYOK provider contract. Direct OpenAI routing would be a small, explicit adapter change, not an environment-variable rename.

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
- [Gateway BYOK](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok)
- [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)
