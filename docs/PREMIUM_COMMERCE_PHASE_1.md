# Premium commerce — Phase One

Founder-authorized implementation, 2026-10-02. Canonical repository: `neilaureliuscollective/gent-ascend-collective-app`. This extends existing Shopify commerce, launch policy and the public cinematic world. No billing, Auth, RLS or existing database migration is changed.

## Delivered experience

- `/shop` and `/launch`: a shared green/obsidian/gold showroom, featured object, useful category filters, compact product shelves, price/availability distinctions and a browser-saved selection.
- `/shop/[handle]`: reusable product stage, approved image gallery with native modal enlargement, fit/intention, sensory notes, ingredient explorer, full ingredient/fact text, directions, release details, FAQs and optional membership/account links.
- `/shop/world/[handle]`: the same showroom composition for the existing collection worlds.
- Vitalis preview: the existing optional Three.js packaging study is integrated into the primary stage. Its packaging remains explicitly conceptual. Founder-supplied formula direction is shown separately from final supplier INCI. Generic beard-care education links to the American Academy of Dermatology; it does not assert product efficacy.
- Actual approved Shopify GLB models can be inspected through an on-demand renderer and accessible rotation slider. No model autospin, no mandatory GPU scene, capped resolution, 10 MB model ceiling, timeout, offscreen/hidden-page render suspension and resource disposal. Missing, unsupported or failed models retain images. Compressed formats needing unconfigured decoders fall back rather than claiming support.
- Existing buy-now merchandise keeps the same server-validated cart path. Variant and quantity selection update price; the phone purchase bar shares the same state. Cart drawer confirmation and secure checkout remain intact.
- Preview/preorder/blocked products remain nonpurchasable in both browser and existing server policy. Release panels explain that no payment is collected. This build does not install a preorder app or silently unlock native selling plans.

## Content contract

Existing storefront-readable `gent_ascend` plain-text metafields remain supported: `purpose`, `ingredients`, `directions`, `ritual`, `launch_state`, `launch_window`.

Add a storefront-readable **JSON** metafield `gent_ascend.product_story`. It is deliberately independent of Shopify prices and membership authorization. The strict schema in `src/domains/commerce/product-story.ts` accepts only:

| Field                                 | Purpose                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `version: 1`, `status: "approved"`    | Explicit editorial publication state                                      |
| `mediaApproved`                       | Permit gallery/model media after checking rights, accuracy and watermarks |
| `size`, `benefit`, `fit`              | Verified dimensions/quantity, product purpose, appropriate fit            |
| `texture`                             | Verified feel/finish description                                          |
| `scent: [{label, value}]`             | Approved scent vocabulary; imagery is not an ingredient claim             |
| `highlights: [{name, role}]`          | Plain-language, substantiated ingredient functions                        |
| `steps: [{title, detail}]`            | Actual manufacturer application sequence                                  |
| `cautions`, `quality`                 | Applicable label cautions and documented quality/process facts            |
| `faq: [{question, answer}]`           | Product-specific buying questions                                         |
| `shipping`, `payment`, `cancellation` | Current, approved operational terms; descriptive only                     |
| `factsLabel`                          | `Ingredients` or `Supplement Facts`                                       |

Minimal approved record with no new marketing claims:

```json
{ "version": 1, "status": "approved", "mediaApproved": false }
```

Do not add arbitrary prices, discounts, role fields or raw HTML; unknown fields invalidate the enrichment. Arrays/text are bounded, malformed/oversized/draft/future-version records fail closed, and all content is rendered as React text. Product images/models must use HTTPS on `cdn.shopify.com`.

Media is intentionally **not** treated as approved by default. Until the merchant approves clean assets in the structured record, the showroom uses disclosed concept packaging. This prevents the watermarked supplier previews seen in the founder's screenshot from becoming the premium product presentation. It does not remove watermarks or claim that a concept is the actual packaging. Review imagery separately from ingredient facts.

Shopify remains the source for product IDs, variants, prices, currency, inventory and checkout. The detail fetch is deduplicated within a server request. Catalog reads remain lightweight and retain their existing 300-second cache. Private carts remain no-store. No app input can override launch eligibility, price or a membership entitlement.

## Saving and account boundaries

`Save to my collection` is a real, bounded localStorage feature with remove/reload/cross-tab behavior and unavailable-storage recovery. Its exact disclosure: saved on this browser; it does not reserve inventory, place an order, subscribe to email updates or sync with an account. `/shop?saved=1` opens the selection. This is not a waitlist.

The membership bridge links to the existing membership and signup flows, accurately distinguishes account creation from paid enrollment, and explicitly keeps paid membership optional for product purchase. Member product offers remain planned. No unverified savings, enrollment activation or account redirect contract is added.

## Measurement boundary

First-party `gent-ascend-commerce` CustomEvents expose product view, gallery/model inspection, formula opening, product saving, successful cart addition and checkout-start hooks. Payloads contain event type and public handle where supplied, with no person, email, cart secret or medical information. No analytics vendor or persistence was configured; these hooks do not yet constitute a revenue dashboard or paid-order tracking. Connect an approved measurement sink and Shopify order confirmation before measuring conversion or incremental revenue.

## Commercial activation remains separate

Before paid preorders: confirm actual supplier capacity and shipping dates, select/configure a supported Shopify preorder app, verify full/deposit payment terms and selling-plan allocation, cancellation and delay communication, mixed-cart behavior and real checkout/order receipts. The existing launch policy deliberately blocks preorders until that path is implemented and tested.

Before member product discounts: verify real server-side eligibility and Shopify-supported discount application. Showing a member price is not enforcement. No discount was invented in this phase.

Before populating every product: obtain final INCI or Supplement Facts, sizes, scent, directions, cautions and clean rights-cleared assets. Do not substitute ingredient-level evidence for finished-formula results or generate dosage/medical claims. The founder's Vitalis component direction is not a complete supplier label.

## Research behind the build

Sources inspected 2026-10-02:

- Baymard: shoppers need inspectable product imagery and ingredients; DTC brands must explain origins, process and quality. https://baymard.com/research-articles/product-descriptions ; https://baymard.com/research-articles/ensure-sufficient-image-resolution-and-zoom ; https://baymard.com/research-articles/dtc-users-informational-needs
- Nielsen Norman Group: consistent product details and unmistakable cart confirmation. https://www.nngroup.com/articles/ecommerce-product-pages/
- Shopify native preorder requirements/restrictions. https://help.shopify.com/en/manual/products/purchase-options/pre-orders/setup
- Shopify Model3d/Model3dSource reference, sources/format/filesize. https://shopify.dev/docs/api/storefront/latest/objects/Model3d ; https://shopify.dev/docs/api/storefront/latest/objects/Model3dSource
- AAD beard-care guidance. https://www.aad.org/public/everyday-care/skin-care-secrets/face/healthy-beard
- Primary Cosmetic Ingredient Review assessment: plant-derived oils have cosmetic emollient/conditioning functions; this is not evidence for Vitalis efficacy. https://pubmed.ncbi.nlm.nih.gov/29243540/
- The installed Next.js 16.3.5 image/lazy-loading guides and React best-practice review informed local image sizing, optional imports, request deduplication and client boundaries.

3D and premium styling are design hypotheses. No conversion uplift or market-tested result is claimed.

## Verification

See the current entry in `docs/STATUS.md` for executed checks. Browser fixtures are explicitly synthetic and separate from app routes; their intercepted cart/media responses are not live Shopify payment, supplier or account tests. Screenshots cover 344, 768 and 1440 widths. Required hosted Shopify/Auth/payment and physical-phone acceptance remain open. No production deployment is authorized by this implementation record.
