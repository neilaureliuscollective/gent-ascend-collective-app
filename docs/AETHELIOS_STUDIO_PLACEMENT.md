# Aethelios Studio placement — 2026-09-27

## Decision

Studio is a distinct Aethelios space, alongside Chat. It keeps its addressable `/app/studio` route, saved projects, and private asset flow. The persistent Gent Ascend navigation remains Command, My World, Aethelios, Progress, and You. The central Aethelios presence is the parent destination; Chat and Studio are its two current modes.

The previous desktop-only heading link was hidden by the compact Chat layout. A rushed phone header link made Studio technically reachable but did not establish a coherent place for it in the application.

## Placement

- Desktop sidebar: a quiet Chat / Studio switch directly below the Aethelios presence.
- Closed or open Fold and other compact layouts: the existing five-position bottom navigation remains legible. Chat has an always-visible Chat / Studio switch beneath its compact header; Studio has the same switch above its projects.
- Command: the Aethelios intelligence card has a direct Create in Studio action.
- Both spaces have an active state, keyboard focus, and an addressable route. Switching to Studio does not submit the Chat draft, and switching back returns to the Chat workspace.

No new bottom tab, modal, duplicate Studio backend, or reorganization of saved images is involved. Future media types can join Studio projects without making Chat's conversation ledger own creative assets.

## Evidence and verification

- Apple Human Interface Guidelines describe tab bars as stable top-level destinations and sidebars as navigation between areas or collections: https://developer.apple.com/design/human-interface-guidelines/tab-bars and https://developer.apple.com/design/human-interface-guidelines/sidebars
- Material 3 recommends three to five destinations of equal importance for compact navigation bars: https://m3.material.io/components/navigation-bar/overview
- Android adaptive guidance calls for navigation to respond to window size and foldable posture: https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps
- Next.js App Router supports shared layout navigation with `Link` and route-aware `usePathname`: https://nextjs.org/docs/app/api-reference/components/link and https://nextjs.org/docs/app/api-reference/functions/use-pathname

Local lint, typecheck, and production build pass. Authenticated visual review on the founder's closed Fold, unfolded Fold, and desktop remains the release follow-up; protected Vercel routes prevent an unauthenticated browser from exercising the workspace.
