# Ascend Loop V1 — Ascend Profile baseline

Date: 2026-09-25. Continuation of `ASCEND_LOOP_V1.md` on the draft branch.

## Why this phase

The first slice records daily actions, reflections and captures. It lacked durable current personal state. The next needed relationship is between a person's chosen direction and the daily Command/Aethelios context. A hair scanner, metric dashboard or more visual cards would not close that gap.

## Implemented

- Six short, Aethelios-voiced questions cover direction, body/presence, recovery, work, character/relationships, and coaching/boundaries. A user can skip a question.
- A structured model call proposes at most three facts from one answer and only in the keys relevant to that question. No proposal writes a fact. The answer is held in the page until the user confirms a value; the full transcript is not stored as a profile.
- Confirmed values live in `ascend_profile_facts`, keyed by person and fact key. Corrections use expected versions, preserve `old_value`/`new_value` in `ascend_profile_revisions`, and replace the active value. A null correction removes it from active context while retaining revision history. Each request UUID is idempotent only for identical arguments.
- The RPC derives the person from the session, locks that person for serial writes, validates the allowed keys and lengths, and is the only write path. Both tables have explicit read grants and owner RLS; anon and direct authenticated writes are denied.
- Aethelios receives only active user-confirmed facts when personal context is enabled. Command can show the current direction. The existing manual memory system remains distinct; profile facts are canonical state, not a second implicit AI memory store.
- Structured proposal calls reserve a record in the existing `ai_usage` ledger, sharing the 10/minute and 120/day limits with chat. Capture interpretation now uses the same reservation path. Failed model calls still consume a reservation; they do not claim a fact was saved.

## Release order and remaining work

Apply `20260925020524_ascend_loop_capture.sql`, then `20260925034117_ascend_profile_baseline.sql`, before deploying app code. No hosted migration or production deployment was performed here. Live model behavior, phone/browser experience and real two-account GoTrue/PostgREST checks remain to be verified after a test deployment.

This is a guided baseline, not a general extraction of all chat turns. The next slice should integrate a bounded typed tool registry into the existing Aethelios conversation with explicit confirmation and committed result acknowledgement, then a reviewed evening reflection extraction. Add a visible revision inspector and export/delete controls before a wider private beta.

## Research and verification

OpenAI's current function-calling guidance distinguishes tool arguments from application execution; structured model output is appropriate for a reviewable extraction proposal. Supabase's RLS guidance requires explicit grants plus ownership policies; its 2026 Data API change makes grants especially important for new tables. Reviewed 2026-09-25. Repository checks: lint, typecheck, 76 tests including PGlite owner isolation/version/idempotency, and production build. Docker is unavailable in this execution environment; PGlite does not substitute for live Supabase Auth/PostgREST.
