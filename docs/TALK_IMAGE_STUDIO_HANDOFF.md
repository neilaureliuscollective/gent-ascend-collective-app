# Talk image attachment and Studio reference handoff

Base: `0c4a59c884dbc133fbe8e9aa153c453f10846e89`. Separate attachment work on `feat/talk-image-studio-reference`; released Live repairs and Cedar are preserved. No shared stylesheet, official asset, SQL/schema, credentials or provider configuration changes.

The visible **Add image** control beside the Talk composer reuses the existing signed Storage upload and completion flow. PNG, JPEG and WebP from 100 bytes through 10 MiB are supported; videos and general files are not. It shows an original-image preview, staged indeterminate progress, errors, retry and Remove. Remove detaches the image locally without deleting an asset. Retry first verifies the same object and reference after an uncertain response, avoiding another transfer when completion already succeeded. File replacement, removal, conversation changes and account changes fence late results. The file is sent unchanged, without re-encoding or overwriting storage.

An uploaded image is attached to the next text message for analysis. After a saved reply it remains available for Studio, but is not silently sent with follow-up messages. **Analyze with next message** explicitly reattaches it. Pending image analysis requires ending voice first. Inline Talk image generation retains `referenceId: null`; it does not use this attachment or a project logo.

**Use in Studio** explicitly selects the existing owned project/reference and navigates to Studio. The session-bound server verifies access, personal project ownership, reference ownership within that project, and the stored image's presence, size and media signature. Selection is saved in the existing project brief JSON with an optimistic timestamp guard; no new table or migration is needed. An older selected reference is loaded even when outside the latest 30 library entries. Missing/foreign/stale references fail visibly, without substituting another image. Studio reload retains the selection. Handoff never generates an image.

Reference guidance can influence generation and change pixels. Exact brand-kit logo placement remains a separate explicit original-logo choice and Finish operation. The handoff does not assign `brand.logoReferenceId`. Design can also place the original reference as an image layer. Existing provider authorization, budgets, original assets and visual tokens are retained.

## Validation and limits

Six Chromium component-fixture journeys passed, including phone 390×844 and simulated unfolded Fold 768×712, analysis versus follow-up, byte-for-byte signed upload identity, durable Studio reload, explicit brand logo choice, no automatic generation, uncertain completion, pending removal, conversation switching, unsupported files and stale handoffs. The fixture intercepts Auth, Storage and provider APIs; these are not physical-device or hosted authenticated acceptance. Four screenshots are stored in [evidence](evidence/talk-image-studio-handoff/).

Unit coverage checks MIME/size boundaries, unchanged File transfer, retry and cancellation fences, strict API identifiers, capability and ownership denial, unavailable/changed originals, optimistic conflicts and clearing without asset deletion. See [validation receipts](evidence/talk-image-studio-handoff/validation.txt) for final check results.

No paid calls, hosted SQL/configuration/credentials, asset deletion, merge or deployment were performed. Canceled/invalid uploads can remain unselected in the owner's storage; this work adds no cleanup/deletion service. Real two-user Supabase Auth/Storage acceptance and physical phone/Fold testing remain unrun.
