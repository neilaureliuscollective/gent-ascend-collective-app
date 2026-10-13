# Aethelios Architect — immersive creation workspace

Research and implementation phase, October 12, 2026. Extends Architect Origin; a review candidate, not a production release or working software execution engine.

## Product direction

Architect should feel like entering a creation headquarters. One project owns the window. Its purpose, working surface and save state stay intelligible as the user moves between conversation, evidence, Blueprint and deliverables. The premium qualities are considered typography, useful space, precise hierarchy, continuity and control. Extra glowing decoration, more cards and hidden agency do not establish those qualities.

Full-screen here means filling the available application window. It works in a normal browser, installed application, Fold or desktop window without requesting browser Fullscreen permission. Browser and operating-system controls remain available. An optional browser Fullscreen command is deferred: it is not required for an immersive workspace and has differing device support.

The visual vocabulary remains Imperial Emerald Obsidian, from the authoritative aether palette and io semantic materials. The official crest remains unchanged. Emerald frames the environment, carbon supports sustained reading and editing, and gold marks selected work and confirmation controls. No new scenes, providers, UI framework or animation library were added.

## Research and inference

Primary sources read October 12, 2026:

- [Android canonical layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts): distinguishes list/detail navigation from supporting tools, preserves state as window sizes change, and puts related tools beside primary content when space permits. The implementation uses these layout principles on the web, not Android SDK components.
- [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): content and functionality need to remain available at narrow widths. Blueprint navigation has an equivalent labeled select when the outline would crowd the canvas.
- [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): persistent controls must not hide keyboard focus. Save controls occupy layout space; short windows use natural page scrolling.
- [MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog): native modal behavior supports inert background, keyboard dismissal and focus restoration. The environment menu uses showModal rather than a hand-built overlay/focus trap.
- [MDN viewport lengths](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length): dynamic viewport units account for browser interface changes. The frame uses 100dvh with a 100vh fallback, safe-area padding and a short-height fallback. This is not physical keyboard-device certification.
- [MDN Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API): browser Fullscreen is a separate API with availability and permission considerations. The native application-window composition does not depend on it.
- Installed Next 16.3.5 usePathname documentation: persistent layouts need a client pathname boundary for route-specific presentation; the server Shell retains identity, capability checks and provider composition.

Apple toolbar documentation was opened but returned a JavaScript-only page. No unseen Apple guideline is treated as evidence. The design judgments above are our application of the accessible adaptive patterns, not a measured claim that these changes increase perceived luxury or productivity.

## Audit and reuse

Origin already provides owner-scoped projects, 13 Blueprint sections, grounded provider-source proposals, seven editable document formats, approval gates, immutable project revisions, exact request replay and archival. Preserve that domain/API/SQL foundation. Origin PR #111 remains a dependency of this consolidated candidate.

Canonical main advanced from 0af812f to 16ad503 while Origin was under review. Its 23 released intelligence-motion changes were reconciled before this implementation. Local source-snapshot commits are provenance records, not upstream Git ancestry. Remote publication must include genuine main and Origin parent commits and verify source-tree equivalence.

Open overlapping work reviewed initially: #112 Imperial Emerald II, #98 Studio premium, #83 Architect cloud projects, #82 commercial Architect, #80 creation integration, and the earlier Technology creation chain. While this build ran, #112 was released as canonical main 26bf465; its 24 changes were reconciled and its latest authoritative materials reused. The other unmerged implementations are not runtime capabilities and are not imported. This phase uses the current released design system and Origin only. It does not alter memberships or resurrect a parallel creation engine.

Shell's existing navigation, Universal Capture, appearance controls, account entry, permitted Founder Office and developer link are passed into one reusable EnvironmentFrame. Existing SensitiveLiveProvider, sensitive boundaries and ConversationDraftProvider stay in Shell. Outside /app/architect the standard shell composition remains. Inside Architect global chrome is available through Aethelios menu; Work, Talk, Studio, Health, Lifestyle and Ecosystem remain reachable. Council has an explicit entry in the contextual menu. No client presentation choice authorizes data access.

## Implemented working composition

- Architect occupies the application window with a compact official identity bar. The page-wide sidebar and generic topbar become a contextual modal menu using the same components and permission-controlled server props.
- Entry is a continuous vision surface with four shared starters and the existing persisted creation action. Phone starters become compact choices; their selected guidance remains visible beside the idea field. Repeated introductions and an empty project-library button are removed.
- An active project removes repetitive marketing, keeps the project identity, surface navigation and save state in a stable frame, and gives remaining space to a scrollable canvas. Project switching is available on demand.
- Blueprint has a numbered section outline on wide screens and a labeled section select on narrow screens. Both edit the same draft and approved record.
- Deliverables support Edit, Preview and Split. Wide Split places editable Markdown and rendered work beside each other; narrower Split preserves both in a single column. Focus canvas tucks away supporting Aethelios tools without losing their request draft.
- Surface, Blueprint section, selected saved document and document view are stored in the current project URL. Reloading that URL resumes the view after an ownership-scoped project read. Invalid selectors are ignored; they grant no record access. No project text or AI prompt is put in URLs or browser storage. A copied link needs the owner's authenticated account.
- Drafts remain transient until explicit save. View changes, preview and focus do not approve content or write a database revision. Existing uncertain-save locks and exact request replay are preserved.
- Save controls participate in layout rather than overlaying the editor. Short windows fall back to natural scrolling. Native menus and document mode controls work with a keyboard; reduced-motion and forced-colors remain supported.

## Verification and boundaries

Initial local gates: lint and strict TypeScript pass; 727 unit/SQL checks pass across 119 files after canonical reconciliation. Local optimized webpack production build passed. Initial isolated CI passed all 730 unit/SQL checks, 12 Architect browser checks and the real Auth journey; final reconciled candidate receipts are recorded in the review PR. Local browser fixture listener failed with EPERM on 127.0.0.1:3102, so fixture screenshots and real local Supabase acceptance are run in isolated CI. Browser fixtures use synthetic responses, not real Auth or live models. The separate Origin Auth journey uses actual Next, Supabase Auth and persisted synthetic data with AI off.

New meaningful checks cover native menu Escape/focus restoration, application-window sizing, view resumption without extra saves, saved document selection, focus mode, draft preservation and short-window save reachability. The real Auth journey also verifies founder navigation visibility, leaving through the shared menu and returning with persisted content. Existing Origin security/service and all other regression suites remain enabled.

No domain mutation or migration changes are needed for this phase. Origin's additive migration still needs isolated hosted rehearsal and founder approval before hosted activation. Storage and AI flags remain closed by default; there are no ready model/Supabase credentials in the managed environment. Live provider quality, physical Fold/DeX/iPhone checks and subjective founder aesthetic review remain separate acceptance gates.

## Founder review and the next Construct slice

Review the actual entry, Blueprint and document screenshots at phone, unfolded and desktop widths. Try creating a project, editing and saving direction, creating an editable deliverable, changing its view, leaving via the menu and returning. Confirm the experience feels continuous and its save/approval states are understandable. Production promotion and hosted activation are separate decisions.

This phase supplies a reusable frame without switching every environment at once. A later deliberate adoption in Studio or Work can keep each environment's functional tools and replace competing chrome with the same contextual menu. It must have its own responsive and operation regression acceptance.

Architect Construct should next advance execution preparation from the approved Blueprint: deliverable specifications, dependencies, evidence-linked acceptance criteria and reviewable work packages. Integrate a real tested existing execution capability only when reconciled and explicitly within scope. A technical proposal remains a proposal; this phase does not generate running apps, validate formulations, deploy, publish, contact third parties or spend money.

Rendering review: the first real screenshots led to an approved-carbon document canvas and sticky wide-screen Split preview. Subsequent entry/menu review removed repeated introductory content and kept the shared Aethelios shortcut in modal flow instead of its inherited floating phone position. Additional real-menu assertions and 320–1920px entry/Blueprint screenshots verify these changes. The final exact-head receipts and artifacts are recorded in PR #113, rather than describing screenshots from an earlier candidate as final. No new model calls, storage records, dependency downloads or paid services are required by view changes; document preview remains bounded by the existing 24,000-character limit.
