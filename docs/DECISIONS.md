# Decisions and research evidence

Checked 2026-09-20. Published npm latest metadata corroborated framework versions; lockfile is authoritative for actual install.

| Decision                                  | Rationale / tradeoff                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next 16.3.5, React 19.3, Node 24, ESM     | Stable published releases; Node satisfies Next >=20.9, Supabase >=22 and AI SDK >=22                                                                                                                                     |
| TypeScript 6.0.3 + ESLint 9.39.5, strict  | Latest compatible stable lines: Next bundled plugins reject TypeScript 7 (<6.1 peer) and ESLint 10. ESLint 9 has an upstream deprecation notice; reassess Next lint tooling before beta. Do not force unsupported peers. |
| SQL migrations + typed Supabase SDK       | One schema authority; fewer dependencies than simultaneous ORM migrations                                                                                                                                                |
| Local real Auth founder entry             | Exercises RLS and ownership; requires Docker-backed local Supabase                                                                                                                                                       |
| Harness local only                        | Strong isolation; hosted founder testing uses real beta grants instead                                                                                                                                                   |
| Tier != role != clinical grant            | Prevents paid/simulated access becoming clinical/admin authorization                                                                                                                                                     |
| AI SDK deferred                           | Package 7.0.107 bundled docs verified Node 22+, ESM and separate workflow adapter; no AI runtime needed in Stage 1                                                                                                       |
| Four navigation anchors + global Aurelius | Scalable starting hypothesis; revise with observed use                                                                                                                                                                   |
| No service worker private cache           | PWA foundation without persisting sensitive responses offline                                                                                                                                                            |
| No deployment in Stage 1                  | Founder approval required for production; preview unnecessary until gates pass                                                                                                                                           |

## Official sources

- [Next installation](https://nextjs.org/docs/app/getting-started/installation): 16.3.5, Node minimum, standalone lint required in Next 16.
- [React versions](https://react.dev/versions).
- [Tailwind Next setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs): cookie clients, verified claims, proxy refresh; never authorize from getSession alone.
- [Supabase local environments](https://supabase.com/docs/guides/deployment/managing-environments), [seeds](https://supabase.com/docs/guides/local-development/seeding-your-database): migrations + repeatable local resets.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): explicit role grants and owner policies.
- [Supabase HIPAA](https://supabase.com/docs/guides/security/hipaa-compliance), [HIPAA project](https://supabase.com/docs/guides/platform/hipaa-projects): BAA, add-on, High Compliance and shared responsibility.
- [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks), [webhooks](https://docs.stripe.com/webhooks): verify signature, process async lifecycle, handle ordering/retries and duplicate events.
- [AI package metadata](https://registry.npmjs.org/ai/latest): 7.0.107 and Node >=22. Bundled v7 migration and agent references also inspected; runtimeContext and WorkflowAgent verified, detailed integration deferred.

## Repository inspection

Official public remote was empty (no refs/commits); no local application files or history to preserve in this session's checkout. Founder computer's Desktop is not mounted and unpushed workstation files cannot be inspected. Remote checked out at /root/Desktop/aurelius-og, origin unchanged. GitHub connector reported pull=true, push=false. Do not claim that local commits have reached GitHub.

## Stage 2A decisions — 2026-09-20

- Build the first useful personal action: edit profile, choose a goal/next step, see it on Command, then complete/archive. Reuse the existing modular monolith, real session and RLS boundary.
- One active goal is an explicit, reversible first-slice limit. It keeps Command focused and the first founder journey small enough to validate. Multiple concurrent goals and progress percentages are deferred.
- Basic profile and goals are free capabilities; payment and onboarding cannot gate them. This is not a final pricing promise.
- Use optimistic versions to reject stale edits. Controlled React fields retain drafts after failed actions; conflicts require reloading instead of silently overwriting.
- Narrow database triggers maintain version/time and goal events in the same transaction. No workflow engine or second event database.
- Vite 8.3.0, already in Vitest's dependency graph, is now an explicit development dependency solely for isolated real-component browser tests. Fixtures are outside Next routes, marked synthetic, served only on loopback and contain no real credentials. They do not substitute for the separate real Auth/Next/Supabase founder journey.
- Keep Stage 1 and Stage 2A signoff open until actual Supabase reset/Auth/PostgREST and founder browser tests pass. Docker remains unavailable here; GitHub access remains read-only.

Official references rechecked: [Next forms](https://nextjs.org/docs/app/guides/forms), [React useActionState](https://react.dev/reference/react/useActionState), [Supabase database functions](https://supabase.com/docs/guides/database/functions). No new production integration was introduced.
