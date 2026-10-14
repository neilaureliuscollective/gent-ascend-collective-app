# Aethelios Connections — GitHub and Vercel

Date: 2026-10-14. Commissioning on `cursor/aethelios-connections-setup-d35e` from main `273ee6d`. Implementation already merged via PR #117. This follow-up corrects setup docs, reports hosted-ledger status, and adds a founder-only View setup action. No production merge, hosted migration, billing or autonomous provider registration.

## What this is

Founder Office previously showed fixed strings for GitHub and Vercel. Public GitHub inspection of the canonical repository remains a separate, unauthenticated observation. This work adds a real, founder-gated Connections surface:

- Entry: `/app/founder/connections`, Founder Office navigation, and the verified founder account page.
- GitHub App installation + later user association (not generic OAuth-as-app).
- Vercel **connectable-account / OAuth integration** with selected-project read access. This is not a native Marketplace product.
- Verified states: setup required, disconnected, connecting, connected, degraded, expired, revoked, verification failed.
- Founder-only **View setup** shows setting *names* and four separate statuses: configuration ready, webhook ready, account authorization completed, selected resource verified. It never prints secret values.
- Connecting a repository does not start Architect, a runner, or any AI operation.

## Current founder step

1. Open the `neilaureliuscollective` GitHub Apps list and say whether an Aethelios or Gent Ascend app already exists. Do not create an app until that list is confirmed.

## Official research (2026-10-13)

GitHub:

- Setup URL is distinct from the user-authorization callback URL. GitHub warns that `installation_id` on the setup URL must not be trusted; associate it by generating a user access token and checking `GET /user/installations`. Sources: [About the setup URL](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url), [Generating a user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
- This implementation therefore does **not** enable “Request user authorization (OAuth) during installation” as the primary path, because GitHub then redirects to `login/oauth/authorize` without a caller-controlled `redirect_uri`/`state`. Instead: install with `state` → setup URL claims the installation on the server-side flow → PKCE user authorization → verify association → mint repository-scoped installation tokens.
- Installation tokens: `POST /app/installations/{id}/access_tokens` with `repository_ids` and read-only `permissions`. They expire in one hour and are minted server-side, never stored. [Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).
- User tokens (association only) support PKCE `S256` and optional `offline_access`. Default user-token expiry is 8 hours with a 6-month refresh token when expiration is enabled.

Vercel (official docs re-checked 2026-10-14):

- The implementation is a **connectable-account / REST OAuth integration**, not a native Marketplace product. Native onboarding requires a product, Base URL, billing plans and Vercel partnership. Do not create that offering. Sources: [Create an Integration](https://vercel.com/docs/integrations/create-integration), [Building Integrations with the Vercel REST API](https://vercel.com/docs/integrations/create-integration/vercel-api-integrations).
- Connectable-account integrations exchange a 30-minute `code` once at `POST https://api.vercel.com/v2/oauth/access_token` for a **long-lived** access token plus `installation_id`, `user_id`, `team_id`. This is not GitHub’s one-hour installation-token model.
- PKCE is required for Sign in with Vercel (`https://vercel.com/oauth/authorize`, one-hour access / 30-day rotating refresh). That IdP flow is identity, not selected-project installation. Connections uses `https://vercel.com/integrations/{slug}/new`.
- Official integration webhooks are HMAC-SHA1 of the raw body, compared to `x-vercel-signature`, using the **Integration Secret (client secret)**. Do not invent a separate `VERCEL_INTEGRATION_WEBHOOK_SECRET`. Source: [Webhooks API](https://vercel.com/docs/webhooks/webhooks-api).
- Read scopes requested in the Integration Console: Project (read), Deployment (read), User (read), Integration configuration (read). Not requested: project-env-vars, domain, billing, deployment write.
- Disconnect deletes Aethelios credentials. Removing the Vercel installation itself requires the founder to uninstall it in Vercel (configuration delete is a write).

## Credential boundary

- Metadata: `service_connections` (owner SELECT).
- Credentials: `service_connection_secrets` ciphertext. No authenticated table grant. Server decrypts with `CONNECTIONS_CREDENTIAL_KEY` only.
- Flows: nonce/state/PKCE verifier, 10-minute expiry, single consume.
- GitHub App private key and Vercel client secret stay in server env. They are never sent to the browser, URLs, logs, model context, generated code, or preview sandboxes.
- Architect Construct (PR #116) must import `src/domains/connections/architect.ts` only. The trusted credential/publishing component remains outside any code-execution sandbox and outside generated preview deployments. See [CONNECTIONS_ARCHITECT.md](CONNECTIONS_ARCHITECT.md).
- Verification-authoritative writes (`service_connection_upsert`, secrets, installation claim, webhook status) execute only as the service-role broker after a founder session check. Authenticated founders may read, start/consume flows, disconnect, and store selection intent. Selection intent clears `last_verified_at` and cannot mark a connection connected.
- Broker identity is official `auth.role()` (`request.jwt.claims` JSON, with the legacy `request.jwt.claim.role` scalar as fallback). Current PostgREST does not set the scalar. Missing or non-`service_role` claims fail closed. `current_user` inside SECURITY DEFINER is not the authenticated caller.
- `github_app_authorization.revoked` identifies the user through `sender` and does not include `installation`. That event expires the association and deletes user credentials; it does not claim the GitHub App installation was removed. Installation deletion remains a separate `installation.deleted` event. Re-verify cannot restore Connected without a new user authorization.

## Minimal founder setup (not performed in this task)

Do not paste secret values into chat. Register the applications yourself, then set names only in the intended local or protected preview environment.

### GitHub App

Inspect the owning organization Apps list first. Do not create a second app if an appropriate Aethelios/Gent Ascend app already exists.

The implemented sequence is: install with `state` → Setup URL claims `installation_id` → PKCE user authorization at the Callback URL. Leave **Request user authorization (OAuth) during installation** unchecked. Enabling it removes the Setup URL and conflicts with this flow.

1. Organization `neilaureliuscollective` → Settings → Developer settings → GitHub Apps.
2. Callback URL: `https://www.gentascend.com/api/connections/github/callback`
3. Setup URL: `https://www.gentascend.com/api/connections/github/setup` with Redirect on update enabled.
4. Webhook URL: `https://www.gentascend.com/api/connections/webhooks/github`
5. Keep Expire user authorization tokens selected. Do not enable Device Flow.
6. Repository permissions (read-only): Contents, Metadata, Pull requests, Checks, Commit statuses.
7. Subscribe to: `installation`, `installation_repositories`, `github_app_authorization`.
8. Where can this app be installed: Only on this account. Selected repositories only.
9. Do **not** request administration, secrets, workflows, or contents write.
10. Generate a client secret and a private key. Store:

```
CONNECTIONS_CREDENTIAL_KEY   # 64 hex chars, independent AES key
NEXT_PUBLIC_APP_URL
GITHUB_APP_ID
GITHUB_APP_SLUG
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_WEBHOOK_SECRET
```

### Vercel connectable-account integration

Do this only after GitHub App registration. Do **not** create a native Marketplace product, Sign in with Vercel, or a personal token.

1. Vercel dashboard → team that owns `gent-ascend-collective-app` → Integrations → Integrations Console → Create.
2. Choose the connectable-account / OAuth integration type. Skip Create Product.
3. Redirect URL: `{NEXT_PUBLIC_APP_URL}/api/connections/vercel/callback`
4. Webhook URL: `{NEXT_PUBLIC_APP_URL}/api/connections/webhooks/vercel`
5. Scopes, read-only: `project`, `deployment`, `user`, `integration-configuration`.
6. Do **not** enable domain, billing, environment-variable or deployment-write.
7. Store the Integration slug, client ID and client secret. Vercel signs webhooks with that same client secret.

```
VERCEL_INTEGRATION_SLUG
VERCEL_INTEGRATION_CLIENT_ID
VERCEL_INTEGRATION_CLIENT_SECRET
```

`VERCEL_INTEGRATION_WEBHOOK_SECRET` is unused. Official signing uses `VERCEL_INTEGRATION_CLIENT_SECRET`.

If any core names above (or the GitHub core names) are absent, Connections shows **Setup required** and Connect stays disabled. That is not a successful connection. Webhook readiness is reported separately and does not enable Connect.

## Production activation audit (2026-10-14, names only)

Inspected against implementation and official GitHub/Vercel docs. Presence of secret *values* was not printed. A READY Vercel preview is not a connected GitHub/Vercel account. This workspace cannot read the hosted Supabase ledger or the Vercel Environment UI; founder-verified facts below are recorded rather than re-probed.

| Prerequisite | Production (`https://www.gentascend.com`) | Notes |
|---|---|---|
| `20261013183000_service_connections.sql` | applied | Founder-verified on canonical Supabase `volpzkfsnmtztrovexcw`. Do not rerun. |
| `20261013194500_connection_trusted_writes.sql` | applied | Founder-verified on the same project. Do not rerun. |
| `20261013203000_connection_broker_role.sql` | applied | Founder-verified on the same project. Do not rerun or apply other hosted migrations. |
| `NEXT_PUBLIC_APP_URL` | missing | Metadata-only Vercel listing at 2026-10-14 ~19:11 UTC showed none of the Connections names. Must be exactly `https://www.gentascend.com`. |
| `CONNECTIONS_CREDENTIAL_KEY` | missing | Independent 64-hex AES key. Do not reuse another secret. Do not rotate an existing key without a compatibility plan. |
| GitHub App registration | not found here | Public slugs `aethelios`, `aethelios-connections`, `gent-ascend`, `gent-ascend-collective`, `aethelios-github`, `gentascend` returned 404. Inspect the org Apps list before creating a duplicate. |
| GitHub App installation on the selected repository | missing | Read-only Contents, Metadata, Pull requests, Checks, Commit statuses. |
| Vercel connectable-account integration | missing | Not a native Marketplace product. Read project, deployment, user, integration-configuration. |
| Server-only GitHub/Vercel env names | missing | Canonical Vercel project `gent-ascend-collective-app` had none of the Connections entries in the 2026-10-14 metadata-only listing. |
| Hosted webhook delivery | missing | Requires registration plus the URLs below. |

Production callback and webhook URLs derived from the code when `NEXT_PUBLIC_APP_URL=https://www.gentascend.com`:

- `https://www.gentascend.com/api/connections/github/callback`
- `https://www.gentascend.com/api/connections/github/setup`
- `https://www.gentascend.com/api/connections/webhooks/github`
- `https://www.gentascend.com/api/connections/vercel/callback`
- `https://www.gentascend.com/api/connections/webhooks/vercel`

## Live tests still blocked on founder authorization

The three Connections migrations are already applied. Do not rerun them.

- Inspecting and, only if absent, registering the GitHub App in the owning organization.
- Registering the Vercel connectable-account integration (not a native product).
- Installing them on the canonical repository/project.
- Securely entering server secrets in the canonical Vercel project, then approving the production deployment that loads them.
- Real webhook delivery and provider revocation.
- Live GitHub/Vercel login after registration. The founder completes consent. An enabled Connect button is not proof of a linked account.

`scripts/connections-auth-smoke.mjs` is included in `npm run test:integration`. It reads the disposable service-role key from `npx supabase status -o json` for the same loopback instance as `.env.development.local`. It does not read that key from the env file. A generic Origin Auth job does not cover these RPCs.
