# Premium creative acceptance evidence

Application source: `05a2565abaa2024ce8c6c2fe0ea5372461dea5d9`. Base main: `6e35741e46fd5ec6e9d8fc94a634e22a99f4bdc5`. The final code delta after capture only corrects historical v1 transfer copy; the captured premium surfaces and tested behavior are unchanged. [Implementation and limitations](../../PREMIUM_CREATIVE_OUTPUT.md).

These are native Chromium renders of the real repository working components in an explicitly synthetic Vite fixture. Next Image/navigation use the existing browser-only adapters. There is no authenticated account, paid provider response, generated media or generated application behind the campaign. Product photography is not supplied. The emblem is the approved repository asset. **Premium transfer is blocked in the actual UI/API until the PostgreSQL authority contract is extended. The receiving screenshot is a prepared contract preview, not a successful durable transfer.**

| Direction | Desktop | Phone | Fold |
| --- | --- | --- | --- |
| Editorial — The Founder’s Journal | [View](desktop-direction-1.png) | [View](phone-direction-1.png) | [View](fold-direction-1.png) |
| Split — Luminous Precision | [View](desktop-direction-2.png) | [View](phone-direction-2.png) | [View](fold-direction-2.png) |
| Statement — A Singular Standard | [View](desktop-direction-3.png) | [View](phone-direction-3.png) | [View](fold-direction-3.png) |

[Primary document Preview](document-preview.png) · [Prepared receiving view of the edited direction](architect-retained.png)

[Normal-speed creative interaction (MP4)](creative-interaction.mp4) · [Original native recording](creative-interaction.webm) · [Talk phone lifecycle recording](talk-phone.webm) · [Talk Fold lifecycle recording](talk-fold.webm)

The creative recording selects three directions, revises/saves/reloads the chosen headline and color, handles a receiving read failure/retry, previews the future receiving contract and reads the polished document Preview. The existing receipt APIs are represented by deterministic fixtures; server-side authority/idempotency/foreign-owner behavior is covered separately by domain tests.

The phone/Fold recordings exercise a long draft, a short keyboard-like viewport, accepted send/save/collapse, a failed send, preserved draft and explicit saved-state recovery, asynchronous artifact growth while reading, and a controlled incremental response. Frame timing is unchanged. Physical keyboard/IME acceptance remains separate.

| Conversation surface | Phone | Fold |
| --- | --- | --- |
| Short keyboard viewport | [View](talk-keyboard-390.png) | [View](talk-keyboard-884.png) |
| Asynchronous artifact / reading anchor | [View](talk-reading-anchor-390.png) | [View](talk-reading-anchor-884.png) |
| Incremental stream while reading history | [View](talk-stream-reading-390.png) | [View](talk-stream-reading-884.png) |

## Check receipts

- [48 focused tests passed](focused-tests.txt), including exact snapshot/digest reload, contrast, generation context, failed reads, existing v1 transfer guards, and the PostgreSQL premium authority mismatch/refusal.
- [Three new browser cases passed](browser-acceptance.txt), with nine campaign viewport/direction captures, working Preview/lifecycle surfaces, a prepared receiving view and the explicit premium-transfer block.
- [11 existing Talk regressions passed](talk-regressions.txt), including Latest navigation at phone/short/desktop heights and 320–1440px layout/focus checks.
- [Premium transfer blocked visibly](premium-transfer-blocked.png). The guard is also enforced before server-side project binding.
- [Lint](lint.txt), [final delta lint](lint-final-delta.txt), [boundary lint](lint-boundary.txt), [final copy lint](lint-final-copy.txt), [typecheck](typecheck.txt), [application build](application-build.txt), [migration ledger snapshot](migration-ledger.txt).
- [Full unit run](full-unit-run.txt): 1,344 passed, six failed, one skipped. The obsolete campaign-label expectation was updated and all nine work-item tests passed in the focused rerun. The five remaining failures reproduce on untouched main: three Studio evidence tests require `/opt/cursor`; the host isolation test cannot run its container runner correctly; the worker image cannot build. [Baseline reproduction](main-baseline-failures.txt) also encountered an additional container-cancellation failure. These are unresolved environment gates, not a green full-suite claim.
- [Standard build prebuild blocker](standard-build-prebuild-blocker.txt): the unchanged Mirror preparation step cannot resolve `storage.googleapis.com`. Direct `next build` passed separately; this does not make the full standard build command green.
- [PR152 in-memory merge check](pr152-merge-tree.txt) and [PR153 check](pr153-merge-tree.txt). A tree hash with exit status zero means a clean hypothetical merge; no merge commit or release was created.

The [manifest](manifest.json) records SHA-256 hashes. The PostgreSQL premium authority extension is a required next phase; no SQL was changed. Hosted Auth/Storage, paid-provider creative fidelity, native phone/Fold IME behavior and production release remain unverified. No worker was enabled or commissioned.
