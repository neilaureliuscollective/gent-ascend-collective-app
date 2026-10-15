# Studio production release — October 15, 2026

Founder explicitly instructed: “Push proper updates to main and deploy to live app.” This authorizes merge of PR #132 and the existing Vercel Git production pipeline. Hosted Studio migrations, Fly renderer, new credentials and paid generation remain off.

## Released application

PR #132 merged as `9b21a0e72059844adbe1f25811d82d8b68d06110` (parents `544c156` Health workspace + `e9e871179e4779a72e9a8a2105e619ef5c034273` Studio). Production deployment `dpl_8YH8qk6gcsga7HFBhdYwaYzWFrTo` is READY with production configuration and assigned to **https://www.gentascend.com**. Home HTML `data-dpl-id` matches that deployment. This is a production build through the existing Git pipeline, not promotion of a preview. Previous compatible production artifact is Health workspace SHA `544c156`; preserve private tables, buckets and records if reverting the app.

Live signed-out checks: `/`, `/app`, `/app/studio` and `/app/health` return 200; `/api/studio`, narration and footage return 401 `private,no-store`; `/api/studio/readiness` returns 403 `Founder access required.`; `/dev` returns 404. Design/Film persistence and hosted PNG/PDF/Film rendering stay unavailable until the Studio migrations and a commissioned renderer are separately authorized.

Rollback: restore the previous READY production deployment for `544c156`. Leave stored jobs/objects. Do not revert Lifestyle or the official icon. Do not launch or stop a Fly Machine (none is commissioned).

# Studio production release — October 12, 2026

Founder explicitly instructed: “Research and execute next build. Push to live app.” This authorizes the release of the reviewed Studio candidate; unverified paid media remains disabled.

## Released application

PR #99 merged as `268f3ef3b48678c130357c382f39d3d6ee73b6f7`. Its tree `ee3a70810275d2ff86fb344f383b8fb190d23755` exactly matches the CI-verified candidate `cccf9ea`. No other pending PR was merged in this phase. Existing Founder Office, commerce and one canonical Supabase are preserved.

Production deployment `dpl_F1Dan8ao9S35HvkU2rcqdNKvGvBw` is READY with production configuration and assigned to **https://www.gentascend.com**. This is a production build through the existing Git pipeline, not promotion of a preview with preview variables. Previous compatible production artifact `dpl_4gadesYKEwfeAvWSPtPpzAKvCvaf` / `de7bcea` is retained for rollback; preserve private tables, buckets and records if reverting the app.

The live code includes premium Studio rooms, owned brand kits, image/storyboard/Finish workflows, browser-native image films, reviewed Delivery packs, default-off Narration/Footage and founder configuration checks. Deployment does not certify real paid narration/video, device-specific encoding or an authenticated production founder journey.

## Evidence and follow-up

Exact candidate passed all Quality, Studio, Obsidian visual and Lifestyle gates: 534 unit/SQL tests, 418 broad browser tests, 13 real-local-Supabase founder tests, focused media/visual tests and production build. Hosted media schema previously passed 20 read-only catalog checks; exact versions/hashes remain recorded in STUDIO_MEDIA_CONNECTION.md.

After deployment, the real domain resolves to the exact production artifact. Home and Studio returned 200; anonymous founder readiness returned 403/private,no-store; anonymous Narration and Footage returned 401; hosted /dev returned 404. Immediate deployment-scoped Vercel error/fatal aggregation returned no groups. No custom log drains are configured; this short observation is not a long-term health or conversion measurement.

The inherited production browser test still expected four navigation links, although the approved unified app includes Lifestyle as its fifth destination. Follow-up retains the exact count and verifies each Talk/Work/Studio/Lifestyle/Ecosystem label and href. Added read-only live Studio API-denial checks and a dedicated public production workflow. It uses no credentials, member records, mutation or provider calls. Final phone/desktop browser receipts are recorded in the follow-up PR after CI completes.

## Configuration and remaining activation

Read Vercel variable names/scopes only with decrypt=false. Existing OpenAI and Supabase connections are present for production/preview. Studio narration/footage enable flags, Runway application key and footage signing key are absent; default-off behavior is preserved. No provider credential was decrypted and no media request or activation flag change was made.

To activate paid media: save server-only `RUNWAYML_API_SECRET` and an independent `STUDIO_FOOTAGE_SIGNING_KEY` in the existing Vercel project, confirm provider access/credits/budgets, then perform explicit real render/cost/save/reopen/recovery and two-account hosted isolation acceptance before enabling the corresponding production feature. Ordinary account/device/visual acceptance still matters. No additional Supabase project is required.

Research rechecked official [Vercel deployments](https://vercel.com/docs/deployments) and [production promotion](https://vercel.com/docs/deployments/promoting-a-deployment), alongside the installed Playwright request/browser APIs. The verification follows entry → API authorization → existing owned data boundaries; schema/CI fixtures are not presented as live provider acceptance.
