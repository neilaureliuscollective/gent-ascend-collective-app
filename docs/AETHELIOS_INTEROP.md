# Aethelios cross-app publication contract — edition 1

The Gent Ascend Collective app is the member-facing consumer. The separate
`neilaureliuscollective/aethelios` app is the founder's private workspace.
They may share reviewed public knowledge, but not a database session, founder
notebook, member memory, conversation transcript, or privileged tool access.

## Implemented in this phase

`src/domains/intelligence/published-knowledge.ts` is the reviewed, versioned
public snapshot. Its edition and facts are sent as **data** alongside a member
chat request whether or not that member opts into their *personal* context.
No network call to the private app occurs. The edition is a snapshot label, not
a claim that research or live synchronization occurred. The existing chat
ownership, usage reservation, memory opt-in, persistence and tool-free model
execution remain in force.

## Contract for the next publication

The founder workspace may propose public facts, but publication requires a
human review. A publication must have `schemaVersion: 1`, a new immutable
`edition`, and a list of stable `{ id, text }` facts. Review each fact for
accuracy, source, currency and public visibility; exclude private owner or
member material. Update the snapshot in the Collective repository through a
reviewed commit and run its tests. Prior editions remain in Git history.

When manually publishing becomes a bottleneck, replace the snapshot with a
server-side, read-only feed of *approved public editions*. Validate schema,
size, edition and origin before caching the last known good edition. Never
query the founder database with a consumer session or expose the founder's
service key to the consumer/browser. A missing feed must not trigger a fallback
to private memory. Recheck each actor's authorization at their own tool.

Identity sharing and a coding worker are separate future decisions. The
consumer app does not gain development capabilities by displaying Aethelios.
