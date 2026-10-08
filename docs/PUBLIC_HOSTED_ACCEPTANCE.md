# Public Aethelios — account acceptance phase

October 8, 2026. Extend PR #64's release preflight with an executable two-account Auth/PostgREST/Storage acceptance path. The feature candidate remains a preview until hosted, provider, device and release gates close.

## Research and plan

Official Supabase sources reviewed October 8:

- [Branching](https://supabase.com/docs/guides/deployment/branching) and [working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches): an isolated branch has its own service credentials and does not copy production data. Verify its migration/schema and service readiness rather than assuming a branch is an accepted deployment.
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys): publishable/legacy anonymous keys support user-session RLS; secret/service-role keys bypass that boundary and are rejected by this runner.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [private downloads](https://supabase.com/docs/guides/storage/serving/downloads): positive owner reads must accompany cross-account and anonymous denial checks. A successful filtered delete does not establish that a protected object was removed.

The immediate useful slice is executable acceptance, rather than more product surfaces. Existing real local tests remain intact. CI additionally exercises this runner against the disposable database and retains a JSON receipt. An isolated hosted branch, exact reviewed migration rehearsal and two verified disposable accounts are the next operational dependencies. Creating a paid branch requires its cost quote and confirmation; neither infrastructure nor model spend is purchased by this build.

## Implemented checks

`npm run release:accounts` tests six groups using ordinary authenticated SDK clients:

1. Auth identity and exact owner-person mapping for both accounts, before any synthetic writes.
2. Saved Mission context and changed-replay/cross-account rejection.
3. Completed synthetic reply promotion, idempotent deliverable creation and anonymous/cross-account denial.
4. Immutable version history, stale/direct/cross-account write rejection and exact review replay.
5. Idempotent Studio linkage and preservation of deliverable/project after Mission removal.
6. Private Studio Storage: upload/readback of one synthetic pixel, foreign/anonymous download and signing denial, forged owner-path upload rejection, foreign-delete survival and owner cleanup.

No model is called. Synthetic reply completion exercises persistence, not provider quality or the application's model request path. Account provisioning and migrations are intentionally external to the runner. It never resets, seeds a whole project, lists unrelated work, uses an admin key, buys infrastructure or promotes code.

Every request has a ten-second timeout and rejects redirects. Failure details omit backend messages, emails, passwords, tokens and document bodies. Cleanup uses only this run's source Mission/turn, conversation, linked project and generated Storage paths; it continues after a failed cleanup operation. Uncertain creation can be recovered through the exact source identity. Failed cleanup leaves an incomplete receipt with synthetic recovery identifiers for operator follow-up; it never claims successful acceptance. One synthetic `ai_usage` reservation may remain under the existing retention contract even after its conversation is deleted. Do not reuse a real member account or claim the run has zero database side effects.

## Local execution

After disposable local Supabase reset and the existing local `dev:setup`:

```sh
npm run test:release
npm run release:accounts -- --local
```

Local mode reads the existing ignored development configuration, accepts only `http://127.0.0.1:54321`, and uses the two seeded synthetic accounts. It cannot take a hosted URL. CI runs it after the existing integration test. JSON evidence is written to ignored `test-results/public-account-acceptance.json` and uploaded separately as `account-acceptance-evidence`. Local receipts are labeled `disposable-local`, never hosted acceptance.

## Hosted execution after provisioning

First verify that the target is an isolated branch of the PUBLIC project, not its main project or the private founder platform. Reconcile its inherited migration ledger and rehearse only the unchanged two additive migrations in the documented order. Inspect the fresh catalog/grants separately. Never blindly push all local historical migrations or alter Reserve history.

Create two disposable password accounts through approved operational provisioning, with distinct existing owner-person rows. No paid/founder entitlement is needed for these database contract checks. Independently verify their Auth UUIDs and person UUIDs. Prepare an ignored scratch manifest:

```json
{
  "contract": "public-hosted-acceptance-v1",
  "scope": "isolated-staging",
  "projectRef": "<verified 20-letter branch reference>",
  "candidateTree": "<git rev-parse HEAD^{tree}>",
  "expiresAt": "<UTC timestamp within the next 24 hours>",
  "syntheticWritesApproved": true,
  "branchIdentityVerified": true,
  "accounts": [
    { "authUserId": "<account A UUID>", "personId": "<owner A UUID>" },
    { "authUserId": "<account B UUID>", "personId": "<owner B UUID>" }
  ]
}
```

Supply `ACCEPTANCE_PUBLISHABLE_KEY`, `ACCEPTANCE_A_EMAIL`, `ACCEPTANCE_A_PASSWORD`, `ACCEPTANCE_B_EMAIL`, and `ACCEPTANCE_B_PASSWORD` through the operator's protected environment, never CLI arguments or Git. From the clean committed candidate checkout:

```sh
npm run release:accounts -- --staging /absolute/path/ignored-manifest.json
```

The manifest must match the exact committed Git tree; tracked source changes fail before requests. URL is derived from its verified project reference, with no arbitrary URL input. Both known public/private hosted main references are permanently denied. A new unknown project's isolation cannot be cryptographically proven by a local JSON manifest: independent branch verification is mandatory. This tool is an operator acceptance aid, not a production authorization mechanism or signed attestation.

A failed check, network error, incomplete cleanup or invalid manifest exits nonzero. Expected SQL/Storage denial codes are checked so transport/server failures cannot masquerade as access control success. Successful output always carries `releaseApproved: false` and explicitly excludes catalog/ledger validation, application/browser exports, live models, physical devices and billing. Record those remaining receipts and an explicit release decision before production promotion. Restore prior application/server code on rollback; retain additive schema and saved records.

## Validation

Eleven standalone release checks pass locally, including protected targets, candidate/identity mismatch, time bounds, secret-key rejection, no writes after identity failure and cleanup continuation after a failure. ESLint and the unchanged migration hashes are also checked. Actual local Supabase behavior is verified by the new CI step; hosted execution remains pending isolated branch provisioning. The PR contains the authoritative final exact-head CI result.
