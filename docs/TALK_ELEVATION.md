# Talk Elevation — continuous creative workspace

Stacked on Talk PR #131. Development branch only. No main merge, hosted migration, paid provider call or claim of ChatGPT parity.

## Dependency

- Foundation: `cursor/talk-creative-conversation-5b08` (PR #131)
- This branch: `cursor/talk-elevation-5b08`
- Do not modify Architect #130, Studio #132 or Lifestyle #133

## What this branch implements

- One Talk composer dock hosts the persistent voice chrome when Talk is open. The Live fixture page still uses the floating compact region.
- Docked Talk does not duplicate the voice transcript; provisional speech stays in the conversation timeline.
- A visible selection chip names the current work item and version (`title · vN · element`) so “change this” has a target.
- Shared work-item helpers describe Talk creations/images and export Markdown separately from Copy JSON and browser Print/PDF.
- Labelled `lifestyle-launch` fixture offers Aethelios Lifestyle directions and an editable launch brief. `legacy-reserve` remains for PR #131.
- Experience marks exist as labelled targets, not claimed measurements.

## Capability matrix

| Capability | State | Evidence |
|---|---|---|
| Design provenance + Review/Confirm | Existing / verified on #131 | talk-auth journey |
| Trusted observe → intended turn bind | Existing / verified on #131 closeout | `15190000`, receipt smoke |
| Voice controls in Talk dock | Newly implemented | Talk portal `#talk-voice-dock` |
| Duplicate transcript in Talk dock | Removed | Docked compact hides `role=log` |
| Floating Live compact + log | Existing / preserved | `live-voice.spec.ts` |
| Selection chip | Newly implemented | `describeSelectedWork` |
| Markdown download | Newly implemented | `exportTalkDocument` |
| Native DOCX/PPTX/XLSX | Unavailable | Not implemented |
| Stored-file PDF | Unavailable | Print/PDF is the browser dialog |
| Image download when complete | Newly implemented | `/api/studio/image` |
| Vision pixel inspect | Existing server path | Talk attachments; not expanded here |
| Studio/Architect handoff contracts | Existing | Reused, not duplicated |
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

## Remaining to make this personally usable live

1. Founder-authorized hosted apply of Talk/Architect migrations from #131 including `15190000`
2. Promote a build of the verified #131 SHA, then this elevation SHA
3. Paid audio and production HTTP 400 remain separate
