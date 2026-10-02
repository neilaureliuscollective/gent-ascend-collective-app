'use client';
export type CommerceEvent =
  | 'discovery_complete'
  | 'product_view'
  | 'gallery_view'
  | 'model_open'
  | 'formula_open'
  | 'product_saved'
  | 'add_to_cart'
  | 'checkout_start'
  | 'membership_view';
/** A first-party integration hook; no tracking vendor or private identity attached. */
export function commerceEvent(event: CommerceEvent, handle?: string) {
  window.dispatchEvent(
    new CustomEvent('gent-ascend-commerce', {
      detail: { event, ...(handle ? { handle } : {}) },
    }),
  );
}
