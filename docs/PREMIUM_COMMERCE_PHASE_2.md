# Premium commerce — Phase Two: help the shopper choose

Founder authorized research, planning, and execution on 2026-10-02. Built on Phase One commit `fb5268339968ff514c1c857342bbc41003a0b1e6`. This is the existing Gent Ascend application, not a replacement. Phase One remains an unmerged review candidate at PR #40; Phase Two must follow it in release order.

## Research and design decision

The showroom now communicates the product story, but choosing a relevant item still takes several page visits. The next useful step is decision support: an optional collection guide, a considered saved-selection view, and relevant product-to-product navigation. These are intended to reduce search effort and help the shopper understand their choices. They are design hypotheses, not measured conversion or revenue uplift.

Research inspected 2026-10-02:

- Nielsen Norman Group's category/listing guidance supports clear groupings and immediately available product lists so customers can choose a direction without losing the browse path. https://www.nngroup.com/articles/ecommerce-homepages-listing-pages/
- Baymard distinguishes alternatives from supplementary products. This build keeps those relationships separate and does not infer them from similar product names. https://baymard.com/research-articles/product-page-suggestions
- Baymard's cross-sell information research supports visible thumbnails, full names and prices. We include those plus an editorial reason and release status. There is no fabricated review average where no verified ratings exist. https://baymard.com/research-articles/product-page-suggestions-information
- Baymard's comparison research is oriented to specification-driven purchases; it cautions against assuming a mobile comparison tool is always the best investment. We use a readable selection dossier instead of a wide comparison table. https://baymard.com/research-articles/provide-comparison-features
- Shopify preorders still require supported merchant configuration and real payment/shipping terms. This phase does not remove the existing paid-preorder gate. https://help.shopify.com/en/manual/products/purchase-options/pre-orders/setup
- Installed Next.js `use client` documentation and the React best-practice checklist informed serializable entry props, server-owned catalog data, a shared external saved-selection store, and bounded optional client interactions.

The psychology here is specific: give the shopper a voluntary direction, make each resulting item understandable, and let them keep a shortlist without surrendering an email or accepting a subscription. Asking about skin conditions, medications or supplement needs would require a separate evidence and privacy design; the guide collects none of that. The answers remain transient in the page. We do not promise AI personalization, diagnose fit, prescribe a routine or claim that a collection completes someone's health needs.

## Execution plan and implementation

1. Extend the existing approved product-story contract with bounded grooming discovery tags and explicit editorial relationships. Keep price, launch eligibility, stock and checkout authoritative in Shopify/server policy.
2. Add `Begin with your intention` to the existing showroom. Two native-radio choices: chapter and ready-only versus previews. Submit shows an explainable filtered collection and moves keyboard focus to results. No forced wizard or account wall. No matches displays a truthful empty state and offers previews, with no unrelated substitutions.
3. Reuse one product-card component for shelf, discovery results, selection review and related products. Add save/remove outside its product link, avoiding nested interactive controls. Saved records remain public handles only.
4. Upgrade `My selection` with purpose/fit, texture, scent, ingredient/caution links, price and release status. State missing facts explicitly. Surface saved handles absent from the current catalog view without asserting deletion or availability, and allow removal.
5. Add merchant-approved `Another option to consider` and `Another part of the ritual` shelves on the product page. Preserve individual variant review and existing cart flow. No automatic bundle, combined purchase, compatibility guarantee or discount.
6. Verify policy, malformed metadata, storage normalization, responsive flows, keyboard/reduced-motion/no-JavaScript browsing, storage denial, saved persistence and product relationships. Run the existing commerce/public regression suite, full check and migration ledger before publishing a review candidate.

## Merchant activation contract

`gent_ascend.product_story` remains version 1 and requires `status: "approved"`. Existing Phase One records still work; new arrays default to empty.

```json
{
  "version": 1,
  "status": "approved",
  "mediaApproved": false,
  "discovery": ["beard", "hair"],
  "related": [
    {
      "handle": "actual-published-product-handle",
      "kind": "complementary",
      "reason": "An approved explanation of this product's distinct place in the collection."
    }
  ]
}
```

This is a field-shape example, not merchant-approved product content. Replace it with genuine published handles and verified copy.

- `discovery`: at most three values from `beard`, `hair`, `body`. These are category labels, not a skin-type or health assessment. No title-based inference for live products. The existing curated previews have explicit editorial tags and remain nonpurchasable.
- `related`: at most four strict objects. Handle is lowercase alphanumeric/hyphens, 1–120 characters. Kind is `alternative` or `complementary`. Reason is bounded plain text. Unknown fields, unapproved status and invalid shapes fail closed as the existing story schema does.
- Only resolvable published catalog entries are shown. Self references, repeated handles and unavailable catalog references are omitted. A failed related-catalog fetch does not block the primary product page. A preview or sold-out related product stays visibly nonpurchasable; no card bypasses variant review.
- The catalog's existing 60-product window remains. Relationships outside that window are omitted. Add pagination/direct resolution before increasing the assortment beyond that boundary; do not claim an omitted saved handle has been deleted.
- Approved clean Shopify imagery remains optional. Unapproved assets use disclosed concept packaging. Media approval is not a claim about the final formula or packaging.

## Performance, privacy and accessibility

No added package, database migration, billing flow or AI request. Discovery operates over server-projected public catalog entries. No person/profile/history access. Choice answers are not persisted or sent to a backend. The new `discovery_complete` CustomEvent carries no answers; as in Phase One it is an integration hook, not a tracking service or measured conversion.

The saved collection is bounded to 100 unique valid handles and 20,000-character input. It retains the existing versioned browser key. One shared external store caches parsing and registers one pair of storage/event listeners for all cards; last-unsubscribe removes them. Storage failure is visible; save confirmation is never shown before a successful write. Refresh and cross-tab updates are supported. There is no account sync, release alert, reserved stock or email consent.

Native radios, fieldsets/legends, buttons, focused result headings and normal product links remain usable by keyboard. Browse cards are rendered on the server and remain available without JavaScript. Reduced motion and Still are inherited; discovery adds no animation dependency. Layout remains within 344, 768 and 1440 widths. Physical Fold/iPhone acceptance is still required before release.

## Commercial boundaries and next phase

Phase Two makes the catalog easier to choose from; it does not activate paid preorders, member discounts, verified orders, account-synced collections or a revenue dashboard. Next, after genuine supplier capacity, approved labels/assets and shipping commitments exist, implement and test the supported Shopify preorder selling-plan path and payment terms. Connect measurement only with the approved privacy and order-confirmation design. Do not treat saving a product as notification consent.

Executed verification is recorded in docs/STATUS.md. Synthetic component fixtures verify rendering/interaction, not live merchant checkout or account integration. Production promotion remains separate.
