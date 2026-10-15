# Talk Elevation — continuous creative workspace

Stacked on Talk PR #131. Development branch only. No main merge, hosted migration, paid provider call or claim of ChatGPT parity.

## Dependency

- Foundation: `cursor/talk-creative-conversation-5b08` (PR #131)
- This branch: `cursor/talk-elevation-5b08`
- Do not modify Architect #130, Studio #132 or Lifestyle #133

## What this branch implements

- One Talk composer dock hosts the persistent voice chrome when Talk is open. The Live fixture page still uses the floating compact region.
- Docked Talk does not duplicate the voice transcript; provisional speech stays in the conversation timeline.
- A visible selection chip names the current work item, version and optional field (`title · vN · Purpose`) so “change this” has a target.
- Targeted conversational edits travel as `workTarget` on chat only when that creation is selected. A mismatched id is ignored; the model is told to ask rather than guess.
- Briefs and plans open as Talk documents: Edit / Preview / Split, field targeting, revision compare and Markdown export distinct from Copy JSON and browser Print/PDF.
- Architect direction review names the source revision, destination, bound snapshot and unsupported fields through the existing contract.
- Labelled `lifestyle-launch` fixture offers Aethelios Lifestyle directions and an editable launch brief. `legacy-reserve` remains for PR #131.
- Experience marks exist as labelled targets, not claimed measurements.

## Capability matrix

| Capability | State | Evidence |
|---|---|---|
| Design provenance + Review/Confirm | Existing / verified on #131 | talk-auth journey |
| Trusted observe → intended turn bind | Existing / verified on #131 closeout | `15190000`, receipt smoke |
| Voice controls in Talk dock | Newly implemented | `#talk-voice-dock` registry + portal |
| Duplicate transcript in Talk dock | Removed | Docked compact hides `role=log` |
| Floating Live compact + log | Existing / preserved | `live-voice.spec.ts` |
| Selection chip + field target | Newly implemented | `describeSelectedWork`, `workTarget` |
| Talk document Edit/Preview/Split | Newly implemented | CreationDetail document views |
| Revision compare | Newly implemented | `compareTalkRevisions` |
| Markdown download | Newly implemented | `exportTalkDocument` / `compileTalkDocument` |
| Native DOCX/PPTX/XLSX | Unavailable | Not implemented |
| Stored-file PDF | Unavailable | Print/PDF is the browser dialog |
| Image download when complete | Newly implemented | `/api/studio/image` |
| Vision pixel inspect | Existing server path | Talk attachments; not expanded here |
| Studio/Architect handoff contracts | Existing + described | `describeTalkDestination` |
| Origin document kinds in Talk | Unavailable | Architect Origin owns those kinds |
| Paid Realtime audio | Unrun | Unauthorized |
| GPT-Live / ChatGPT Voice | Unavailable | Different architecture; not migrated |

## Official voice references (2026-10-15)

Reviewed: Realtime conversations, Voice agents, Live conversations, and ChatGPT Voice help. GPT-Live and Realtime are different transports. This branch keeps the existing Realtime WebRTC path and does not migrate models.

## Experience targets (labelled, unmeasured)

- Session-ready: 1500ms
- First useful audible: 2500ms
- Interruption-to-silence: 400ms
- Input responsiveness: 100ms
- Save acknowledgment: 800ms

## Selected-work lifecycle

The visible chip, opened artifact, `workTarget` on text, voice admission and typed-in-voice prefix now resolve the same current creation. A brief Purpose target wins even when a board is also selected. Stale or cross-conversation targets ask instead of rewriting another item. New conversation, switching conversations and opening a different item clear the field. Saving a revision rebinds the same field to the new version.

## Remaining to make this personally usable live

See `docs/releases/TALK_INTEGRATED_RELEASE.md`. Health #136 is already on main as `20261015181000`. Talk does not rename `15180000`/`15190000`. Merging #131 is the next GitHub action, not proof that live Talk works.
