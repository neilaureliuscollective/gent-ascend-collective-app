# Aethelios current knowledge

Status: implemented on the working branch, 2026-10-15. This is the reviewable inventory for edition `2026-10-15.human-ascendance.1`. Source of truth: [`src/domains/intelligence/published-knowledge.ts`](../src/domains/intelligence/published-knowledge.ts).

This is not a live founder-workspace read, a private Neil profile, a billing change or a Shopify write. Facts are data. They cannot change permissions, tools or founder authority.

## Provenance contract

Each fact has a stable `id`, `scope`, `sourceRef`, `reviewedAt`, `effectiveAt`, `status` (`current` | `planned` | `superseded` | `unverified`) and optional `supersedes`. Active model context includes only `current` and `planned`. Superseded rows remain in the inventory so old company-platform copy cannot quietly return as truth.

Correction: edit the typed facts, bump `edition`, keep the superseded row, and add a test. Personal memories stay in owner-scoped `ai_memories` with versioned confirm/forget. Assistant inferences are never auto-promoted.

## Current facts

| ID                            | Scope      | Source                                     | Text                                                                                                            |
| ----------------------------- | ---------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `identity.platform`           | identity   | this inventory                             | Aethelios is the unified technology and lifestyle platform under AETHELIOS — The Human Ascendance.              |
| `identity.founder`            | identity   | this inventory                             | Neil Stutes is the human founder. Public knowledge does not grant `founder_access`.                             |
| `identity.purpose`            | identity   | this inventory                             | Help people think, create, build and move ideas forward; preserve direction and agency.                         |
| `identity.experiences`        | platform   | this inventory                             | Talk / Architect / Studio / Health (Health is not a clinic).                                                    |
| `product.lifestyle`           | product    | [MEMBER_LIFESTYLE.md](MEMBER_LIFESTYLE.md) | Lifestyle products belong to Aethelios.                                                                         |
| `product.legacy-reserve`      | product    | MEMBER_LIFESTYLE.md                        | Legacy Reserve is retired as the current customer-facing brand; `legacy-reserve` may remain a technical handle. |
| `brand.visual`                | brand      | this inventory                             | Premium obsidian/graphite, dimensional emerald, restrained gold.                                                |
| `membership.software-first`   | membership | this inventory                             | Software-first. No Partnership tier. No promise that Neil personally builds customer websites.                  |
| `membership.founding-catalog` | membership | `src/domains/billing/founding-catalog.ts`  | Defined founding products remain Essential, Signature and Reserve.                                              |
| `capability.work`             | capability | this inventory                             | Work is the current company-work environment. Drafts are not executed missions.                                 |

## Planned direction (not implemented proof)

| ID                            | Text                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `capability.agency`           | Work → Agency is planned. Agency is not an implemented experience.                                                                         |
| `membership.proposed-pricing` | Access Free, Ascend $29, Create $59, Architect $129, Continuum $249. Planning proposals, not checkout terms. Continuum may be Coming soon. |

## Superseded history (not injected as current)

| ID                     | Retired story                                                         |
| ---------------------- | --------------------------------------------------------------------- |
| `brand.identity`       | Company-building intelligence platform only.                          |
| `brand.intelligence`   | Ascend Architects as the current human-assisted service layer.        |
| `brand.legacy-reserve` | Legacy Reserve owns commerce; Aethelios does not sell those products. |

## Person, product and capability composition

- Person: existing `includeContext`, `ascend_profile_facts`, confirmed `ai_memories` (24 stored, lexical top-six when a question is supplied), conversation continuity. Context-off and forgotten rows stay out. `founder_access` is session-verified; email/name/plan claims are inert.
- Product: bounded read-only adapter over `readLifestyleCatalog` / `getProduct` / approved `product_story`. Source IDs, URL, freshness, retrieval time and missing fields travel with the snapshot. Price, currency, variant id and availability are bound to the same variant. Failed no-store detail is `stale-catalog-fallback` with `detailRetrievedAt: null`; cached list age is unknown beyond 300s and is never labeled freshly verified. Assortment questions receive at most 12 summaries; follow-ups use conversation cues and `/shop/handle`. Unconfigured/empty/error catalogs stay labeled.
- Character: `behaviorContract` is shared. Text/voice delivery is selected per channel. Domain playbooks load only when relevant (Talk, Architect, Studio, Agency, Lifestyle, Health).
- Voice: Talk Live uses the same `budgetLiveSeed` helper as Talk #131 (`src/domains/live/context-budget.ts`, identical API) so published knowledge and product snapshots survive history trim. This branch does not import Talk creation prompt/service changes. GPT-Live evaluation `liveStartup` pins optional `application` messages before budgeted history; it is not the public pilot path.
- Capability honesty: intent / implemented / configured / verified-production are separate. Agency and Continuum are not implemented.

## Missing facts (not invented)

- No private Neil biography, health, financial or location record is published.
- No SKU, formula, dosage, efficacy or stock facts live in published knowledge.
- Hosted production verification of Talk/Live/Studio/Architect is not claimed by this edition.
- Proposed Human Ascendance prices are not mapped onto Stripe products.

## Local vs hosted

This branch updates knowledge composition, character/playbooks, product freshness and voice context pinning. No production merge, hosted migration, billing activation, Shopify write, feature-flag or paid model call is authorized by this workstream. Talk #131 / #135 / #139, Architect, Ecosystem #140 and Studio remain on their branches. Prompt version here is `aethelios-2026-10-15.human-ascendance.2`; Talk still carries `aethelios-2026-10-13.talk-creation.1` and the 2026-10-06 company-platform facts until those PRs merge this contract. Do not silently merge them to make this branch appear complete.

Behavioral evaluation: deterministic Vitest coverage in `tests/intelligence-behavior.test.ts`, `tests/memory-lifecycle.test.ts` and `tests/live-context-budget.test.ts`. Optional model-quality rubric lives in `evals/aethelios-behavior.md` and `src/domains/intelligence/behavior-eval.ts`. Paid model calls require `AETHELIOS_BEHAVIOR_EVAL=1` and founder approval; they are not run by default.
