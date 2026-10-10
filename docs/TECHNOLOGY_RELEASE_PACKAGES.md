# Public Aethelios Technology Phase 7 — controlled release preparation

## Recovery and scope

Recovered exact Phase 6 PR #71 head `a86643bd8142e04c3cb0302b824648542b78b903`, tree `fa2a043c18c7aae6f723cac0f0304b0c470d637b`. The PR is open and unmerged. Phase 7 is a dedicated stacked branch `feat/technology-release-packages`, based on that tested candidate. Preserve the entire earlier creation stack and official icon; no private Founder or Reserve changes.

The authorized useful slice is persistent exact-build approval, portable release ZIPs, explicit revocation and recoverable receipts. It is release preparation, not activated publishing. Connected account inventory has only the public production Supabase project and private Founder project; the public Vercel repository has one app project. No isolated public staging database is available. Creating one may incur cost and is outside the authorized spending scope. No project, domain, integration, billing change, hosted migration or publication was activated.

## Current research — 2026-10-09

- [Vercel for Platforms](https://vercel.com/docs/platforms): a credible future adapter for tenant sites and domains. Deploying customer content needs a separate origin, owner/domain proof and a reviewed hosting budget. Do not serve customer websites inside authenticated platform routes merely to appear deployed.
- [Deployment Checks](https://vercel.com/docs/deployment-checks): bind release gates to the exact candidate; a successful app build does not demonstrate database acceptance or domain ownership.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): explicitly revoke default grants, then owner SELECT only; RLS and grants are independent. Phase 6 real CI exposed this distinction, and Phase 7 tests inherited default grants.
- Read `https://supabase.com/changelog.md` and the [September PostgreSQL update](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). This migration uses ordinary tables, constraints and functions, without the affected ltree/custom operators or legacy pgcrypto encryption. No production database upgrade was performed.
- [fflate maintainer documentation](https://github.com/101arrowz/fflate): use bounded synchronous ZIP creation for three trusted fixed-name files. Pin 0.8.3, already present as a development dependency, as a direct runtime dependency. Store mode avoids compression CPU expense. No arbitrary uploaded archive is unpacked by the application.

Build native approval/history and packaging now. Defer paid hosting adapters and automatic deployment until concrete environment/cost approvals exist. Do not add a fake publish button or a credential-bearing deployment job.

## Durable approval contract

`technology_releases` records owner, project, exact version, build, revision, HTML SHA-256, approval time and optional revocation time. Its four-column foreign key binds all identities to one build. It has authenticated owner SELECT only and no anonymous access or customer table mutations. The two session RPCs resolve `technology_owner()`; no caller owner ID, service key, billing authority or user metadata is accepted.

Initial approval requires explicit consent, a ready exact-hash build and the project's current reviewed version. A person lock serializes quotas; a project lock serializes against new saves. One receipt per build deduplicates approval even with a new request ID. Replaying the same receipt preserves the recorded approval, including after newer website versions exist. Reusing an ID for another build/hash is refused. The server independently verifies the existing artifact before approval. Direct RPC access still cannot supply an arbitrary HTML body or forge build completion.

Limits are twenty receipts/project and one hundred/person. Revocation does not refund a slot, and the revoked receipt is terminal. A later release needs a new reviewed website version. No worker, automatic retry, AI call, purchased storage or public endpoint is introduced. ZIP generation is request-time from already persisted immutable HTML, at most 250 KB input and 260 KB output, with no compression.

Revocation is owner-bound and idempotent; it changes only `revoked_at`. Package downloads re-read it after artifact verification to narrow races. Revocation cannot atomically recall a response already in flight, exported HTML or files already downloaded/shared. It blocks future release-package downloads; it does not pretend to unpublish a site, nor disable the pre-existing HTML export feature. All retained receipt identities/content remain immutable to normal users. Website/account deletion cascades the receipts through existing build ownership.

## Customer experience and portable packet

Each ready build in Work → Technology offers **Review release package**. The review states that hosting is inactive, selected imagery is included, forms/booking/payments are not connected and a separate live release decision is required. A checkbox confirms this exact build before approval. Lost/uncertain mutation responses preserve the request ID; reload reads the durable receipt before retry. Closing/reopening or leaving/returning retains server history. Previously approved versions remain downloadable unless revoked; new approvals require the current reviewed build.

Download requires the owner session, unrevoked receipt, reviewed source identity, exact revision/hash and existing static artifact verification. The response is an attachment with private/no-store, nosniff and restrictive CSP. The ZIP uses fixed safe filenames and a fixed timestamp:

- `index.html`: exact verified export bytes, including selected normalized imagery and its existing default-deny CSP.
- `manifest.json`: release/project/version/build IDs, revision, HTML hash and approval time; target unconfigured, budget zero and publishing disabled. No person/auth ID, storage key, token or secret.
- `README.txt`: view/handoff instructions, pending live gates, independent-origin requirement and revocation limitations.

The ZIP hash is provided in `X-Release-Sha256`. The manifest is a consistency receipt, not a signed approval token. An operator must verify current owner authorization from the platform before future publishing; an offline manifest cannot prove it has not been revoked. Customer approval of downloadable files does not authorize the founder's infrastructure spend or application production release.

## Release gates and compatibility

Fresh read-only production catalog at `2026-10-09T04:17:23.815640Z`: 34 prerequisites present/correct; all 43 additive checks absent across nine migration stages. Production remains the official-icon main release. The ninth additive source is `20261009041047_technology_release_packages.sql`; the earlier eight migration files are unchanged. Preflight records ordered sources and exact hashes plus release table/RLS/grants, RPC security and composite FK checks. No blind push/reset against the shared hosted ledger.

Rollback to Phase 6 hides release preparation but preserves existing approval metadata. Disable the new route/UI if rolling back; keep additive data. Do not rewrite approved HTML, image snapshots or historical versions. Existing image-free export byte identity and Phase 6 imagery remain unchanged.

Automated receipts belong to the Phase 7 PR: lint/types/unit/service/SQL/build, fixture browser checks at 320/720/1440, migration checks and disposable real Supabase Auth/Storage browser acceptance. The real journey now approves/downloads/unpacks the exact image-bearing release, reloads it, denies a second account, revokes it and receives a denied subsequent download. Fixture results are responsiveness/recovery evidence, not hosted acceptance. CI Supabase reset/seed applies only to disposable local infrastructure.

Hosted acceptance remains unrun until a verified isolated staging target, approved cost (if any), environment binding and two synthetic identities are supplied. Rehearse all nine migrations there, run account acceptance and the app's real creation/image/package journey with hosted Auth/Storage, verify harness denial and record exact candidate receipts. Existing account acceptance tooling only covers Mission/Studio/account boundaries; it is not full website hosting acceptance. Physical device and live model quality/cost evaluation also remain separate gates.

## Phase 8

Resolve isolated hosted acceptance and the integrated production release before expanding more creation features. Then implement a separately approved static hosting adapter: verified tenant/domain ownership, exact-hash deployment intent, owner publish approval distinct from packet approval, a founder-approved budget ceiling, idempotent durable deployment receipts, bounded retries, status reconciliation, revocation/unpublish and rollback. No customer production publishing or paid provisioning until these controls and permissions are concrete.
