# Stage 2A — Personal foundation

Scope approved by the founder's request to build the next phase, 2026-09-20.

## Working experience

You: edit display name, timezone, preferred measurement units and one current priority. All fields are optional except name/timezone/units; no long onboarding gate or health questionnaire.
Goals: create one active focus goal with a title, domain, personal reason, next step and optional target date. Edit while active, then complete or archive with an explicit confirmation. Previous goals remain visible. One-active-goal is a reversible scope decision for this first slice, not a permanent product restriction.
Command: after authentication, show the person's name, priority, active goal and next step. No simulated recommendations or progress percentages. My world links to the working goal space.

## Ownership and persistence

Supabase session-bound reads/writes only. Profile and basic goals are core capabilities available without payment or onboarding. Resolve the person server-side; do not accept a person ID from a form. Every update includes the record version and rejects stale changes. Database policies also constrain direct API writes. Database triggers maintain timestamps/versions and append goal lifecycle events in the same transaction. A compound (person_id, goal_id) foreign key prevents cross-person timeline links. No hard delete for goals in this slice; archive retains the user's history. Account deletion still cascades.

## UX behavior

Save confirmation, pending buttons, validation beside fields and preserved inputs on failure. Conflicts require reloading the latest saved version before retrying; never overwrite it implicitly. Network failures report an uncertain save and invite reloading before retry. Target dates are calendar dates, not UTC instants; event dates render in the profile timezone. Empty, signed-out and unavailable configurations remain honest.

## Validation

Migration chain and seed replay; cross-user SELECT/INSERT/UPDATE denial; ownership reassignment denial; single active goal; status transition enforcement; transactional event creation; stale version behavior; profile timezone/unit validation. Browser tests cover form errors, input preservation and lifecycle controls through isolated component fixtures plus app navigation and anonymous denial. The real Supabase integration script covers save/reload, auth ownership and event persistence. A separate founder browser suite covers local entry, free membership, profile save/reload, stale-tab rejection, goal creation, Command and completed history. Both must run before signoff.

Stage 1's missing Docker-based integration and read-only GitHub limitations remain open. This authorized incremental implementation does not waive those release gates.

Sources checked: [Next forms](https://nextjs.org/docs/app/guides/forms), [React useActionState](https://react.dev/reference/react/useActionState), [Supabase function security](https://supabase.com/docs/guides/database/functions). No new production service or package is required.
