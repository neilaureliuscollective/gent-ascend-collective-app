# Architect release evidence report (offline only)

This follow-on starts at reviewed PR #130 `bf25662ae7fa6e92711523ffab7eb04df9d14d51`. Source inspection found both commissioning summaries omitted `20261015156700_architect_apps_budget_lock.sql` and the release doc still cited old Talk heads. Open PRs and current remote heads were checked first; no equivalent release-manifest repair was found. Talk runtime, its active branches, Studio labels and #130 are unchanged.

## Single dependency source

[architect-apps-release-manifest.json](../scripts/architect-apps-release-manifest.json) pins main, Architect and Talk compatibility source heads plus SHA256 of each pending migration. Its order is the dependency order relative to the pinned main baseline, not a replacement for the repository migration ledger. `architect-only` uses interim verified retain before preview sessions. `talk-integrated` omits that interim retain, includes Talk's authority/provenance retain and later recovery dependency, and places the budget lock before both retain migrations. Origin extras are included. Unrelated Health/Studio migrations are not commissioned here.

Inspect the plan without executing any commissioning command:

```sh
npm run architect:release-report -- --plan talk-integrated
npm run architect:release-report -- --plan architect-only
```

Output explicitly says `executed: false` and provides `hostedSqlSnapshot` with `recordedOn: "2026-10-15"`, `reportedStatus: "paused-after-talk-step-6"`, and `liveStatusVerified: false`. This is a dated historical report, not live authority. No apply command is generated. SQL already completed must be reconciled by physical evidence, never replayed. This work does not lift the pause.

## Receipt contract

```sh
npm run architect:release-report -- --target target.json --evidence evidence.json
# Same offline checker through the existing worker-preflight entry point:
node scripts/architect-apps-worker-preflight.mjs --release-report --target target.json --evidence evidence.json
```

The checker reads only local JSON and the existing schema contract. It does not load environment files, call a provider, contact Supabase, run Docker, or start the worker. **Normal** worker `--preflight` is different: it probes the control plane and reports worker presence, so it is excluded from this offline task regardless of current hosted status.

Target JSON requires `manifestSha256` (printed by `--plan`), `profile`, full 40-character `commit` for the actual release candidate, explicit `environment`, immutable `imageDigest` (`sha256:` plus 64 hex), exact `workerId`, and `maxAgeSeconds` (1–86400). Pins belong to the independently reviewed target, not to claims inferred from a passing receipt.

Every receipt below requires `commit`, `environment`, `observedAt` (ISO timestamp) and `reference` (audit artifact/run location). All must match the target and be fresh, never future-dated. Worker preflight freshness is at most 90 seconds. Run the report with the real clock; fixed clocks are used only inside tests.

- `sources.{architect,main,talk}`: exact `branch`, `observedHead` and `includedHead` matching the manifest. Talk is required only for the integrated profile. The collector must inspect the remote branch and verify candidate ancestry/inclusion; this offline tool does not fetch GitHub. Branch movement fails until the manifest is deliberately reviewed and receipts regenerated.
- `checks.{quality,origin,apps-isolate,local-auth}`: `conclusion: "success"` from terminal checks on the candidate, with job/run references. Previous #130 or compatibility green runs do not transfer to a new candidate.
- `schema`: `baselineCommit` matching pinned main, `baselinePhysicalVerified: true`, and `migrations` containing exactly the selected ordered `{file, sha256}` entries. Also provide the existing schema probe result as `probe` (`ok`, `classification`, `missing`) and the exact `requiredAppsSchemaContracts` object as `contracts`. This is physical-schema evidence, not ledger-only evidence. Full probe contracts remain owned by `src/domains/architect-apps/schema-probe.ts`.
- `worker`: target `imageDigest`, existing unmodified preflight JSON as `preflight`, and `proofs.{write,compile,topology}`. Each proof has its own common receipt fields plus `ok: true`, matching `imageDigest` and `workerId`. Preflight must be commissioned/idle, isolated, digest matched, schema OK, work root ready, with no missing names.
- `provider`: existing web-plane `appsGenerationPolicy` output as `policy`; it must be production OpenAI, permitted, founder-pilot configured, generation-ready, with empty missing/blocker lists. Never include key values. The packaged worker intentionally receives no OpenAI key, so its permitted disabled-generation policy is distinct from web provider readiness.

The complete synthetic input shape lives in the `fixture()` factory in [the tests](../scripts/architect-apps-release-report.test.mjs). Those receipts are not hosted evidence. The tool cannot authenticate externally supplied receipts or prove live infrastructure from a JSON assertion: an authorized release reviewer must verify referenced artifacts and provenance. `evidenceComplete` means consistency only. `hostedAccepted` and `authorizedToExecute` always remain false. Exit 1 means missing, invalid, stale or mismatched evidence; exit 0 is never permission to execute.

## Validation and remaining launch gates

Run `npm run test:architect:release` (Node 24, no dependencies) and `npm run db:ledger`. The focused tests are also wired into the existing Quality workflow. Fixture tests exercise both valid dependency profiles, omitted budget lock, out-of-order/duplicate/checksum errors, stale source/check/worker evidence, missing worker/proofs/provider config, schema mismatch, environment mismatch, and offline dispatch without worker startup.

Historical snapshot recorded 2026-10-15: hosted SQL was reported paused after six Talk steps. This offline tool does not verify current hosted status. Separate authorization and verified recovery/completion are required before any continuation. Still required: exact integrated-candidate checks, physical hosted schema reconciliation, commissioned isolated worker and supervision, web configuration/provider policy, SQL execution policy, authorized bounded real-provider acceptance, authenticated create/approve/compile/revise/reopen and denial/recovery acceptance, and physical phone/Fold review. A green build is not hosted acceptance. No commands to mutate these systems were executed here.

Observed locally for this follow-on: 30/30 offline report tests; 4/4 existing commissioning tests; Node syntax checks, changed-script ESLint, TypeScript and the migration-ledger check passed. All 29 manifest SQL checksums were separately compared to the pinned compatibility Git objects without executing SQL. The broader worker-image suite had 6 passes and 1 failure across the two selected files: Docker could not create `/home/agent/.docker/buildx` on this read-only filesystem (worker bundling itself succeeded). `npm run build` stopped in the existing prebuild asset download with `EAI_AGAIN storage.googleapis.com`; no production-build success is claimed. Hosted, provider and physical-device acceptance were not run.

Review repair: the local checksum check now requires every Architect dependency, including budget lock, to exist and hash correctly. Only manifest entries explicitly marked `optionalOnArchitectBranch: true` **and** scoped solely to `talk-integrated` may be absent with `ENOENT`; unreadable optional files still fail. Fifty focused tests pass, including missing-file coverage for every Architect entry and injected EACCES/EISDIR/EIO errors for both required and optional entries. SQL pause output is a historical snapshot recorded 2026-10-15, never a live status assertion. No hosted status lookup or action was performed.
