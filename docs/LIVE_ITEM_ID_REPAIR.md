# Live conversation item IDs — focused repair, 2026-10-15

Base: `f3703dcbbc2cb91b28aefc60feb6aee4697fce58` (merged PR #148). The supplied production receipts at 18:21:53 and 18:22:27 UTC on `dpl_6T2UN2rwmfRFXEyqHxXaTVPD7PYi` identify `invalid_request_error`, `providerParam: item.id`, and a correlated first user seed with one pending item and 8,626 characters. The exact provider length versus character constraint is not established. No private context or unrestricted provider message is reproduced here.

The previous five server conversation-item emission sites used `ctx_` plus 32 UUID hex characters: 36 characters including an underscore. All five now call `createLiveItemId`: the letter `c` plus a fixed-width base36 encoding of 16 cryptographically random bytes. The result is 26 lowercase alphanumeric characters, retaining all 128 random bits with no truncation. This is an application format, not a claim about a documented provider limit.

The affected sites are initial seed admission, approved background-work success, background-work failure, artifact selection updates, and completed artifact notifications. Database/job UUIDs, provider IDs, event IDs and correlation IDs retain their existing formats. No role, content, session configuration, acknowledgement algorithm, permissions, budget, cleanup, visual component, style or asset is changed. The separately owned styling task remains separate.

The rejection-code allowlist now also recognizes explicit string-length/pattern/format validation symbols. It still drops unknown codes and unrestricted messages. This diagnostic recognition neither claims which code the provider used in the historical attempts nor makes validation failures recoverable. Existing safe `item.id` parameter recognition and seed event/index/role/length correlation remain.

## Tests and evidence

- New ID tests sample 10,000 independently generated IDs for shape, fixed length and uniqueness. Boundary-byte fixtures decode the base36 value back to all 128 entropy bits, including leading zeroes and the maximum value.
- Real buildMessages user/assistant seed tests assert unchanged payload content and separately correlated event IDs. An explicitly synthetic historical-length 8,626-character user fixture cannot admit on an unrelated item acknowledgement and admits only on its exact generated ID. It does not reconstruct production private context.
- Service regressions execute all five emission paths, including approved background success/failure and selection/completion notifications, and assert the compact ID format.
- Relevant validation-code fixtures preserve only the safe correlated fields; unknown codes and raw provider text remain excluded. Existing timeout/rejection/close/cleanup and acknowledgement tests remain.

Observed local results: 169 Live/protocol tests in 24 suites passed. All nine Chromium Live fixture journeys passed with synthetic Auth/transport/provider. Lint, strict types, optimized `npx next build`, migration ledger and whitespace checks passed. Full units: 1,327 passed, one skipped, five failures in three environment-dependent suites. All five reproduced on untouched base `f3703dc`: three Studio export tests cannot mkdir `/opt/cursor`; Architect host isolation cannot open `/opt/construct-runner.mjs` (EACCES); Architect worker image test reports `Worker image build failed`. Standard build again stopped in the existing Mirror prebuild download with `EAI_AGAIN storage.googleapis.com`.

[Validation receipts](evidence/live-item-id-repair/validation.txt). Real provider acceptance remains unverified. No paid calls, hosted SQL/settings/credentials, ready transition, merge or deployment action was performed in this task. Parent handles those separately after exact-head CI checks.
