# Premium durable handoff evidence

Implementation continues PR154 from `a92f3fd`, reconciled with released globe main `4a7d909` in `98972f7`. The initial implementation checkpoint is `e1b6d5b`; later harness/check evidence is reported on [PR154](https://github.com/neilaureliuscollective/gent-ascend-collective-app/pull/154).

[Implementation, authority/version contract and release checklist](../../PREMIUM_DURABLE_HANDOFF.md).

The Quality database job publishes **premium-handoff-auth-evidence** from `test-results/premium-auth/`. A successful run contains real authenticated Talk/Architect phone, Fold and desktop screenshots, a native normal-speed interaction recording and `premium-auth-receipt.json` binding the exact saved version, digest, retained tokens/copy/assets and lineage. This is disposable Supabase Auth/PostgREST with a labelled deterministic model fixture; it is not live-provider, private-media pixel, compiled-build or production acceptance.

The first integration run applied the migration and passed the four historical Talk Auth cases, but stopped before the new test ran because of an invalid Playwright server-module import. The harness is corrected; consult exact-head terminal results and artifacts before treating the new journey as accepted. No missing artifact is replaced with a fabricated image.

Local working-component captures and raw logs are retained under the ignored `.dev/premium-durable-handoff/` folder. The earlier [premium renderer evidence](../premium-creative/review/README.md) remains historical; its prepared receiving fixture was not a durable-transfer claim. Current rendered and Auth evidence will be linked from PR154's exact-head check receipts.

The second integration run completed the real receipt/render/source-update/recovery/tamper/foreign checks and captured the six working-surface screenshots, then stopped at a forbidden direct table UPDATE in the test harness. That denial remains explicitly asserted; archive/reopen now uses the existing application API. Partial captures are diagnosis evidence, not complete Auth acceptance. Final full acceptance must include archive revocation, restore and zero-job assertions.
