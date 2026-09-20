# Security and privacy

Stage 1 accepts synthetic data only. No production customer data or PHI ingestion. This is a product-scope limit, not a declaration that all consumer health data is exempt from privacy obligations.

| Class              | Examples                                                   | Handling                                                                 |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Public             | approved marketing, product catalog                        | cacheable if deliberately public                                         |
| Private            | profile, goals, personal timeline                          | verified identity, owner RLS, no shared cache                            |
| Sensitive personal | health observations, mental wellbeing, scans, family vault | explicit purpose/consent, private files, minimized logging and retention |
| Regulated clinical | provider records, treatment decisions                      | clinical gateway; partner/legal readiness required                       |
| Operational secret | credentials, webhook secrets, harness token                | server-only, ignored env, never response or log                          |

Avoid raw chat/health content in analytics and error traces. Log operational IDs and sanitized failures. Secrets never use NEXT_PUBLIC except the intended Supabase URL/publishable key. Access tokens and service keys never go into Git.

RLS is supplemented by narrow grants and server authorization. Test at least two independent users plus anon. Do not trust auth user_metadata for tier/role. No service-role key in the app runtime in Stage 1. Local bootstrap uses a local admin API credential in the CLI only.

Before PHI: determine legal roles and data flows with qualified counsel/partners; sign required BAAs across the processing chain; use Supabase HIPAA add-on and High Compliance configuration; meet documented PITR, SSL, network and connection logging requirements; verify hosting/AI/telemetry contracts and minimum necessary data. A paid Supabase account alone is insufficient. [Supabase HIPAA](https://supabase.com/docs/guides/security/hipaa-compliance), [project configuration](https://supabase.com/docs/guides/platform/hipaa-projects), checked 2026-09-20.

Before beta: privacy notice/consent, user export/deletion, retention policy, recovery/backup drill, account abuse controls, protected staging, secret scanning and incident ownership. Do not put private data into a service worker cache; Stage 1 provides a manifest, no offline private-data persistence.

Threat focus: cross-user disclosure, client privilege escalation, exposed local harness, billing replay, AI tool injection, oversharing provider briefs. Use human review/confirmation for external actions and scoped tools. Clinical eligibility is not purchasable authorization.
