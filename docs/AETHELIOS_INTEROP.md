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

## Founder continuity bridge (edition 2)

The founder can sign in to both apps and choose **Connect private Aethelios**
from the Gent Ascend Aethelios page. The private app verifies its owner session
and owner database gate. Gent Ascend separately verifies its person-bound
`founder_access` grant. A short-lived authorization code is exchanged using a
one-time verifier; the private app issues an expiring token bound to the Gent
Ascend auth user ID. Only its SHA-256 digest is stored privately. Gent Ascend
keeps the token in a secure, HttpOnly cookie and sends it server to server.

When the founder enables personal context on a message, the consumer server
requests a bounded selection of current, confirmed, stated, non-private-only
notebook entries with `global` or `gent-ascend` scope. It does not copy them to
the Collective database. It does not send other project, health or personal
scopes, drafts, archived entries, full conversation history, voice assets or
development tools. It also retrieves up to five relevant, source-labeled
knowledge excerpts from the private knowledge core on a linked founder chat;
these are dated evidence, not live research. The private server rechecks the
grant for each request; it expires after 30 days and Disconnect revokes it.
When the link is absent or unavailable, the chat uses local context only and
must not claim access to the private notebook.

Shared character conduct is versioned in the consumer prompt; product-specific
tool limits remain local. The private workspace remains the source of truth
for founder teaching, so confirmed edits to eligible entries are visible on
the next linked chat. Public member knowledge remains the separately reviewed
snapshot above, never the founder notebook.
