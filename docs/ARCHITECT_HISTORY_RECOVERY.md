# Architect history-navigation draft recovery — October 13, 2026

Founder approved a local repair and affected retesting after the combined PR113/PR114 candidate lost unsaved document edits through browser Back → Forward. Base: `6781bc67af51beac33abf50aee5e9d62f8be3d3a`. This is not merge, deployment, migration, provider or B+ authorization.

## Behavior and boundaries

A single transient handoff lives in the existing workspace Shell, outside the keyed EnvironmentFrame. When Architect unmounts without an explicit discard/leave decision, it retains the selected project's draft, original revision and unconfirmed-operation state in memory. Returning makes the existing no-store, session-bound Origin read before restoring anything. Both project ID and person ID must match. Missing/different projects, changed owners and 401/403/404 responses clear the handoff. Other read failures retain it for Reload receipts; no private draft renders before the matching read succeeds. Sign-out redirects outside the workspace and destroys this provider.

The handoff never uses browser storage, cookies, history state, URLs, module globals, background writes or model calls. It holds one project only. Browser Back and Forward work normally; no history monkey-patching or duplicate history entries. The existing link/phone-shortcut confirmation remains. Cancel retains edits; confirmed leave clears recovery. Discard uses the freshly read saved version, including when another session changed the revision. An unconfirmed save keeps its original request ID and expected revision; a matching fresh receipt resolves it without replay. Stale revisions are not silently rebased.

Full unload/refresh continues to warn while editing, and now also warns when the draft is retained on another workspace page. Confirming a full reload discards this memory-only draft and loads saved content. This is not durable autosave: browser/process termination, a newly mounted workspace, and confirmed discard/leave do not preserve it. Initial unsaved project-intake forms without an authenticated saved project are outside this focused repair.

### Follow-up: creation acknowledgement ownership

Independent review identified a remaining path: a newly created project could be saved successfully while its immediate history refresh failed, leaving the client without an owner for later draft recovery. This was reproduced on `fd117f9` in an actual Next browser journey with synthetic API data. The successful save acknowledgement now includes `personId` from the same verified request session that performs the ownership-enforcing RPC. The client sets that owner immediately; it never obtains it from the save body or a guessed prior account. A missing/empty owner in an acknowledgement keeps editing paused until an authenticated receipt read resolves it. Receipt recovery also restores the project's URL so subsequent history navigation can load the matching project.

New tests cover creation followed by a failed history read at 390/720/1440px, later edit/save/reload, owner changes/access denial, and missing/empty ownership acknowledgements. Unit tests assert the server-derived owner, unchanged RPC arguments and rejection of forged ownership fields before the service. Existing browser mocks now return the extended response contract; their behavioral assertions remain intact. No migration, RLS, auth-adapter, dependency, feature-gate or B+ change was made. The earlier 513-case broad run remains evidence for `fd117f9`; follow-up results and the exact newer candidate are recorded separately.

## Verification

The original combined build reproduced the loss before the repair. New unit tests exercise one-shot ownership matching, different/absent owners or projects, clearing, memory isolation and exact uncertain requests. Dedicated browser tests use actual optimized Next routes and native browser Back/Forward with synthetic intercepted APIs. They exercise 390/720/1440px, repeated history traversal, distinct and newly created documents, project switching, cancel/leave/discard, refresh cancellation/acceptance, owner changes, denied/transient reads, stale saves and receipt recovery. These do not prove database persistence, authentication or RLS.

Reproduce:

```sh
npm run lint
npm run typecheck
npm test
npm run db:ledger
npx --no-install next build --webpack
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npx --no-install playwright test --config playwright.origin-navigation.config.ts
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npx --no-install playwright test --workers=2
```

The dedicated navigation configuration enables only Origin's local UI flag, with synthetic interception, Origin AI/Live/Health disabled and no harness or database credentials. It refuses to reuse an existing listener. The full browser configuration keeps its existing feature-gate behavior.

Final results and SHA/tree are in the separately preserved review report. The standard npm build/e2e model-download preflight and real Supabase acceptance remain independent gates: the required MediaPipe model is absent after denied download access; the earlier local database attempt was blocked by registry access and disk capacity. No denied endpoint was retried for this repair. Physical Fold/iPhone/DeX, hosted Auth/Storage/providers and device/provider performance remain unverified.
