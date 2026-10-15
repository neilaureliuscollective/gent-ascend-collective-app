# Aethelios Studio — editable design and complete media productions

Status: implemented on `cursor/studio-editable-productions-09ef` from refreshed main `529d5f1`. No production merge, hosted migration, paid provider call or credential configuration.

## What landed

Aethelios Studio is still the same product. Design and Film are now first-class workspaces inside `/app/studio`. Create, Campaign, Footage, Narration, Finish, Delivery, Library and Direction remain available. Finish layouts become Design presets; they are not deleted.

Canonical documents are owned by Studio. Fabric.js **7.4.0** is the editing adapter, not a second source of truth. 7.4.0 includes the SVG-export advisory fixes ([GHSA-hfvx-25r5-qc3w](https://github.com/fabricjs/fabric.js/security/advisories/GHSA-hfvx-25r5-qc3w) / 7.2.0 and CVE-2026-44311 / 7.4.0). MIT notice: `third_party/fabric/NOTICE.md`.

## Design

- Versioned `studio-design/v1` documents on `ai_studio_designs` / `ai_studio_design_revisions`.
- Custom size in mm, inches or pixels. Export PPI is document resolution, never `devicePixelRatio`.
- Trim, per-edge bleed and safe-area guides. Unconfirmed label sizes stay labelled until a printer/supplier die is entered. ISO ID-1, A4 and US Letter are verified standards; bottle-label millimetres are not invented.
- Editable text (Inter, Sora, DejaVu Sans) with weight, alignment, spacing and a text box. Images, sanitized SVG, rectangles and ellipses. Stable layer IDs, reorder, group/ungroup, lock/hide, alignment, snapping, undo/redo.
- Autosave plus explicit frozen revisions with `updated_at` conflict handling.
- Exports from a frozen revision: PNG at requested PPI, SVG with escaped markup and embed or outline fonts, vector PDF via pdf-lib with embedded fonts and page geometry in points. RGB is not CMYK, PDF/X, spot, foil or printer-certified output.

## Film

- Versioned `studio-composition/v1` documents, max 60 seconds, portrait/landscape/square.
- Owned stills, footage, one narration track and one music/WAV track, titles and captions.
- Browser preview uses the same composition. The existing Campaign MediaRecorder remains a best-effort local export.
- Durable render jobs (`ai_studio_render_jobs`) with leases, fencing, idempotency, cancellation and interrupted recovery. FFmpeg arguments are compiled from validated numbers and trusted temp paths; user caption text never enters a filter expression.
- Local FFmpeg 6.1.1-3ubuntu5 (`/usr/bin/ffmpeg`) is GPL (`--enable-gpl`, libx264, aac, librsvg). The binary is **not** vendored. Hosted rendering is **unavailable** until a worker host runs `scripts/studio-render-worker.mjs` with `STUDIO_RENDER_WORKER=true`. Missing execution never reports Completed.

## Overlaps recorded, not merged

Open Talk #131 (`cursor/talk-creative-conversation-5b08`) and Architect #130 (`cursor/architect-create-apps-501f`) stay on their branches. This work does not edit Talk conversation/voice, Architect application runtime, or `talk-architect-direction` / `talk-design-direction` contracts. Studio #94–#98 remain the merged #99 baseline.

## Ordered activation checklist (later)

Do **not** paste secret values into chat or Git. Configuration should only switch on already-implemented flows. This assignment does not apply hosted migrations, create grants or make paid calls.

1. Merge review of this Studio PR onto the intended environment after founder approval. Do not deploy from this assignment.
2. Apply `supabase/migrations/20261016010000_studio_editable_productions.sql` to the existing Gent Ascend database after review. Confirm `ai_studio_designs`, `ai_studio_compositions`, `ai_studio_render_jobs` and the two private buckets exist. Do not reapply older narration/footage migrations. Do not apply this hosted from this assignment.
3. Editing, save/reopen, PNG/SVG/PDF export and local FFmpeg film render do **not** require OpenAI or Runway. Verify them on an ordinary owner login first with permitted local or synthetic media.
4. Leave `STUDIO_NARRATION_ENABLED` and `STUDIO_FOOTAGE_ENABLED` unset. Paid narration/Runway stay default-off.
5. Leave `RUNWAYML_API_SECRET` and `STUDIO_FOOTAGE_SIGNING_KEY` unset until a later footage activation. A signing key must be ≥32 characters and independent of the Runway secret.
6. Confirm `OPENAI_API_KEY` only when testing existing Create generation. Presence is not credit, quota, or a Design/Film readiness test.
7. Hosted film rendering stays **unavailable** until a separately authorized host with FFmpeg 6.1+ (`--enable-gpl`, libx264, aac) runs `npm run studio:worker:supervised` using existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `STUDIO_RENDER_WORKER=true` only queues jobs; it is not readiness. Missing execution must not report Completed. Do not buy infrastructure or configure new credentials in this assignment.
8. After code+schema are live, a founder-only read of `/api/studio/readiness` should list Design/Film schemas as detected without calling providers.

### ONE first founder action

Apply `supabase/migrations/20261016010000_studio_editable_productions.sql` to the **local** Gent Ascend database after review. Confirm `ai_studio_designs`, `ai_studio_compositions` and `ai_studio_render_jobs` exist. Do not apply this on hosted environments from this assignment. OpenAI/Runway keys are not required for Design editing, save/reopen, PNG/SVG/PDF export or local FFmpeg film render with permitted media.

## Remaining gaps

**Implemented in this completion pass:** revision-aware autosave; Fabric init/stacking/group transforms; sanitizer on parse/save/export; unit conversion; faithful PNG/SVG/PDF geometry; real local worker; composed preview matching compile; lease/idempotency/recovery roles; schema gating for existing Studio.

**Running worker:** `npm run studio:worker` or `npm run studio:worker:supervised` on a host with FFmpeg 6.1+ libx264/aac and the existing Supabase URL plus service-role key. Leave `STUDIO_RENDER_WORKER` unset for in-request local execution. `STUDIO_RENDER_WORKER=true` only queues jobs.

**Not deployed / not activated:** hosted migration, hosted worker process, paid OpenAI/Runway calls, CMYK/PDF-X/spot/foil (explicitly unavailable).

**Setup, not code:** hosted migration, worker host authorization, paid provider keys/credits, physical Fold/phone hardware.

Device checks in this environment are **simulated** (CSS/Playwright viewports at 360 CSS px phone, 717×512 unfolded Fold and 1440 desktop). No physical phone or Fold was attached.
