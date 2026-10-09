# Public Aethelios — Imperial Steel

Founder authorized homepage implementation and production release on October 9, 2026. Preserve the previously approved Imperial workspace and original crest. This phase changes the public homepage and additive shared material infrastructure, not the internal intelligence modules.

## Inspection and research

Repository verified: `neilaureliuscollective/gent-ascend-collective-app`; Vercel project verified through the successful GitHub Vercel status: `stutes-legacy/gent-ascend-collective-app`. Production before this change: `ef0bc5c`, with a successful GitHub Production deployment and HTTP 200 at www.gentascend.com. The approved workspace commit `2ab753b` was local and is preserved in this release branch. Technology creation PRs 65 and 67–74 remain separate; this release does not merge them or claim their features are deployed.

The existing homepage had useful, honest content and functional entry links but little material contrast: cream canvas, a green statement panel and simple divided workspace links. Preserve its messages and actual destinations.

The supplied image informs materials only: directional light on brushed steel, deep green, narrow metallic seams, architectural charcoal and cream relief. Its affiliate branding, fabricated performance figures and illustrative application controls are excluded. Applied design principles: clear hierarchy and direct entry (Apple-style clarity); legible, restrained controls (automotive interfaces); fine edges and selective metal highlights (watchmaking); alternating dark framing and light reading space (architecture). These are design judgments, not claims of current brand-specific research results.

Sources actually read: installed [Next.js CSS documentation](https://nextjs.org/docs/app/getting-started/css), and [GoogleChrome's official animation guide source](https://github.com/GoogleChrome/web.dev/blob/main/src/site/content/en/animations/animations-guide/index.md), retrieved through the GitHub API. The latter recommends transform/opacity over layout-heavy animation. Direct Apple HIG, Porsche, Rolex, web.dev and W3C pages were attempted but blocked by the network proxy; no fresh review of those pages is claimed. Contrast uses WCAG relative-luminance arithmetic and existing automated checks.

## Material architecture

| Material           | Value                      | Use                                                 |
| ------------------ | -------------------------- | --------------------------------------------------- |
| Imperial Green     | existing #12382D / #205443 | Intelligence identity and signature depth           |
| Imperial Steel     | #4A5450                    | Brushed surface with green undertone                |
| Steel illumination | #7D8780                    | Decorative edge light, never a text reading surface |
| Carbon Shadow      | #121417                    | Navigation and architectural depth                  |
| Obsidian           | #080D0B                    | Deep material contrast                              |
| Stone White        | #F6F4ED                    | Editorial canvas and dark-surface text              |
| Reserve Gold       | existing #C4912F           | Main entry action and fine details                  |

Additive reusable CSS tokens define brush texture, steel surface, signature gradient, metallic edge and elevation. No global color replacement. The homepage opts in with `data-material="imperial-steel"`; entrance and application modules do not. The visual hierarchy is dark framing and hero, generous stone reading space, three dimensional workspace cards, then a signature footer. Gold remains selective.

The hero presence is a decorative server-rendered CSS composition, aria-hidden and unrelated to live listening or model work. It adds no WebGL, canvas, downloaded artwork, timers or dependency. Text stays HTML and entry links remain useful without JavaScript. Existing motion director remains; the new material art is static. Card tactile motion is limited to a short transform, suppressed by reduced motion and Still mode. Forced colors restore native colors. SVG arrows use the existing icon component to avoid font-dependent missing glyphs.

## Release boundaries

No provider, authentication, entitlement, storage or database behavior changed. No migrations or secrets added. The obsolete shell test expected the retired Command/My world navigation; it is updated to assert the actual Talk/Work/Studio navigation, active state and presence-dialog focus return. The existing production developer-route denial test is retained.

Production release uses a feature branch, GitHub PR and the repository's Vercel Git integration. No direct CLI deployment or branch-protection bypass. Main's inherited broad browser/founder jobs were already failing before this phase; distinguish their outcomes from the homepage and preserved workspace acceptance. Record actual validation and deployment receipts in STATUS.md, including any remaining blocker rather than inventing live status.
