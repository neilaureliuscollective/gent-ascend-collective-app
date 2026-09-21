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

## Aurelius 1A processing boundary

Sending a message transmits recent conversation and the user's optionally enabled profile/goal/confirmed-memory context to the configured Gateway/provider. The composer discloses this before send. No credentials, ownership identifiers from context records, raw health integrations or unrelated conversations are included. Gateway no-training filtering is enabled, but retention, logging, BYOK and provider agreements still require review before personal/sensitive beta operation. This is not a HIPAA assertion.

Requests are same-origin JSON with a 32 KiB body bound, validated input, verified Auth, server capabilities and atomic per-person limits. Markdown has no raw HTML or automatic remote image loading. Provider errors are redacted before SDK logging. No raw chat/AI trace telemetry is enabled.

Deletion removes application conversation content or explicit memory independently. Database backups/provider retention and requests already sent are separate systems; do not imply immediate global erasure. Usage metadata is retained to enforce quotas; define its scheduled retention and account export/closure behavior before beta. Current AI tables/RPCs are owner-controlled working records, not reliable evidence for regulated decisions or invoicing.

## Aurelius 1D daily boundary

Intention/actions are private planning data. Sleep/energy and free-text reflections may be sensitive personal wellness data; use synthetic records until the existing beta privacy gates are met. No medical/clinical ingestion is added. Daily text is not sent to the model, promoted to memory, logged or saved to localStorage. Conversation starter URLs contain only an allowlisted generic key; resume URLs contain a validated UUID and still require owner authorization.

The daily API uses same-origin JSON, an 8 KiB streaming body bound, server validation, verified session/capabilities and private no-store responses. RLS protects owner reads; explicit grants deny anon and direct table writes. A narrow fixed-search-path definer RPC derives owner itself and atomically validates date/version/action bounds. No service-role app client. An ambiguous save keeps the draft and requires reloading before retry, rather than claiming success or overwriting.

Public sample mode is not a privileged account: explicitly fictional, in-memory, discarded on exit/reload, no database calls for mutations. The fixture's Next Link adapter exists only under tests; production navigation is separately exercised against the built app. No hosted harness or new auth bypass.
