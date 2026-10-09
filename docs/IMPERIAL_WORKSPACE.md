# Public Aethelios — Imperial workspace

Founder direction, October 9, 2026: carry the approved white/green/gold experience into Talk, Work and Studio. No third chromatic hue. This supersedes the blue/petrol palette in AETHER_PETROL.md; historical engineering behavior remains applicable.

| Material            | Color   | Role                                         |
| ------------------- | ------- | -------------------------------------------- |
| Warm ivory          | #F5F1E8 | Reading and working canvas                   |
| Architectural cream | #E9E0D0 | Secondary surfaces and layering              |
| Imperial Green      | #12382D | Signature navigation and immersive materials |
| Mineral Green       | #205443 | Controls, selected states and illumination   |
| Reserve Gold        | #C4912F | Selected actions and fine details            |
| Champagne           | #E4BD70 | Metallic highlights on dark green            |
| Green-black         | #0D211B | Deep contrast and orb materials              |

Implementation plan: preserve routes and domain behavior; change the shared palette first; apply scoped light reading roles to the existing application shell; retain dimensional green navigation and orb materials; verify text contrast, focus, reduced motion and existing interactions at phone, unfolded and desktop widths.

The shared JSON palette generates aether-tokens.css through scripts/generate-aether-tokens.mjs. The compatibility key `petrol` now contains Imperial Green; renaming every existing consumer would introduce unnecessary risk. imperial-workspace.css explicitly rebinds legacy text/surface aliases inside the light shell because inherited CSS custom properties otherwise retain their root dark values. Ivory uses green ink/quiet text rather than gold text; gold remains a material and emphasis color. Original crest and installation icon artwork is preserved.

Research used the existing arrival/entrance implementation, actual route styles, installed Next.js CSS ordering documentation and WCAG relative-luminance contrast calculations. This is implementation research, not a claim of fresh external market research. Text role combinations are checked at 4.5:1, with browser checks for representative rendered headings, secondary copy and links. Those checks do not constitute a complete accessibility audit of every authenticated state.

Review scope: public arrival, entrance, Talk, Work, Studio; static orb fallback, presence dialog, conversation editor, Team/Table and unsent company handoff. Provider calls in intercepted browser fixtures are synthetic; no live provider, authenticated production account or physical-device verification is implied. No new dependencies, database migrations or production deployment.

Screenshots and the validation receipt are recorded in docs/STATUS.md after the final checks. Founder review precedes merge and deployment.
