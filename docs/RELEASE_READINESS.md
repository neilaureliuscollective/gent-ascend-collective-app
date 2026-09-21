# Fresh GitHub / Vercel release readiness

Reviewed 2026-09-21 against official GitHub remote-management and Vercel Next.js / Node runtime / Git integration documentation. Canonical target: https://github.com/neilaureliuscollective/aurelius-collective-app.git.

## What is ready

- Complete official application restored at `/root/Desktop/aurelius-og` from the verified `cf141f8` Git bundle. No application files or original commits changed during restoration.
- Existing `vercel.json` selects Next.js, `npm ci`, and `npm run build`. Node 24 is constrained by package.json and supported by Vercel. Framework default output, repository-root import, production branch main.
- CI has application and actual local-Supabase jobs. No automatic production-deployment workflow is added.
- The 163 tracked application files exclude actual environment files, dependencies, local build output and private keys. A targeted scan found no GitHub token, OpenAI-key or AWS-key patterns; this is a bounded scan, not a security certification.
- Current deployment/environment validation remains fail-closed: production needs both Supabase values; hosted developer harness is forbidden.

## Current blockers

1. **Git transport authentication:** connected GitHub account is the correct owner and has admin/write permission. The terminal dry-run push failed for missing credentials. The remote remains empty. See VERCEL_SETUP.md for authentication and exact-history publication steps.
2. **Hosted configuration:** the fresh Vercel project needs APP_ENV=production, AURELIUS_DEV_HARNESS=false, and the dedicated Supabase URL/publishable-key pair. Those real values have not been supplied or provisioned here.
3. **Service activation:** apply the four existing migrations to the intended hosted Supabase project; create the real founder Auth account and server-owned beta grant. Do not upload local seed users or harness credentials. The optional AI_GATEWAY_API_KEY connects the existing model adapter; OPENAI_API_KEY alone is not consumed.

## Verification

Release validation uses Node 24 and a clean `npm ci`, followed by `npm run check` with Production/Vercel flags and clearly synthetic Supabase build values. It does not claim a real database or model connection. Exact results are recorded in STATUS.md. The prior Orb milestone passed 46 browser tests; those results remain historical unless explicitly rerun. Physical-device graphics acceptance also remains open.

No production deployment, hosted database mutation, secret change or repository-history rewrite is performed. The fresh Vercel project can be imported after the authenticated main push and environment setup.

## Official sources

- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://vercel.com/docs/git/vercel-for-github
- https://docs.github.com/en/get-started/git-basics/managing-remote-repositories
