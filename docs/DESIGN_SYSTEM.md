# Design system — Aurelius 1E

Implemented 2026-09-21 following founder approval and the supplied official logo. [BRAND_IDENTITY.md](BRAND_IDENTITY.md) owns asset provenance and palette. [AESTHETIC_ELEVATION_PROPOSAL.md](AESTHETIC_ELEVATION_PROPOSAL.md) retains the research and rationale; its provisional palette is superseded.

Current material correction: [AURELIUS_1E.md](AURELIUS_1E.md). Founder approved rebalancing the interface toward neutral obsidian and richer gold, while preserving the original enamel purple and logo.

## Experience

An obsidian personal environment with deep aubergine enamel, warm gold edges, a slowly shifting light field and a celestial Aurelius presence. The home screen prioritizes Aurelius, personal direction and useful context. Profile, goals, memory and conversation share the same visual language. Empty states remain truthful; visuals never fabricate progress or connected services.

Use the full seal for formal brand lockups, a compact A/orbit/star for app icons, and the globe motif for the intelligence presence. Sora carries modern headings; Inter carries the interface and reading. A restrained serif remains only in the formal wordmark. Self-host fonts; no font network dependency.

## Materials and hierarchy

Central tokens are in `src/app/globals.css`. Four levels: environment, illumination, substantial reading surfaces, floating controls. Smoked glass belongs to navigation and the global Aurelius launcher. Content is predominantly opaque. Metallic gold identifies the primary action and selected location; purple supplies depth without washing every label in color. Keep gradients away from long reading text.

Current calculated contrast on the opaque #1d1d1c reference: primary text 14.98:1; secondary text 8.74:1; gold labels 7.49:1. Dark button text reaches 5.03:1 against the darkest metallic stop. Decorative purple never carries essential information. These calculations are not a full accessibility certification of every composite.

Keep 16px body/form text and readable secondary labels. Metadata has a 10px lower bound in this pass; favor larger text as real content arrives. Primary task controls and tabs have ≥44px heights. Some compact display controls are 40px wide with spacing. WCAG zoom/reflow and target-size verification remains part of each screen's acceptance, not just a token promise.

## Responsive behavior

Phone: compact branded header, single-column Command, floating labeled dock, central Aurelius control, collapsed conversation library. Unfolded: two-column home areas when space permits; the conversation gets the broad reading canvas. Desktop: restrained sidebar, asymmetric two-column daily home and persistent conversation library. Layout thresholds respond to width, not device names.

The full workspace no longer duplicates its library with a second conversation dropdown. The compact global panel retains its dropdown. Transcript scrolling preserves composer access; short screens reduce decorative space. `interactive-widget=resizes-content` requests viewport adaptation on supporting mobile browsers. Actual phone keyboard behavior still requires device testing.

## Motion and progressive 3D

`components/visual` owns Brand, Icon, AureliusPresence, appearance controls and the environment. `platform/visual/presence-renderer.ts` owns the optional Three renderer. Components do not acquire identity or authorization responsibilities.

Immediate SVG globe; one deferred procedural 3D scene per route, with no HDR/video/model downloads. Three 0.186.0 uses WebGL2, DPR capped at 1.5 and approximately 30fps decorative rendering. No per-frame React state. Dispose geometries, materials, renderer, listeners and observers on unmount. Context loss restores the static visual. A canvas never gates any product action.

Ambient/Still and solid-surface choices persist locally. OS reduced motion wins over Ambient; reduced transparency or increased contrast uses solid controls. Decorative movement pauses while typing, when a dialog is open, when hidden or offscreen. No engagement streaks, random rewards, shame mechanics or simulated AI emotions. The presence is decorative; textual request/save/error state remains authoritative.

## Validation

See [AURELIUS_1C.md](AURELIUS_1C.md) for measured results and remaining device gates. Existing API, Auth, RLS, billing and AI behavior are unchanged. Visual acceptance is separate from live-service readiness.

## Daily dashboard application

See DAILY_DASHBOARD.md. Replace the oversized introductory home hero with a compact greeting/lens and an actionable aubergine intention card. Personal check-in, deliberate actions, active goal, history and reflection form the hierarchy. Gold is an action/material accent, not a universal status color. Today/Evening changes emphasis; no content disappears on a timer. Use static celestial imagery here; no body placeholder or new GPU scene. `dashboard.css` extends shared tokens without changing the approved brand palette.

Shared backgrounds are neutral; purple is concentrated in Aurelius identity and focal surfaces. `--metal-gold` is the control material; solid `--gold` is for readable labels. One route-aware decorative field draws orbital connections. It never reads personal data. Arrival/hover/save effects are finite; ambient light can be paused. The unchanged 1C master logo remains canonical.
