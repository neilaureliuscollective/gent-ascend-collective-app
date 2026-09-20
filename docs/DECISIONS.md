# Decisions and research evidence

Checked 2026-09-20. Published npm latest metadata corroborated framework versions; lockfile is authoritative for actual install.

| Decision | Rationale / tradeoff |
| --- | --- |
| Next 16.3.5, React 19.3, Node 24, ESM | Stable published releases; Node satisfies Next >=20.9, Supabase >=22 and AI SDK >=22 |
| TypeScript current stable, strict | Catch ownership/config errors early; validate actual tool compatibility |
| SQL migrations + typed Supabase SDK | One schema authority; fewer dependencies than simultaneous ORM migrations |
| Local real Auth founder entry | Exercises RLS and ownership; requires Docker-backed local Supabase |
| Harness local only | Strong isolation; hosted founder testing uses real beta grants instead |
| Tier != role != clinical grant | Prevents paid/simulated access becoming clinical/admin authorization |
| AI SDK deferred | Package 7 exists; detailed APIs need bundled-doc verification at Stage 3 |
| Four navigation anchors + global Aurelius | Scalable starting hypothesis; revise with observed use |
| No service worker private cache | PWA foundation without persisting sensitive responses offline |
| No deployment in Stage 1 | Founder approval required for production; preview unnecessary until gates pass |

## Official sources

- [Next installation](https://nextjs.org/docs/app/getting-started/installation): 16.3.5, Node minimum, standalone lint required in Next 16.
- [React versions](https://react.dev/versions).
- [Tailwind Next setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs): cookie clients, verified claims, proxy refresh; never authorize from getSession alone.
- [Supabase local environments](https://supabase.com/docs/guides/deployment/managing-environments), [seeds](https://supabase.com/docs/guides/local-development/seeding-your-database): migrations + repeatable local resets.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): explicit role grants and owner policies.
- [Supabase HIPAA](https://supabase.com/docs/guides/security/hipaa-compliance), [HIPAA project](https://supabase.com/docs/guides/platform/hipaa-projects): BAA, add-on, High Compliance and shared responsibility.
- [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks), [webhooks](https://docs.stripe.com/webhooks): verify signature, process async lifecycle, handle ordering/retries and duplicate events.
- [AI package metadata](https://registry.npmjs.org/ai/latest): 7.0.107 and Node >=22. Detailed API verification deferred, not assumed.

## Repository inspection

Official public remote was empty (no refs/commits); no local application files or history to preserve in this session's checkout. Founder computer's Desktop is not mounted and unpushed workstation files cannot be inspected. Remote checked out at /root/Desktop/aurelius-og, origin unchanged. GitHub connector reported pull=true, push=false. Do not claim that local commits have reached GitHub.
