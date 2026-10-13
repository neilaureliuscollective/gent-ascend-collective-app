# Architect contract for Connections

Construct (draft PR #116, branch `cursor/architect-construct-pipeline-165a`) must not share runner, worker, execution-state tests or the Construct migration with this work. Import only this server-only module:

`src/domains/connections/architect.ts`

## Interface

```ts
architectConnectionReadiness(personId, store, env)
  → { github: { ready, repository, reason }, vercel: { ready, project, reason } }

architectPinnedSource(personId, store, path, sha)
  → { path, sha, content }   // exact commit, selected repository

architectPullRequest(personId, store, number)
  → { number, title, state, headSha, url }

architectCheckRuns(personId, store, sha)
  → { id, name, status, conclusion, sha }[]

architectCommitDeployment(personId, store, sha)
  → { id, environment, commit, state, url, projectId, projectName }
```

## Guarantees

- Ready is true only after server-side verification of the selected resource. Environment variables and OAuth callbacks are not enough.
- GitHub reads use short-lived, repository-scoped installation tokens minted at request time.
- Vercel deployment status is bound to the selected project id **and** the exact 40-character commit. Stale or forged project/commit pairs are rejected.
- These functions never queue coding jobs, activate a runner, publish branches, merge, or deploy.
- Connecting a repository never starts an AI operation.
- Credentials remain in the encrypted server store. Do not pass tokens into Construct’s code-execution sandbox, generated previews, browser bundles, logs or model context.

## Coordination

Connections migration timestamp: `20261013183000` (after Construct’s `20261013160000`). Shared files touched here are additive (`database.ts` tables, `.env.example` names, STATUS/DECISIONS). Construct files are not modified.
