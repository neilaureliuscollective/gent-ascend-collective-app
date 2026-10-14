# Aethelios Connections — GitHub and Vercel

Date: 2026-10-13. Branch `cursor/aethelios-connections-8d20`. No production merge, hosted migration, billing or live provider registration in this task.

## What this is

Founder Office previously showed fixed strings for GitHub and Vercel. Public GitHub inspection of the canonical repository remains a separate, unauthenticated observation. This work adds a real, founder-gated Connections surface:

- Entry: `/app/founder/connections`, Founder Office navigation, and the verified founder account page.
- GitHub App installation + user association (not generic OAuth-as-app).
- Vercel native integration OAuth with selected-project read access.
- Verified states: setup required, disconnected, connecting, connected, degraded, expired, revoked, verification failed.
- Connecting a repository does not start Architect, a runner, or any AI operation.

## Official research (2026-10-13)

GitHub:

- Setup URL is distinct from the user-authorization callback URL. GitHub warns that `installation_id` on the setup URL must not be trusted; associate it by generating a user access token and checking `GET /user/installations`. Sources: [About the setup URL](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url), [Generating a user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
- This implementation therefore does **not** enable “Request user authorization (OAuth) during installation” as the primary path, because GitHub then redirects to `login/oauth/authorize` without a caller-controlled `redirect_uri`/`state`. Instead: install with `state` → setup URL claims the installation on the server-side flow → PKCE user authorization → verify association → mint repository-scoped installation tokens.
- Installation tokens: `POST /app/installations/{id}/access_tokens` with `repository_ids` and read-only `permissions`. They expire in one hour and are minted server-side, never stored. [Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).
- User tokens (association only) support PKCE `S256` and optional `offline_access`. Default user-token expiry is 8 hours with a 6-month refresh token when expiration is enabled.

Vercel:

- Native integrations exchange a 30-minute `code` once at `POST https://api.vercel.com/v2/oauth/access_token` for a **long-lived** access token plus `installation_id`, `user_id`, `team_id`. This is not GitHub’s one-hour installation-token model. [Building Integrations with the Vercel REST API](https://vercel.com/docs/integrations/create-integration/vercel-api-integrations).
- PKCE is required for Sign in with Vercel (`https://vercel.com/oauth/authorize`, one-hour access / 30-day rotating refresh). That IdP flow is identity, not selected-project installation. Connections uses the native integration install URL `https://vercel.com/integrations/{slug}/new`.
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

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
2. Callback URL: `{NEXT_PUBLIC_APP_URL}/api/connections/github/callback`
3. Setup URL: `{NEXT_PUBLIC_APP_URL}/api/connections/github/setup` with Redirect on update enabled.
4. Webhook URL: `{NEXT_PUBLIC_APP_URL}/api/connections/webhooks/github`
5. Repository permissions (read-only): Contents, Metadata, Pull requests, Checks, Commit statuses.
6. Subscribe to: `installation`, `installation_repositories`, `github_app_authorization`.
7. Where can this app be installed: Only on this account (or allow selected repositories).
8. Do **not** request administration, secrets, workflows, or contents write.
9. Generate a client secret and a private key. Store:

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

### Vercel integration

1. Vercel dashboard → Integrations → Create (native REST integration).
2. Redirect URL: `{NEXT_PUBLIC_APP_URL}/api/connections/vercel/callback`
3. Webhook URL: `{NEXT_PUBLIC_APP_URL}/api/connections/webhooks/vercel`
4. Scopes, read-only: `project`, `deployment`, `user`, `integration-configuration`.
5. Do **not** enable domain, billing, environment-variable or deployment-write.
6. Store:

```
VERCEL_INTEGRATION_SLUG
VERCEL_INTEGRATION_CLIENT_ID
VERCEL_INTEGRATION_CLIENT_SECRET
VERCEL_INTEGRATION_WEBHOOK_SECRET
```

If any of these are absent, Connections shows **Setup required**. That is not a successful connection.

## Production activation audit (2026-10-13, names only)

Inspected against implementation and official GitHub/Vercel docs. Presence of secret *values* was not printed. A READY Vercel preview is not a connected GitHub/Vercel account.

| Prerequisite | Production (`https://www.gentascend.com`) | Notes |
|---|---|---|
| `20261013183000_service_connections.sql` | missing | Not in the hosted ledger snapshot. Apply only with founder authorization, before the trusted-writes migration. |
| `20261013194500_connection_trusted_writes.sql` | missing | Apply after the first Connections migration. Tightens RPC grants. |
| `20261013203000_connection_broker_role.sql` | missing | Apply after trusted writes. Replaces `require_broker` to use official `auth.role()`. |
| `NEXT_PUBLIC_APP_URL` | not accessible here | Must be exactly `https://www.gentascend.com` (no path/query). Callbacks are derived from it. |
| `CONNECTIONS_CREDENTIAL_KEY` | not accessible here | Independent 64-hex AES key. Do not reuse another secret. |
| GitHub App registration | missing | Not created in this task. |
| GitHub App installation on the selected repository | missing | Read-only Contents, Metadata, Pull requests, Checks, Commit statuses. |
| Vercel native integration | missing | Not created in this task. Read project, deployment, user, integration-configuration. |
| Server-only GitHub/Vercel env names | not accessible here | This workspace has no production secret inventory. Preview must not be assumed to have production configuration. |
| Hosted webhook delivery | missing | Requires registration plus the URLs below. |

Production callback and webhook URLs derived from the code when `NEXT_PUBLIC_APP_URL=https://www.gentascend.com`:

- `https://www.gentascend.com/api/connections/github/callback`
- `https://www.gentascend.com/api/connections/github/setup`
- `https://www.gentascend.com/api/connections/webhooks/github`
- `https://www.gentascend.com/api/connections/vercel/callback`
- `https://www.gentascend.com/api/connections/webhooks/vercel`

## Live tests still blocked on founder authorization

- Registering the GitHub App and Vercel integration.
- Installing them on the canonical repository/project.
- Setting server secrets in local or protected preview (never production in this task).
- Hosted migration of `20261013183000_service_connections.sql`, then `20261013194500_connection_trusted_writes.sql`, then `20261013203000_connection_broker_role.sql`.
- Real webhook delivery and provider revocation.
- Live GitHub/Vercel login after registration.

`scripts/connections-auth-smoke.mjs` is included in `npm run test:integration`. It reads the disposable service-role key from `npx supabase status -o json` for the same loopback instance as `.env.development.local`. It does not read that key from the env file. A generic Origin Auth job does not cover these RPCs.
