# Founding Members pilot V1 — 2026-09-25

## Decision

Ship a private cohort for Blair and 3–5 Katie clients while founder phone testing and Shopify product loading continue. The first useful loop is verified access → personal priority and baseline → one goal → daily Command → optional Aethelios → voluntary feedback. Shopify remains the commerce system; this release adds no second checkout or public enrollment. Aethelios suggestions remain subject to explicit confirmation.

## Operating sequence

1. Apply the additive `20260925210204_founding_members_pilot.sql` migration before deploying this app. Do not run the local synthetic seed on hosted Supabase.
2. In Supabase Auth email templates, set the **Invite user** link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. Set Site URL to the canonical app origin. This is required for cookie-based SSR arrival. Test this link using a test address before inviting a client.
3. Founder opens `/founder/pilot`, reserves the exact email address, then sends the Auth invitation in Supabase Dashboard → Authentication → Users → Add user → Send invitation. The reserve button does **not** send email. If that person already has a confirmed account, have them sign in with that same verified email instead of sending a second Auth invite.
4. The invitee accepts the email link, lands at `/welcome`, confirms pilot access and sets a password for future sign-ins. The server checks the confirmed Auth email against the founder reservation before setting only that person's beta access.
5. Ask each member to complete a first daily session and submit one friction/idea/working note on `/welcome`. Founder sees the voluntarily submitted notes at `/founder/pilot`; private goals, daily entries and chat stay out of this view.

No addresses or invitations were created by this release. There is no self-service signup or general access queue. An operator can correct a mistaken pending reservation directly in the trusted Supabase Dashboard until a founder-only revocation UI is built. Avoid placing medical information in pilot feedback.

## Why this slice

The app already has a real person, owner RLS, a founder grant, a beta capability and working daily/goal/AI paths. An email allowlist plus Auth's verified identity uses those boundaries without deploying a service-role key in the consumer app. Sending invitations is an explicit trusted Dashboard step for this tiny cohort. The member never supplies a person ID to claim. The founder sees only invitation status and voluntary feedback; no read across private LifeOS records.

The next build decision should come from specific failures in these first sessions: fix blocked arrival or first-day use immediately, then rank repeated friction against conversion intent. Build an integrated Shopify Storefront entry only when a real product path needs app discovery or member attribution; retain Shopify checkout. A broad affiliate system requires an offer, attribution rules and actual partners, so it follows a tested product path.

## Acceptance and limits

- PGlite migration/security checks cover unapproved, unverified, wrong-email, idempotent and direct-write attacks. They are SQL fixtures, not a live Auth claim.
- `npm run check` and `npm run db:ledger` pass. Local real Auth integration requires Docker/Podman, unavailable in this execution environment. The invitation email/template, cookie exchange and physical phone keyboard remain to be tested with a real invited test account before the cohort.
- The current pilot does not automatically send invites, revoke claimed access, or aggregate behavioral telemetry. Feedback is explicitly submitted; founder listing retains the latest 50 notes.

## Primary references checked

- [Supabase Auth email templates and SSR token hash](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Next.js server-side Auth flow](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Supabase securing database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
