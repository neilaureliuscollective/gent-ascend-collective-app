# Talk release verification — PR #158

Reviewed Talk code: `5d86a8163b53968b05caefbc4d5605dfdd4483c8`. Parent globe/TS: `76e982f8`. Base main: `175fda72` (PR #157). No Talk code, schema, credentials, providers or paid generation were changed in this verification pass.

## 1. Exact-head CI and preview configuration

Product GitHub workflows on `5d86a816` are green: Quality gates (application, database, apps-isolate), Live, local-auth, studio, lifestyle, visual, motion. Push-event Quality was cancelled by branch concurrency when the PR run started. `production-entry` skipped.

Drift: remote PR158 head matches local `5d86a816`. Main has no extra commits beyond the merge-base. Unrelated uncommitted architect HTML/PDF in the checkout was not part of this SHA.

**Vercel preview `dpl_zf9znX7o3cQoVUmEyJefJq3sFjAz` fails at build** with `Supabase URL and publishable key must be configured together` (`src/platform/environment.ts`). That check requires the public URL and publishable key to be both set or both absent. Preview currently has `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Preview scope and `NEXT_PUBLIC_SUPABASE_URL` only in Production, so Preview sees a partial pair. Values were not printed.

Production Auth does not depend on those Preview scopes: `supabaseConnection` pins Gent `volpzkfsnmtztrovexcw` when `APP_ENV=production`. Preview uses the env pair as-is. Live preview isolation still rejects Gent and the separate founder project (`tybjocxecilkmozkvuns`) unless an explicit canonical-pilot flag is set. Gent has no development branches. No approved isolated hosted preview database was found.

### Smallest branch-scoped configuration request (not applied)

Do **not** copy Production URL onto Preview. Do **not** attach previews to Gent customer data. Do **not** disable the pair validation.

**Preferred unblock (shell preview only):** remove Preview (and Development, if present) from `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` so Preview has neither public URL nor key. The build can succeed as a signed-out shell. Auth, Talk persistence and voice stay unavailable.

**Only if an authenticated preview is explicitly authorized:** add Preview-scoped `NEXT_PUBLIC_SUPABASE_URL` for the **same non-production project** the existing Preview publishable key already belongs to. Confirm that project ref first. Do not set `AETHELIOS_LIVE_CANONICAL_PILOT` in this request.

A hosted preview for this SHA was **not** obtained. Item 4 remains blocked on that authorization.

## 2. PR #154 compatibility (isolated rehearsal)

PR #154 head `2cee4c9bd0a2d2e17906faa4edcc71fa05c7564c` (`feat/premium-creative-working-experience`) shares merge-base `175fda72` with PR #158. Overlap vs main: `workspace.tsx`, `talk-controls.tsx`, `talk-elevation.spec.ts`, plus docs. PR #154 also changes reading-anchor, design-board, creation-detail and adds `supabase/migrations/20261016051741_premium_design_receipt.sql`. That SQL was **not** applied.

An isolated detached worktree merged 154 into 158 without committing or pushing. Conflicts were exactly the three named Talk files. They resolved by keeping PR #158 dock/isolation/unfinished-work structure and folding in PR #154 caret-scroll preservation, wheel/reading-anchor follow, Latest-message reflow jump, fixture titles and the extra Edit click.

Local combined results (mocked transport, no hosted SQL):

- `tsc --noEmit` passed; production `next build` compiled
- Talk unit 35 passed; premium unit 47 passed
- Playwright: 38 passed, **1 failed** — `talk-voice-dock` “several approvals with the keyboard open…” hit-tested Approve through `<button class="latest-message">Latest message ↓</button>` after PR #154’s tighter follow/away-from-latest geometry. That same test passed on PR #158 alone.

**PR #158 can release independently.** Recommended order: merge/release Talk dock + isolation (`5d86a816`) first; rebase PR #154 afterward and re-prove dock hit-targets, reading anchors and design-board titles together. Do not merge 154 into 158 as a silent combined release.

## 3. Dependency advisories

`npm audit` on this pin: 1 critical + 7 high. No blanket upgrade was applied.

| Package | Severity | Path | Runtime? | Reachability | Compatible fix |
| --- | --- | --- | --- | --- | --- |
| `next@16.3.5` | critical (rollup of several GHSA) | direct | yes | **next/og ImageResponse RCE** (GHSA-vcvr-r3jv-pc5j, fixed 16.3.6): this app does not import `next/og` / `ImageResponse`. **Image optimization SSRF** (GHSA-cjq9-62q9-8jv4, official 16.3.8): reachable in principle because `next.config.ts` sets `images.remotePatterns` for `cdn.shopify.com`. Self-hosted SSG cache poisoning: Vercel-hosted, not claimed. `use cache` / Draft Mode: not used. MCP endpoint: `next dev` only. Metadata image `dynamicParams`: this build is Turbopack; OG image is a static PNG. | Official 16.3 LTS patch is `next@16.3.8` + matching `eslint-config-next`. Not applied here so the reviewed Talk SHA stays `5d86a816`. |
| `sharp@0.35.4` | high | `next` → sharp | image optimization | librsvg CVE; SVG optimization is not enabled (`dangerouslyAllowSVG` unset). | Follows a Next 16.3.8 bump; no separate override. |
| `source-map-js@1.2.1` | high | `next`/`postcss`, Tailwind | build/dev | Event-loop DoS via crafted source maps, not a production request handler we expose. | No runtime repair. |
| `eslint-config-next` → `fast-glob` → `micromatch` → `braces` | high | lint only | no | Pattern ReDoS/stack exhaustion in ESLint, not the hosted app. Audit’s “fix” is a major **downgrade** to eslint-config-next 14.2.35 — rejected. | Leave. |

## 4. Hosted preview

Blocked on item 1. No preview URL for `5d86a816`. Do not treat production https://www.gentascend.com as this PR.

**Requires later bounded authorization:** authenticated Talk writes, attachment upload to Storage, and paid OpenAI Live/Realtime. Synthetic/mocked journeys already passed locally and in GitHub Actions.

## 5. Physical Fold acceptance (Neil)

Browser emulation is not this list. Use the hosted preview (once authorized) or production only after merge approval. Distinguish the **two-minute founder-pilot session end** (“The two-minute pilot session ended. You can resume this conversation.”), the **4000-character voice text limit**, the **20-turn pilot cap**, and “this conversation exceeds the voice context limit” from a crash. Production voice remains founder-pilot gated.

- Folded 390-class and unfolded ~884×690: transcript readable; dock Mute/End/Expand still 44px; composer not covering Latest/approvals
- Native keyboard open: composer visible; Send/Remove/Use in Studio reachable; no chrome clipped
- Type in composer during listening/speaking; draft survives mute/unmute
- Minimize / Expand / Escape: same conversation, attachment, draft, caret, microphone, session
- Mute/unmute matches the track; interruption returns to listening without a second session
- Transcript focus (compact vs immersive) lands on the intended log
- End, reconnect, reopen saved history: same conversation id; no leaked older pages from another chat
- Edit last message → Cancel restores the previous unsent draft
- Switch/New with an attachment-only composer asks before discard
- If the session ends at two minutes, resume is expected; if the globe/page dies, that is a crash

Do not claim live-call success without a real paid result on this SHA.

## 6. Release order and rollback

- **Talk code to approve:** `5d86a816`
- **Independent of PR #154.** Do not combine in one merge.
- **Preview:** shell-only after the key-scope fix, or matched non-production pair if authorized
- **Security follow-up (separate SHA):** `next@16.3.8` after Talk is on main, with the Talk suites re-run
- **Physical Fold + real voice:** after preview or production merge, with the checklist above
- **Stop:** no merge or production deploy from this pass

**Verified current production (do not replace without explicit approval):** https://www.gentascend.com returned 200 with `data-dpl-id="dpl_7SgntMmfpGU157dACvWVdeRkrEX8"`. Source currently on `main` is `175fda72` (PR #157). That deployment is the rollback target if Talk were merged and needed reverting. Older Lifestyle rollback `dpl_HyKuNtX5emzqUCUceisFmdsMbQQu` / `715a2d9d` is no longer the live production head.
