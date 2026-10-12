# Founder Office — validation, release and rollback

Candidate is inside the single canonical public application. **Not deployed; live founder acceptance is not complete.** Read [audit](FOUNDER_OFFICE_AUDIT.md), [research](FOUNDER_OFFICE_RESEARCH.md) and the subsequent [readiness phase](FOUNDER_OFFICE_READINESS.md). The readiness phase configures the documented compiler-API checker; its current build limitation is the missing Mirror prebuild asset. Historical phase-one receipts below remain dated evidence.

## Reviewable changes

- `/app/founder`: server-verified authority, real profile/context, company switching, private memory controls, current mission versions, personal/portfolio continuity, approvals and actual account execution receipts.
- MARA / CASSIAN / CASSIUS share the existing agent registry, Council runner and turn ledger. Public roles are Entities; founder roles are Coworkers. Named founder requests and explicit company Council work use the same authorization boundary.
- One prepare action creates a real company job, uses frozen company/source/figure context and saves a validated deliverable. A save-only option remains available. Existing PDF/review/history, Studio and Talk are retained.
- Task plans, assignments, dependencies and explicit completion use existing immutable work versions. Models cannot silently modify saved human decisions. Exact recovery does not repeat completed provider calls.
- Consequential proposals and approval/rejection history are saved in those versions. No external publication, spending, communication, deployment or destructive action is executed.
- An explicit portfolio briefing reads bounded company/mission records, excludes personal memory, and persists an existing personal Mission plus conversation. Deleted Missions are not silently reinstated by recovery.
- Canonical public repository/HTTP/workflow inspection is fixed, bounded and commit-pinned. Runtime/global metrics and unavailable authorized connectors remain honest missing states.
- Founder grant lookup no longer requires membership provisioning; sign-in and app reopening land in the office. Local bootstrap adds a trusted synthetic grant only after the existing loopback checks. Retired private-app bridge network code is removed.

No dependency, database, sign-in system, hosted grant or migration was created. Existing founder-access, company workspace/job/version and personal Mission migrations are prerequisites; hosted object/policy presence was inspected, not reapplied.

## Verification boundaries

| Gate                             | Observed result / limitation                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                             | Candidate lint run passes after fixing the route’s JSX/try-catch issue. Final receipt is recorded in STATUS.                                                                                                                                                                                                                                |
| Strict TypeScript                | `next typegen && tsc --noEmit` passes.                                                                                                                                                                                                                                                                                                      |
| Unit / SQL emulation             | Candidate suite passes, including founder denial, forged inputs, paid-provisioning independence, scoped routing, strict provider schemas, JSONB key-order compatibility, graph constraints, human approval preservation, receipt recovery and cross-owner SQL denial. Final count is recorded in STATUS. PGlite is not real Auth/PostgREST. |
| Compatible rollback reader       | Commit `555b08e` was checked independently in a detached checkout of this same repository: strict types and 416 tests across 58 files passed. No second application or database.                                                                                                                                                            |
| Migration ledger                 | `npm run db:ledger` passes its 28-file recorded hash snapshot. This is not a complete fresh hosted ledger reconciliation. No new migration.                                                                                                                                                                                                 |
| Optimized production compilation | Webpack with the installed documented `experimental.useTypeScriptCli=false` compiler-API mode completes. Original config is restored. Final candidate rebuild is recorded in STATUS.                                                                                                                                                        |
| Standard production build        | The standard CLI checker fails here with `Could not parse output from TypeScript's --showConfig`; the normal prebuild also needs the missing pinned Mirror asset. The compiler-API build bypasses that prebuild and is not an asset-complete production acceptance claim.                                                                   |
| Browser / phone / Fold / desktop | Supplied `tests/browser/founder-office.spec.ts` covers scoped input, exact recovery, tasks, approvals, keyboard and six viewport widths. Attempt stopped before tests because Next cannot bind `127.0.0.1:3100` (`EPERM`). No screenshots or physical devices are claimed tested.                                                           |
| Real Auth / RLS                  | Existing Auth smoke plus `scripts/founder-office-auth-smoke.mjs` cover trusted grant, sign-out/sign-in persistence, immutable controls and owner/anonymous denial. Attempt fails because `.env.development.local` and a running local Supabase are absent; Docker socket access is denied.                                                  |
| Real authenticated browser       | `tests/founder/founder-office.spec.ts` uses public sign-in and real persistence without API interception. The same local stack/browser blockers leave it unrun. It tests a manual result variant, not live intelligence.                                                                                                                    |
| Live model                       | `npm run test:ai:live` fails explicitly because `OPENAI_API_KEY` is absent; no provider call was sent. SDK mock tests are not live model acceptance.                                                                                                                                                                                        |
| Live voice                       | No canonical live voice implementation or configured test session; not claimed.                                                                                                                                                                                                                                                             |
| Remote CI                        | Existing main run `38086981801` remains failed in broad browser/founder suites. No remote candidate run, push, merge, PR or deployment was created.                                                                                                                                                                                         |

Logs are local execution artifacts under `/workspace/founder-*.log`, not committed production/user records. Do not publish authentication state or future real-provider/customer traces as public artifacts.

## First operational milestone

On an authorized account in the existing public app:

1. Sign in through `/enter`; server resolves verified identity, person and trusted founder grant.
2. Open the Founder Office; confirm profile, actual rooms and honest service states.
3. Select/create the real company, review its brief, and explicitly supply relevant source notes and confirmed figures.
4. Type a substantive request and select or let Aethelios suggest the lead Coworker. Device dictation is text input, not a live voice claim.
5. Prepare/save the result; inspect the job, source context, model turn and deliverable version. Verify that no other company or personal memory entered the room.
6. Add dependent tasks, prepare a specialist contribution, review a version, and record a bounded approval/rejection. External execution must still say unavailable.
7. Close the app/tab, reopen and resume the exact job, task plan, approval history and conversation.
8. Repeat with an ordinary member and another owner: founder routes/roles denied, private records isolated, normal public functionality retained.

This live journey must pass before declaring the phase activated. Use synthetic data locally; never reset or seed the hosted shared project. Supply server-only credentials through the approved environment configuration, not chat or public Git.

## Release and rollback sequence

**Do not roll back new records to the original `32d1c4c` reader.** That original strict content schema can reject the additive task/approval fields. The compatible reader commit is the intended rollback source, and retains every immutable record.

1. Resolve the existing browser/founder CI baseline against the current approved product. Run the asset-complete normal build and all relevant real Auth/provider/device checks on a runner that supports them.
2. Review `555b08e` and the activation commit as two stages of the same application. Confirm canonical repository, Vercel team/project and Supabase project before any authorized release. Obtain an accepted production-built compatibility artifact and retain it for rollback; none exists yet.
3. Only after explicit founder deployment authorization, release the compatibility reader, verify normal public product behavior and old/new work-contract readback, then stage the activation source with production environment configuration without assigning the public domain.
4. Test that exact staged production artifact with real founder and ordinary-member identities, persistence, limits, model behavior, responsive controls and error handling. No local harness on hosted deployments.
5. Promote only the accepted production artifact. Verify public availability, `/dev` denial, founder routing, company isolation, result reopening and ordinary-member behavior. Check error/usage receipts and deployment metadata at the exact SHA.
6. If intervention is required, restore the accepted compatibility artifact; do not delete or rewrite new work versions, reset hosted data or promote an untested preview as though it were the tested production build.

No Git push was made because Vercel Git integration may automatically deploy a preview. No new PR URL or hosted migration exists. A reviewable local branch and separate rollback-reader commit are prepared; the current production deployment remains `32d1c4c`.

## Remaining activation work

Provide an execution lane with writable CLI configuration, Docker/local Supabase or an already approved non-production acceptance backend, localhost binding and Chromium IPC. Run the supplied checks with real credentials. Finish the broader CI baseline, then authorize and verify the two-stage release.

Live voice remains a next priority: evaluate current OpenAI WebRTC/GPT-Live with the same trusted context, permissions, persisted receipts and approval services, and measure it on the founder’s actual phone/Fold. Authorized calendar/documents/email, operational GitHub/Vercel tools, unattended workers and platform-wide monitoring still require real scoped connections and accepted execution contracts. They are not portrayed as operating today.
