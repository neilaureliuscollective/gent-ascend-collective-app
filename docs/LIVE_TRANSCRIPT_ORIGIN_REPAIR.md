# Live transcript origin repair — 2026-10-15

Base: `1adaa7ff7fd2ae8ff89221eeb06b38300b1d3aae` (merged PR #149). PR149's compact ID repair changed the server producers while controller and ledger exclusions still recognized only `ctx_`. Provider echoes of context were consequently treated as human user items. The browser directly rendered them as provisional Talk messages; the server could also attribute a reply to an internal item. This repair addresses future event classification, not historical stored rows.

## Scope

`application-item.ts` provides one browser-safe recognition contract: the exact letter-led, fixed-width, lower-case base36 ID format within its 128-bit encoded range, plus legacy `ctx_` recognition. It does not broadly match IDs beginning with c, provider call/conversation IDs, or text resembling application context. Its shared encoder produces exactly the same 26-character IDs as PR149 with all 128 random bits. Server generation still uses node:crypto randomBytes; selected-target generation uses browser crypto.getRandomValues.

The controller excludes those application-origin message echoes from provisional transcript state. Genuine audio transcription and assistant transcript events retain their own processing; a regression even supplies a genuine audio event with an ID resembling the reserved namespace. Genuine typed text is not classified by its wording. Because receipt reconciliation takes its expected user IDs from transcript state, internal message IDs no longer prevent save acknowledgement. No saved-history content filter is introduced.

Selected-target updates, including the stale-target fallback, now receive an application item ID before the existing message is sent. Their context text, role and lack of response.create remain unchanged. This joins the five existing server emission paths in the same namespace. Function-call outputs remain outside human-message ingestion as before.

The server ledger ignores internal echoes without clearing a pending genuine human input. A real input is remembered as claimed when associated with a response, preventing duplicate item echoes from re-arming it. Its latest-input association is consumed only after the genuine turn is saved, while leaving any newer human input intact. Response continuations remain eligible until save. This prevents later context-only notification replies from reusing a saved human turn. Existing ASR/playback ordering and interrupted-reply semantics are retained.

No changes to voice choices, voice delivery, visual components/styles/assets, context content, provider session configuration, seed admission/acknowledgement handling, correlation IDs, authorization, approvals, budgets or cleanup. No database/schema changes, no production conversation row edits or deletes, and no attempt to hide historical rows by text matching. Any historical cleanup needs separate review.

## Regression coverage

- Exact compact and legacy recognition; similarly named provider IDs, invalid lengths/case/range and context-like text are not classified as internal.
- Existing ID boundary and uniqueness tests preserve PR149 encoding; existing seed tests still require all matching acknowledgements and cover delayed/duplicate/unrelated acknowledgements, rejection, close and timeout.
- Internal creation/update/done echoes before and after real speech; late ASR; real typed context-like wording; genuine audio; interrupted replies; duplicate real-item echoes; and later context-only replies.
- Selected-target and stale-target echoes are hidden without changing their payload text or triggering a new reply.
- Actual service RPC regression verifies internal notifications do not call ai_begin_turn, while the subsequent genuine spoken turn does save.
- Controller receipt regression requires every genuine provider binding, excludes internal IDs from expectations, then clears acknowledged provisional state.
- Actual Talk fixture rejects synthetic startup/late context echoes, reconciles a genuine saved turn, reloads it exactly once, and rejects stale workspace responses after conversation switching. The Talk suite is now included in Live browser CI.

## Verification

180 tests in 25 Live/protocol suites passed. All 12 Chromium Live/Talk fixture journeys passed. These use synthetic Auth/transport/provider, not paid provider or physical-device acceptance. The Talk fixture waits for a loaded composer and uses keyboard consent activation so the transcript regression is independent of the separately owned phone consent-panel styling. A pointer attempt encountered existing sticky-button overlap; no CSS repair or claim of pointer-layout acceptance is made here.

Lint, strict TypeScript, optimized Next build, migration ledger and whitespace checks passed. Full suite: 1,338 passed, one skipped, five failed. All five reproduced on untouched `1adaa7f`: three Studio export tests cannot mkdir `/opt/cursor`; Architect host isolation cannot open `/opt/construct-runner.mjs` (EACCES); Architect worker image reports `Worker image build failed`. Standard npm build still fails in the unchanged Mirror prebuild download (`EAI_AGAIN storage.googleapis.com`); the separate optimized Next build passes.

[Validation receipts](evidence/live-transcript-origin-repair/validation.txt). No paid calls, hosted settings/SQL/credentials changes, production merge or deployment. Parent handles exact-head CI and release. Working tests do not establish that historical production rows are clean or that this repair has completed paid-provider acceptance.
