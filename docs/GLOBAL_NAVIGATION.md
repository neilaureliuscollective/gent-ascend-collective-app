# Consistent global navigation

Bounded repair from `main` `804c8770754aced1837e82dffa4a416c24baa595`, isolated worktree `/workspace/global-navigation`, branch `fix/consistent-global-navigation`. Remote branches and open PRs were inspected; no exact navigation-unification workstream was found. This is not a landing redesign or Agency release.

## Behavior and ownership

`src/components/destinations.ts` owns names, routes, icons, primary placement and presentation visibility. The four primary shortcuts are Home, Talk, Work and Architect. All implemented destinations remain available in the full menu; no tiny eight-item mobile bar. Work retains `/app/work`. Existing Missions, Council, Meet Aethelios, account/settings and membership deep links are retained. Account & settings uses the existing `/app/you` page; no invented settings route. Public Lifestyle/membership/Home alternatives remain available to anonymous users. No return URL or authentication provider is changed.

`global-navigation.tsx/css` owns the visibly labeled Menu trigger, right-side sheet, grouped destinations, current-page indication and display preferences. `navigation.tsx`, `shell.tsx`, `environment-frame.tsx` and `public/world-header.tsx` consume that contract. The workspace and public layouts supply verified server identity and founder authority. The registry is presentation, not authorization: existing server services, session RLS and founder_access remain authoritative. It contains no project titles, email checks or entitlement grants.

Talk's small `aurelius/workspace.tsx` adapter replaces the ambiguous ellipsis with visible Tools, labels conversation history, keeps New unchanged, and moves the duplicated global list into the shared Menu. The menu is also available during loading/failure. Narrow toolbars wrap instead of clipping the trigger. Standard headers shed duplicate account/founder/work links; all are in the menu. Architect retains its existing compact header and page internals. Menu state never keys, resets or unmounts feature content or providers.

The existing native `ContextSheet` retains focus trapping/restoration, viewport-height tracking, Escape, scroll locking and cleanup. One optional backdrop-dismissal prop is added; existing users retain their default behavior. No external destination or redirect input is accepted.

## Concurrent integration

- Architect #130: no `architect-origin/*`, Architect route, application builder, worker or SQL edits. Shared frame replacement only. The separately owned Architect elevation must preserve the supplied `globalMenu` slot.
- Talk #131/#135 and Motion #139: reconcile only the global import, visible History/Tools labels, removal of `talk-destinations`, and GlobalNavigation placements in the toolbar and unavailable state. Keep their complete conversation/creation/voice logic. Do not take this branch's entire workspace file over their newer version.
- Ecosystem #140: public layout/header overlap. Preserve its content changes while passing server navigation access into WorldHeader and retaining the shared menu.
- Knowledge #141: no product-knowledge, prompt or service edits.
- Historical browser assertions naming Explore, Aethelios destinations, seven shortcuts or the Architect-specific menu are migrated to the new contract. Their unrelated historical content expectations may still be stale; the dedicated navigation suite is the current bounded acceptance suite.

## Verification and limits

Local Node 24.19.0, Chromium 154.0.8037.57. Dependency install uses the unchanged lockfile and `/tmp/navigation-npm-cache`; default home cache was unwritable. Bundled Chromium download was forbidden; system Chromium was used.

The dedicated browser suite checks 12 route compositions at 320/344/390/720/1440px: Home, Talk, Work, Architect, Studio, Health, Lifestyle, Ecosystem, membership, account, Founder Office and public Home. It verifies identical founder destination sets, anonymous/member/founder differences, focus cycling/restoration, Escape/backdrop dismissal, overflow, large text, shortened height and real Talk composer draft retention. The shell fixture uses synthetic identity props; only Talk renders its real feature workspace, while other page bodies are labeled stand-ins. These are not authenticated route screenshots or live voice evidence. Service workers are blocked in the fixture runner so its synthetic history URLs cannot be replaced by the real app's cached index.

`anonymous-built-routes.json` records actual anonymous menu interactions against 11 local production-build routes with no configured backend. This is distinct from fixture parity. Before/after PNGs use the same labeled fixture adapter against main and the repaired code, with desktop/phone/Fold viewport emulation. `before-*` and `after-closed-*` compare closed chrome; `after-*` shows the open scrollable menu. Emulation is not physical device acceptance.

Full unit run: 989 passed, four failed outside navigation (three Studio export tests attempted `/opt/cursor`; Architect host-isolation test timed out). Generated Studio/Architect evidence from that run was restored, not included. Standard `npm run build` failed in the existing Mirror asset prebuild download (`storage.googleapis.com`, EAI_AGAIN). Direct `next build` is recorded separately and does not prove the asset preparation gate.

Remaining release checks: authenticated member/founder sessions, real active voice continuity, physical Fold/phone orientation/keyboard behavior, upstream integration and full release gates. No hosted SQL, production deployment, main merge, paid model call, credential or entitlement change was made. Founder approval remains required for release.
