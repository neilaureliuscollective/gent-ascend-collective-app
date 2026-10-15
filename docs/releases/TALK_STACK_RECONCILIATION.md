# Talk stack reconciliation — 2026-10-15

## Ownership and scope

One writer in this execution workspace. Initial checkout clean at main `f8887d3976ae8f328583a21923fe289d7ef6e9b0`; no other worktree/process held the Talk branches. Remote PR heads and discussions checked before editing. No `.agents/skills` directory was present locally or on the inspected refs. Root AGENTS and required architecture/harness/doctrine instructions were read. Existing history is retained with merge commits; no force push or duplicate feature PR.

Original heads: #131 `fa8b7f6c47c351fc41e91d92df0831b068de2022`; #135 `b801b347d89a5e678473f7079565444a1139a7ba`; #139 `9ef0f4e2cb461e1b1abc68904c034a831f459827`.

## Conflict decisions

- `intelligence/prompt.ts`: Human Ascendance identity, behavior contract, playbooks and request-time catalog grounding plus reviewed Talk artifacts/image analysis. Attachment joins the existing extras object, preserving Knowledge callers. New version `aethelios-2026-10-15.human-ascendance.talk.1`.
- `intelligence/service.ts`: both current memory/product/playbook selection and Talk predecessor/image/attachment context; no cross-company context expansion.
- `live/service.ts`: both catalog lookup and Talk offer/refine tools and handlers; current voice delivery plus Talk admission string fields, diagnostics, trusted observation and cleanup. One bounded seed implementation.
- `live/context-budget.ts` and its tests: retain `budgetLiveSeed` and `liveApplicationFromBuilt`, including long-history current-knowledge pinning.
- STATUS/DECISIONS: retain both histories with this superseding status. No whole-file ours/theirs resolution.
- Current logo, commerce metadata/tests and all migration bytes preserved. Historical Legacy Reserve fixture remains explicitly synthetic; it is not current published knowledge.

## Repairs and source-to-test evidence

- Prompt attachment + current Knowledge composition: `tests/live-context-budget.test.ts`.
- Official admission field kinds, all three tool names and both voice instruction contracts: `tests/live-service.test.ts`.
- Fixture is now explicitly local-development/loopback only, denied under hosted/runtime mismatches: `fixture-stream.ts`, `talk-creation-fixture.test.ts`, `talk-creation-prepare.test.ts`.
- Deterministic slow/failure transport scenarios use the existing fixture and real stream orchestration, not an application identity bypass.
- `tests/talk-auth/talk-text-lifecycle.spec.ts`: real disposable Auth/PostgREST, UI send/stop/retry, saved-row/parent checks, no retained sent text, reload/reopen, phone/Fold shortened-height checks. New test must pass in isolated CI before acceptance.
- Existing `tests/talk-auth/*`: artifact selection/revision/reload, reviewed Architect transfer, lost-ack idempotency and foreign-account denial.
- Existing `live-controller`, `live-service`, `live-ledger` suites: synthetic microphone permission, connection, disconnect/reconnect, minimize, interruption and cleanup. These never establish microphone/provider quality.

## Verification checkpoint

Local lint/types passed. Combined focused regression: 33 passed. Full unit run: 1117 passed, 3 failed, 1 skipped: host Docker bind permission and two Studio FFmpeg export/runtime failures. Tests were not weakened; exact-head CI must resolve these independently. Direct optimized Next build passed. Standard build prebuild could not download the checksum-pinned Mirror model (DNS); this is separate from compilation. Migration ledger passed; no SQL changed.

Local disposable Supabase startup encountered blocked primary image registry, then Docker image extraction disk exhaustion via fallback registry. Real Auth acceptance is not claimed from local fixture/unit results. Existing Quality database job is the isolated verification path; pending final-head results must be reported separately.

Official Supabase local CLI guidance was checked for the environment setup, not a new provider integration: https://supabase.com/docs/guides/local-development/cli/getting-started . Changelog markdown retrieval was blocked. Installed Next 16.3.5 Route Handler documentation was inspected. No provider abstraction or dependency change.

## Separate reviewed branches

Navigation #144 `f3fb0629ff2a8bc695dcab6a46398f54a8a1073d`: preserve only its global import, History/Tools labels, `talk-destinations` removal and Menu placements when combining the workspace; do not replace Talk state/providers. Architect #130 `bf25662ae7fa6e92711523ffab7eb04df9d14d51`: preserve its current app workflow, drafts and verified-preview recovery. Neither branch is written by this task. Combined compatibility proof remains a separate checkpoint.

## Hosted release boundary

Hosted Talk SQL is **PAUSED after step 6**; later verification was cancelled. No hosted verification/apply is resumed here. Original migration chain unchanged. A fresh, separately authorized completion/physical-schema receipt and separately authorized recovery migration remain prerequisites; historical notes do not prove their current state. Configuration/provider readiness, bounded authenticated hosted text, real voice and physical phone/Fold acceptance remain separate release gates.

Recommended order after review: current main → #131 → #135 → #139; coordinate #130 and #144 using their adapters and integration proof. Any merge into main may trigger production deployment and requires the separate release process. Isolated deterministic acceptance is not hosted launch acceptance.

## Elevation restack

#135 incorporates #131 `9be1eb9` by merge. Its two conflicts were the fixture selector and tests: retain both `legacy-reserve` and `lifestyle-launch`, editable briefs, and the new local-development/loopback boundary and interruptible transport. All workspace/provider/elevation state remains from #135. No migration changes.

CI on the first elevation reconciliation found three cold-Docker test timeouts (20 seconds) while the runner allows a 60-second image pull before execution. The two existing host-integration test files now allow 120 seconds per case; all isolation, bypass and observed-cancellation assertions are unchanged. This is an explicit cold-runtime deadline, not a skipped gate. Text lifecycle navigation supports Motion's existing narrow Tools/New disclosure.

Saved-work recovery repair: a failed creation read (including a 503 while schema is unavailable) now displays an explicit retry, preserves the current conversation/draft and same-scope saved work, and fences responses again after JSON parsing. A new synthetic browser case in `talk-creation-recovery.spec.ts` verifies recovery without a reload or lost draft. Changing conversation/owner clears the error and old work.

The first real disposable-Auth text run proved stop persistence, retry parent linkage, exactly two database rows and empty composer at phone/Fold widths. Its last UI assertion incorrectly counted the conversation title/history labels as duplicate messages. The corrected assertion scopes the exact count to the transcript; database cardinality checks remain unchanged. Existing authenticated artifact/revision/Architect import journeys passed that run. Full text acceptance remains pending the corrected run.
