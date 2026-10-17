# Talk release verification — PR #158

Talk implementation: `5d86a816`. Next 16.4.1 pin is the security candidate on this branch. Base main: `175fda72`. PR #154 remains separate. No production merge, hosted SQL, credential write or paid generation.

## 1. Current head

Inspected from `75274a0d`. Unrelated architect HTML/PDF and Lifestyle evidence PNGs were not committed. Talk UI, globe, compact voice dock, draft protection and conversation isolation are unchanged.

## 2. Next.js 16.4.1

Official [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r): Server Actions DoS for `16.0.0` through `16.4.0`, patched in **16.4.1**. This app uses App Router and `'use server'` actions including `src/app/auth/actions.ts`. No workaround besides upgrading. Matching `eslint-config-next@16.4.1`. No `npm audit fix --force`. 16.4.2 is a later Turbopack/docs patch, not required for this advisory.

The same 16.4.1 release also covers:

- [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) Image Optimization SSRF (already patched at 16.3.8)
- [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) Cache Components `use cache` RCE (no `use cache` / `cacheComponents` here)
- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) Image Optimization SVG RCE via sharp

Resolved `sharp` after `npm ci`: **0.35.5** (Next 16.4.1 optionalDependency `^0.35.5`). The sharp/librsvg advisory is resolved by this dependency update, not assumed. SVG optimization remains off (`dangerouslyAllowSVG` unset). `images.remotePatterns` still allow `cdn.shopify.com` only.

Remaining `npm audit` after the pin: **6 high, 0 critical**. Production (`--omit=dev`): **1 high**. Not claimed exploited.

| Package | Exposure |
| --- | --- |
| `source-map-js@1.2.1` | Build/dev source-map DoS, not a hosted request handler. |
| `eslint-config-next` → `fast-glob` → `micromatch` → `braces` | Lint-time pattern DoS. Audit “fix” is a **14.2.35 downgrade** — rejected. |

## 3. Preview configuration

Removing Preview scope from the shared `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` would affect every preview branch. That is **not** a branch-specific repair and was **not** applied. Production and Development scopes were not changed. Pair validation in `parseEnvironment` stays. Previews were not pointed at Gent production data. Canonical-pilot was not enabled.

This runner has no Vercel CLI token, so live names/scopes could not be re-listed. Prior inspection: URL Production-only, publishable key includes Preview; Preview builds fail with `Supabase URL and publishable key must be configured together`. Values are not printed.

No approved matching non-production Supabase project is on record (Gent `volpzkfsnmtztrovexcw` has no development branches; founder `tybjocxecilkmozkvuns` is blocked for Live/preview isolation).

### Exact setup request (authorization required; not applied)

On Vercel project `gent-ascend-collective-app`, add **Git-branch overrides for `cursor/talk-voice-dock-compact-42b1` only**:

1. Target project: a non-production Supabase project that is **not** Gent (`volpzkfsnmtztrovexcw`) and **not** the founder database (`tybjocxecilkmozkvuns`), with Talk schema already applied or separately authorized.
2. Branch-scoped `NEXT_PUBLIC_SUPABASE_URL` = that project’s HTTPS origin.
3. Branch-scoped `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = that **same** project’s publishable key (do not reuse the Production Gent key).
4. Leave shared Preview-scope variables unchanged.
5. Do not set `AETHELIOS_LIVE_CANONICAL_PILOT`. Do not add service-role keys to Preview.

Until that pair exists, a signed-out shell cannot verify persistence or voice.

## 4. PR #154

Keep separate. Isolated rehearsal of `2cee4c9` into `5d86a816` failed `talk-voice-dock` “several approvals with the keyboard open…” because **Latest message covered Approve**. That test **passes** on this branch after Next 16.4.1. Do not pull 154’s workspace/reading-anchor/SQL into this release or weaken the assertion. Owner of 154 should re-prove dock hit-targets after rebasing onto Talk.

## 5. Local validation (mocked / no paid calls)

- `npm ci` from the 16.4.1 lockfile
- `npm run check`: lint, `tsc --noEmit`, **1402** unit passed / 1 skipped, production `next build` (Next **16.4.1** Turbopack)
- Playwright **85 passed**: Talk isolation, image, layout, live (streaming/voice session), dock (keyboard-open multiple approvals and 44px controls), elevation, recovery (including drafts never crossing verified accounts), interaction-recovery; Lifestyle phase-one, member Lifestyle, collection-world, atelier, discovery, commerce-discovery
- Local Supabase Auth/PostgREST Talk import: **not run here** (no Docker). CI `database` job is the hosted-local Auth gate after push.
- Authenticated hosted Talk writes, Storage uploads and paid OpenAI Live: **unverified**

Voice limits unchanged: two-minute founder-pilot session, 4000-character voice text, 20-turn cap. Cedar untouched.

## 6. Physical Fold (not run)

Browser emulation is not this list. After an authorized branch-scoped preview (or post-merge production, only with explicit approval): folded/unfolded, native keyboard, Mute/End/Expand 44px, type during voice, minimize/expand same session, interrupt, reconnect, reopen saved history, edit/cancel, attachment-only Switch confirm. Two-minute end is an expected limit, not a crash. Do not claim live-call success without a real paid result.

## 7. Verdict

**Blocked for live Talk release** until (a) branch-scoped non-production URL+key pair is authorized and a preview for the exact SHA is READY, and (b) Neil completes the physical Fold/voice checklist. Code+tests for the Next 16.4.1 Server Actions patch are complete. No merge or production deploy.

Rollback if Talk were merged: current production https://www.gentascend.com `dpl_7SgntMmfpGU157dACvWVdeRkrEX8` / `main` `175fda72`.
