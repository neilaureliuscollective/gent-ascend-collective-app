# Aethelios current knowledge

Status: founder authorized 2026-10-15 merge of PR #141 onto main. Live production is merge `bbda46f` / deployment `dpl_Dq6DwWY2sPfbtxLsr2CnY6qAZ7oR` on https://www.gentascend.com. This is the reviewable inventory for edition `2026-10-15.human-ascendance.1`. Source of truth: [`src/domains/intelligence/published-knowledge.ts`](../src/domains/intelligence/published-knowledge.ts).

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
- Product: bounded read-only adapter over `readLifestyleCatalog` / `getProduct` / approved `product_story`. Current user text outranks older mentions and assistant recommendations. Variant matching requires a unique consistent match across normalized dimensions (`50 ml` = `50ml`). Ambiguous product or variant matches stay unresolved and ask one question. Failed no-store detail is `stale-catalog-fallback`.
- Character: `behaviorContract` is shared. Playbooks load from current intent (or one short follow-up), not accumulated history. A health concern alone does not load commerce.
- Voice: Talk-identical `budgetLiveSeed` is unchanged. After admission, `lookup_lifestyle_catalog` is a read-only function-call tool (session-auth, approved Storefront readers, bounded rate/size/timeout, deduped call IDs, no late emit). No purchase/cart/Admin. Talk creation tools on #131 must survive integration: `offer_text_work`, `refine_selected_direction`, plus this lookup.
- Capability honesty: intent / implemented / configured / verified-production are separate. Agency and Continuum are not implemented.

## Missing facts (not invented)

- No private Neil biography, health, financial or location record is published.
- No SKU, formula, dosage, efficacy or stock facts live in published knowledge.
- Hosted production verification of Talk/Live/Studio/Architect is not claimed by this edition.
- Proposed Human Ascendance prices are not mapped onto Stripe products.

## Local vs hosted

Prompt version is `aethelios-2026-10-15.collaborator.1` from [`src/domains/intelligence/edition.ts`](../src/domains/intelligence/edition.ts). That file is the single authoritative source for Talk `promptVersion`, this knowledge edition, and the Live persistence tag `aethelios-live-pilot.3` (Live still composes the shared instruction set). Talk creation tools (`offer_text_work`, `refine_selected_direction`) remain on this tree. `budgetLiveSeed` is unchanged. Collaborator expertise modules, derived working state and the opt-in eval runner are documented in [AETHELIOS_COLLABORATOR.md](AETHELIOS_COLLABORATOR.md). Talk Elevation, Motion, image-attachment and globe-voice workstreams stay separate.

Production: GitHub Production deployment `7091456264` for `bbda46f` succeeded. Live HTML `data-dpl-id="dpl_Dq6DwWY2sPfbtxLsr2CnY6qAZ7oR"` matches. This is the existing Vercel Git production pipeline, not promotion of a preview. Authenticated Talk/Live/Shopify catalog journeys were not run from this environment. Rollback: previous READY production SHA `af29723` (Human Ascendance in-app logo). Preserve private tables, buckets and records if reverting the app.

Behavioral evaluation: deterministic fixtures in `tests/intelligence-collaborator.test.ts`, `tests/intelligence-conversation-path.test.ts` and `tests/product-knowledge-conversation.test.ts`. Persistence forgetting remains `tests/database.test.ts`. The in-memory MemoryLedger is a contract mirror, not end-to-end proof. Optional model eval: `npm run eval:behavior`. Default is a skip report. Comparison is an ablation of the current instructions, not a historical baseline. `AETHELIOS_BEHAVIOR_EVAL=1` records approval; `AETHELIOS_BEHAVIOR_EVAL_EXECUTE=1` scores actual model answers with reserved-cost caps. No paid evaluation was launched from this task.
