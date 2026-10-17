# Talk release verification — PR #158

Talk implementation: `5d86a816`. Next 16.3.8 pin: `df87e982`. Base main: `175fda72`. PR #154 remains separate. No production merge, hosted SQL, credential write or paid generation.

## 1. Current head and CI

Inspected from `e50d4b30`. Unrelated architect HTML/PDF and Lifestyle evidence PNGs in the checkout were not committed. Product GitHub workflows on `e50d4b30` were green except Vercel pair-mismatch. This pass adds the official Next 16.3.8 pin as a separate reviewable commit, then this evidence note.

## 2. Next.js 16.3.8

Official [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) / CVE-2026-94483: Image Optimization SSRF for `16.0.0` until `16.3.8`. Published 16.3 line ends at **16.3.8** (no 16.3.9); matching `eslint-config-next@16.3.8`. No `npm audit fix --force`, no major upgrade, no 16.3→16.4 jump.

`images.remotePatterns` still allow `cdn.shopify.com` only. SVG optimization remains off (`dangerouslyAllowSVG` unset).

Remaining `npm audit` after the pin: **7 high, 0 critical**. Not claimed exploited.

| Package | Exposure |
| --- | --- |
| `sharp@0.35.4` (via `next`) | librsvg CVE-2026-96889 / [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw). Official workaround is sharp ≥ 0.35.5 or Next 16.4.1. App does not enable SVG optimization. Left un-overridden. |
| `source-map-js@1.2.1` | Build/dev source-map DoS, not a hosted request handler. |
| `eslint-config-next` → `fast-glob` → `micromatch` → `braces` | Lint-time pattern DoS. Audit “fix” is a **14.2.35 downgrade** — rejected. |

October 14 Next update ([blog](https://nextjs.org/blog/nextjs-security-update-october-14-2026)) patches **16.4.1** (Active LTS) and 15.5.28. There is no 16.3 patch. Not applied here (minor-line jump beyond the requested GHSA-cjq9 pin):

| Advisory | Actual exposure in this app |
| --- | --- |
| [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) Cache Components `use cache` typed-array RCE | No `use cache` / `cacheComponents` in the repo. |
| [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) Server Actions DoS | App Router `'use server'` actions exist. Remaining. Not claimed exploited. |

## 3. Preview configuration (corrected)

Removing Preview scope from the shared `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` would affect every preview branch. That is **not** a branch-specific repair and was **not** applied. Production and Development scopes were not changed. Pair validation in `parseEnvironment` stays. Previews were not pointed at Gent production data.

This runner has no Vercel CLI token, so live names/scopes could not be re-listed here. Prior inspection: URL Production-only, publishable key includes Preview; Preview builds fail with `Supabase URL and publishable key must be configured together`. Values are not printed.

No approved matching non-production Supabase project is on record (Gent `volpzkfsnmtztrovexcw` has no development branches; founder `tybjocxecilkmozkvuns` is blocked for Live/preview isolation).

### Precise setup request (authorization required; not applied)

On Vercel project `gent-ascend-collective-app`, add **Git-branch overrides for `cursor/talk-voice-dock-compact-42b1` only**:

1. A non-production Supabase project that is **not** Gent and **not** the founder database, with Talk schema already applied or separately authorized.
2. Branch-scoped `NEXT_PUBLIC_SUPABASE_URL` = that project’s HTTPS origin.
3. Branch-scoped `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = that **same** project’s publishable key (do not reuse the Production Gent key).
4. Leave the shared Preview-scope variables as they are so other branches are unchanged.
5. Do not set `AETHELIOS_LIVE_CANONICAL_PILOT` in this request. Do not add service-role keys to Preview.

Until that pair exists, a signed-out shell cannot verify persistence or voice. Local mocked tests remain the evidence for this SHA.

## 4. PR #154

Keep separate. Isolated rehearsal of `2cee4c9` into `5d86a816` failed `talk-voice-dock` “several approvals with the keyboard open…” because **Latest message covered Approve**. That test **passes** on this branch after Next 16.3.8. Do not pull 154’s workspace/reading-anchor/SQL into this release. Owner of 154 should re-prove dock hit-targets after rebasing onto Talk.

## 5. Local validation (mocked / no paid calls)

- `npm run check`: lint, `tsc --noEmit`, **1402** unit passed / 1 skipped, production `next build` (Next 16.3.8 Turbopack)
- Playwright **85 passed**: Talk isolation, image, layout, live, dock (including keyboard-open multiple approvals and 44px controls), elevation, recovery, interaction-recovery; Lifestyle phase-one, member Lifestyle, collection-world, atelier, discovery, commerce-discovery
- Authenticated hosted Talk writes, Storage uploads and paid OpenAI Live: **unverified**

Voice limits unchanged: two-minute founder-pilot session, 4000-character voice text, 20-turn cap. Cedar untouched.

## 6. Physical Fold (not run)

Browser emulation is not this list. After an authorized branch-scoped preview (or post-merge production, only with explicit approval): folded/unfolded, native keyboard, Mute/End/Expand 44px, type during voice, minimize/expand same session, interrupt, reconnect, reopen saved history, edit/cancel, attachment-only Switch confirm. Two-minute end is an expected limit, not a crash. Do not claim live-call success without a real paid result.

## 7. Verdict

**Blocked for live Talk release** until (a) branch-scoped non-production URL+key pair is authorized and a preview for the exact SHA is READY, and (b) Neil completes the physical Fold/voice checklist. Code+tests for the Next 16.3.8 hardening pass are complete. No merge or production deploy.

Rollback if Talk were merged: current production https://www.gentascend.com `dpl_7SgntMmfpGU157dACvWVdeRkrEX8` / `main` `175fda72`.
