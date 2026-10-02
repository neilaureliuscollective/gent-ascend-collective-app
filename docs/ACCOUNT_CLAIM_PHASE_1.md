# Free account claim — Phase 1

Approved by founder October 2, 2026. Extends the existing entrance and World; no film, brand, membership economy or commerce replacement.

## Delivered journey

Enter the cinematic world → Find my next move → focus + next move → visibly selected destination → Save my direction → Google or email code → atomic import → same World with saved personal priority → existing genuine training/grooming/daily action.

Create free account is also optional from World without the direction exercise. Existing passwords/invitations and membership registration keep their independent routes. Claim returns are fixed, not arbitrary `next` URLs. No free Aethelios entitlement, paid/beta/founder grant, preorder entitlement or marketing consent is created by signup.

## Ownership and persistence

Versioned device draft expires after 24 hours. Only explicit Set my direction writes it; typing alone is not saved. Draft contains ID, focus, intention (160 chars), timestamp and timezone. Discard is available. Storage failure retains this tab's draft and blocks Google redirect when it would lose that draft; email verification remains in the same tab. Cross-device recovery is not supported.

`onboarding_claim` derives person from auth.uid(), serializes under the person lock, composes existing daily_save, and inserts an owner-only receipt in the same transaction. No normal-user service key. Existing day fields/actions are retained. Existing different intention requires explicit version-matched replacement. Date rollover requires reconfirmation. Duplicate identical requests return the existing receipt; changed duplicate payloads fail. Receipt is cleared locally only after a confirmed save. Latest receipt focus restores the returning user's environment. Empty claim marks account arrival complete without inventing a daily entry or activity.

## Release setup (not performed by this build)

1. Apply additive `20261002165518_account_claim.sql` to the approved Supabase environment before enabling the feature.
2. Configure `ACCOUNT_APP_ORIGIN` as the exact HTTPS app origin. Free signup is separate from BILLING_APP_ORIGIN and MEMBERSHIP_* settings.
3. Configure Google OAuth provider, consent branding and callback. Allow the application's `/auth/confirm?entry=claim` return. Enable ACCOUNT_GOOGLE_READY only after actual round-trip verification.
4. Configure production SMTP and the existing Turnstile key/secret. The Magic link email template must include `{{ .Token }}` so the in-app code entry works. Keep invite/confirmation templates intact. Validate email code length and expiry against hosted Auth settings.
5. Enable ACCOUNT_SIGNUP_ENABLED and ACCOUNT_AUTH_READY only after new + existing user verification. The default is closed. Existing users may still import their draft through their valid session.
6. Exercise signup and sign-in on folded/unfolded Samsung, Samsung Internet/Chrome, iPhone Safari and installed PWA. Verify cancellation, wrong/expired code, resend, provider failure, refresh, midnight rollover and two-user isolation with real Auth.
7. Confirm the account gives exactly existing free capabilities; no billed signup or AI-context grant. Production promotion remains a separate founder approval/release gate.

## Lightweight measurement

`/api/account/events` accepts only an allowlisted, bounded event schema with random journey/event IDs, coarse viewport class, elapsed time and optional method. Same-origin JSON required. Structured server logs are the initial sink; no analytics dependency or private personal_events pollution. No email, intention, token, IP or account ID is included in the application payload. Infrastructure may separately retain its ordinary request logs.

Events: cinematic_completed (actual video end only), preview_engaged (world selection), direction_created, claim_exposed, claim_clicked, auth_started, auth_completed, draft_imported, onboarding_completed, first_meaningful_action (confirmed workout sync, grooming practice or a saved daily action/completion). Client events are observations, not trusted billing/activation evidence. Deduplication is per loaded page; log aggregation must distinguish repeated exposures and multiple sessions. Durable funnel reporting and cross-device attribution remain later work.

## Verification and limits

Unit/route tests cover configuration, CAPTCHA, fixed returns, hostile origins, invalid/expired drafts and telemetry redaction. PGlite exercises atomic import, duplicate requests, conflict/date checks, RLS and forbidden direct/anonymous writes. This is SQL emulation, not live Supabase Auth/PostgREST.

Playwright uses explicit API fixtures for the signup/import UI at 360/768/1440 and failure/conflict recovery. Existing cinematic and personal-priority tests remain separate regression checks. Hosted Google, production email, real Supabase migration/reset, provider configuration and physical-device behavior are not verified in this runtime (Docker unavailable; hosted setup not modified).
