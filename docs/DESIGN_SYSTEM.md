# Design system — Stage 1 proposal

Aurelius Collective feels like considered personal infrastructure: obsidian surfaces, restrained gold highlights, deep purple atmosphere, generous typography and precise alignment. No Roman costume motifs, gamer neon, generic SaaS kit or fabricated health scores.

Provisional tokens: obsidian #09080D; raised #14111C; gold #D6AE62; soft gold #F1D99E; deep purple #39214E; text #F4EFE6; muted #B8AFBE. These are implementation proposals, not changes to a finalized brand manual. Use gold primarily for actions/selection; purple for depth. System sans with editorial serif display headings avoids external font requests during the foundation.

Mobile: compact header, one-column Command surface, four-item bottom navigation with safe-area inset, persistent Aurelius action. Unfolded: two-column content where intrinsic width permits. Desktop: restrained sidebar and broad working canvas. Use CSS grid/minmax, not device models. Test 360, 768 and 1440px and 200% zoom.

An understated luminous Aurelius control is the persistent intelligence entry; panel provides contextual actions once implemented. No animated body substitute or fabricated clinical status. Empty state says what has not been recorded.

Use semantic landmarks, explicit form labels, visible focus rings, ≥44px touch targets, high-contrast body text, Escape-to-close/focus return for dialog, and prefers-reduced-motion. Metadata may be smaller; normal body remains 16px. Motion is brief and functional.

## Aurelius workspace refinement

The intelligence workspace uses an obsidian conversation library, restrained gold selection borders and a deep-purple working surface. A compact orb supports the conversation invitation without pushing it below the composer at unfolded widths. The transcript scrolls independently; composer and context controls remain accessible. Library navigation is persistent on larger canvases and an explicit disclosure below 1100px.

Context has three grounded sections: profile/priority, current goal/next step and explicitly confirmed memory. Never invent progress, scores or personal facts to populate the design. The disconnected preview has empty data and visible sign-in/saving limitations. Disabled actions must also be guarded in handlers and on the server.
