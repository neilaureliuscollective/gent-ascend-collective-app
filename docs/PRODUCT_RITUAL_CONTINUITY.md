# Collection-to-Ritual Continuity

October 4, 2026. Canonical base: 75649ba9f730281386616f63469bd9fea4b9fe9e. Founder requested research, planning and execution of the next product integration phase after the live Cabinet increment.

## Inspected gap and chosen phase

The native Collection and Cabinet are live. Member product detail still saves a browser-only selection; ritual links exist in the ledger but are absent from ritual practice. The current repository has no Shopify customer-account bridge, customer OAuth configuration contract, enforcement resolver or verified order ingestion. No callable Shopify merchant connector is available. The full saved Phase 1/2 specifications remain broader than delivered code.

Next deliverable: Collection-to-Ritual Continuity. Make a member's explicit product choices persist across devices and appear beside his existing routine. This is the next coherent app phase; it does not claim completion of verified purchase history or member economics.

## Build plan and delivered behavior

1. Compose a private account-save control into published member product pages using the existing session-bound Cabinet action. Public storefront and browser selection remain separate. Signed-out members get a sign-in entry; previews cannot be imported as live products.
2. In Cabinet, review a browser selection before importing. Nothing is selected or written automatically. Up to twenty public handles resolve on the server; unavailable items stay outside the import. A second explicit confirmation binds the review to the signed-in person and stable product IDs.
3. Re-resolve identity and catalog at confirmation. Reject account changes and replaced products. A single conflict-safe bulk write saves only new interests. Preserve existing legacy records, notes, ownership/use states and browser saves. Exact retry is safe through the owner/product unique constraint; no second ledger or migration.
4. Show member-linked products beside existing morning/evening/weekly rituals. The panel displays up to six links from the existing latest-eighty product view and links to the full paginated Cabinet. It states the bound and member-reported provenance. It does not recommend a product, infer use from ritual completion, or claim purchase/delivery.
5. Run canonical checks, meaningful service tests, browser confirmation/failure/layout tests, migration ledger and real two-user Auth/PostgREST save/replay tests. Fixtures remain distinguished from production member acceptance.

## Research and decisions

- Shopify's Customer Account authentication tutorial requires OAuth/PKCE, configured customer scopes and protected customer data access: https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/authenticate-customers (reviewed October 4, 2026). Verified order and member-price activation remains gated on that actual merchant configuration and checkout proof; entered email does not establish customer identity.
- Supabase ownership policies and column grants remain independent: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/postgres/column-level-security (reviewed October 4, 2026). Reuse the existing owner-RLS ledger, narrow edit grants, compound ritual FK and unique owner/product key. No service-role app access.
- React useActionState supplies action result/pending state: https://react.dev/reference/react/useActionState (reviewed October 4, 2026). Controlled selections plus canceled native reset preserve failed drafts. Confirmation and preparation have independent result state.
- Read the installed Next.js 16.3.5 mutating-data guide before editing. Server Actions are directly reachable POST endpoints; each read/write validates its session in the domain. No private data enters shared caches or browser storage.

## Next prerequisites

Configure and prove Shopify customer-account linking; implement the trusted commerce entitlement/enforced quote path; then add verified orders and current-price reorder review. Member Cassius should reuse the Council and approved product facts after that integration, with reviewed actions and no founder dossier access. Never advertise a discount or purchase badge from a configuration flag or self-report.

## Release evidence

Checks and exact revision are recorded in the release PR and final delivery receipt. Production cross-device acceptance remains a separate signed-in test. No purchase/payment transaction, new Shopify configuration or discount is claimed.
